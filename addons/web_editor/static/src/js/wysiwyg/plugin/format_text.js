odoo.define('web_editor.wysiwyg.plugin.textFormat', function (require) {
'use strict';

var ColorpickerDialog = require('wysiwyg.widgets.ColorpickerDialog');
var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');


//--------------------------------------------------------------------------
// Font (colorpicker & font-size)
//--------------------------------------------------------------------------

var TextPlugin = AbstractPlugin.extend({
    get : function (range) {
        var target = range.sc[range.so] || range.sc;
        if (this.utils.isText(target)) {
            return range;
        }
        if (target.textContent.match(/\S/)) {
            return range;
        }
        if (target.tagName === 'BR') {
            return range;
        }
    },
});

var ForeColorPlugin = AbstractPlugin.extend({
    xmlDependencies: ['/web_editor/static/src/xml/wysiwyg_colorpicker.xml'],
    dependencies: ['Range', 'FontStyle'],

    buttons: {
        template: 'wysiwyg.buttons.forecolor',
        active: '_active',
        enabled: '_enabled',
    },

    init: function () {
        var self = this;
        this._super.apply(this, arguments);
        this._colors = this.options.colors;
        if (this.options.getColor) {
            this._initializePromise = this.options.getColors().then(function (colors) {
                self._colors = colors;
            });
        }
    },
    /**
     * @returns {Promise}
     */
    isInitialized: function () {
        return $.when(this._super(), this._initializePromise);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Method called on custom color button click :
     * opens the color picker dialog and saves the chosen color on save.
     */
    custom: function (value, range) {
        var self = this;
        var $button = $(range.sc).next('button');
        var colorPickerDialog = new ColorpickerDialog(this, {});

        colorPickerDialog.on('colorpicker:saved', this, this._wrapCommand(function (ev) {
            self.update(ev.data.cssColor);

            $button = $button.clone().appendTo($button.parent());
            $button.show();
            $button.css('background-color', ev.data.cssColor);
            $button.attr('data-value', ev.data.cssColor);
            $button.data('value', ev.data.cssColor);
            $button.attr('title', ev.data.cssColor);
            self.dependencies.Range.restore();
            $button.mousedown();
        }));
        colorPickerDialog.open();
    },
    /**
     * Change the selection's fore color.
     *
     * @param {string} color (hexadecimal or class name)
     */
    update: function (color, range) {
        if (!color || color[0] === '#') {
            color = color || '';
            $(range.sc).css('color', color);
        } else {
            $(range.sc).addClass('text-' + color);
        }
        this.dependencies.FontStyle.applyFont(color || 'text-undefined', null, null, range);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be active
     */
    _active: function (buttonName, focusNode) {
        var colorName = buttonName.split('-')[1];
        if (colorName[0] === '#') {
            colorName = $('<div>').css('color', colorName).css('color'); // TODO: use a js converter xml => rgb
            while (this.editable !== focusNode && this.document !== focusNode) {
                if (focusNode.style && focusNode.style.color !== '') {
                    break;
                }
                focusNode = focusNode.parentNode;
            }
            return this.document !== focusNode && colorName === $(focusNode).css('color');
        } else {
            return $(focusNode).closest('text-' + colorName).length;
        }
    },
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled: function (buttonName, focusNode) {
        return !!this.utils.ancestor(focusNode, this.utils.isFormatNode.bind(this.utils));
    },
});

var BgColorPlugin = ForeColorPlugin.extend({
    xmlDependencies: ['/web_editor/static/src/xml/wysiwyg_colorpicker.xml'],
    dependencies: ['FontStyle'],

    buttons: {
        template: 'wysiwyg.buttons.bgcolor',
        active: '_active',
        enabled: '_enabled',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Change the selection's background color.
     *
     * @param {String} color (hexadecimal or class name)
     * @param {Node} [range]
     */
    update: function (color, range) {
        if (color[0] === '#') {
            $(range.sc).css('background-color', color);
        } else {
            $(range.sc).addClass('bg-' + color);
        }
        this.dependencies.FontStyle.applyFont(null, color || 'bg-undefined', null, range);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {WrappedRange} range
     * @returns {Boolean} true if the given button should be active
     */
    _active: function (buttonName, focusNode) {
        var colorName = buttonName.split('-')[1];
        if (colorName[0] === '#') {
            colorName = $('<div>').css('color', colorName).css('color'); // TODO: use a js converter xml => rgb
            while (this.editable !== focusNode && this.document !== focusNode) {
                if (focusNode.style && focusNode.style.backgroundColor !== '') {
                    break;
                }
                focusNode = focusNode.parentNode;
            }
            return this.document !== focusNode && colorName === $(focusNode).css('background-color');
        } else {
            return $(focusNode).closest('bg-' + colorName).length;
        }
    },
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled: function (buttonName, focusNode) {
        return !!this.utils.ancestor(focusNode, this.utils.isFormatNode.bind(this.utils));
    },
});

var FontSizePlugin = AbstractPlugin.extend({
    dependencies: ['FontStyle'],
    xmlDependencies: ['/web_editor/static/src/xml/wysiwyg_format_text.xml'],

    buttons: {
        template: 'wysiwyg.buttons.fontsize',
        active: '_active',
        enabled: '_enabled',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Change the selection's font size.
     *
     * @param {integer} fontsize
     */
    update: function (fontsize, range) {
        this.dependencies.FontStyle.applyFont(null, null, fontsize || 'inherit', range);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {DOM} focusNode
     * @returns {Boolean} true if the given button should be active
     */
    _active: function (buttonName, focusNode) {
        var cssSize = focusNode.style.fontSize;
        var size = buttonName.split('-')[1];
        return size === 'default' && (!cssSize || cssSize === 'inherit') ||
            parseInt(size) === parseInt(cssSize);
    },
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled: function (buttonName, focusNode) {
        return !!this.utils.ancestor(focusNode, this.utils.isFormatNode.bind(this.utils));
    },
});

var FontStylePlugin = AbstractPlugin.extend({
    dependencies: ['Range', 'Media', 'Text'],
    xmlDependencies: ['/web_editor/static/src/xml/wysiwyg_format_text.xml'],

    buttons: {
        template: 'wysiwyg.buttons.fontstyle',
        active: '_active',
        enabled: '_enabled',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Applies the given styles (fore- or backcolor, font size) to the selection.
     * If no text is selected, apply to the current text node, if any.
     *
     * @param {string} color (hexadecimal or class name)
     * @param {string} bgcolor (hexadecimal or class name)
     * @param {integer} fontsize
     */
    applyFont: function (color, bgcolor, size, range) {
        var self = this;
        if (!range || !this.editable.contains(range.sc) || !this.editable.contains(range.ec)) {
            return;
        }
        var target;
        var font;
        if (range.isCollapsed()) {
            if (this.utils.isIcon && this.utils.isIcon(range.sc)) {
                target = this.utils.lastAncestor(range.sc, this.utils.isIcon);
            } else {
                target = range.sc;
                if (target && this.utils.isIcon && this.utils.isIcon(target)) {
                    range = range.replace({
                        sc: target,
                        so: 0,
                    });
                    this.dependencies.Range.save(range);
                } else if (this.utils.isText(range.sc)) {
                    font = this.document.createElement("font");
                    font.appendChild(this.document.createTextNode(this.utils.char('zeroWidth')));

                    var fontParent = this.utils.ancestor(range.sc, function (n) {
                        return n.tagName === 'FONT';
                    });
                    var right;
                    if (fontParent) {
                        right = this.dom.splitTree(fontParent, range.getStartPoint());
                    } else {
                        right = range.sc.splitText(range.so);
                    }
                    $(right).before(font);
                    font = this._applyStylesToFontNode(font, color, bgcolor, size);
                    range = range.replace({
                        sc: font,
                        so: 1,
                    });
                    this.dependencies.Range.save(range);
                    return;
                }
            }
        }

        var startPoint = range.getStartPoint();
        var endPoint = range.getEndPoint();
        if (startPoint.node.tagName && startPoint.node.childNodes[startPoint.offset]) {
            startPoint.node = startPoint.node.childNodes[startPoint.offset];
            startPoint.offset = 0;
        }
        if (endPoint.node.tagName && endPoint.node.childNodes[endPoint.offset]) {
            endPoint.node = endPoint.node.childNodes[endPoint.offset];
            endPoint.offset = 0;
        }
        // get first and last point
        var ancestor;
        var node;
        if (!range.isCollapsed()) {
            if (endPoint.offset && endPoint.offset !== this.utils.nodeLength(endPoint.node)) {
                ancestor = this.utils.lastAncestor(endPoint.node, this.utils.isFont) || endPoint.node;
                this.dom.splitTree(ancestor, endPoint);
            }
            if (startPoint.offset && startPoint.offset !== this.utils.nodeLength(startPoint.node)) {
                ancestor = this.utils.lastAncestor(startPoint.node, this.utils.isFont) || startPoint.node;
                node = this.dom.splitTree(ancestor, startPoint);
                if (endPoint.node === startPoint.node) {
                    endPoint.node = node;
                    endPoint.offset = this.utils.nodeLength(node);
                }
                startPoint.node = node;
                startPoint.offset = 0;
            }
        }
        // get list of nodes to change
        var nodes = [];
        startPoint.walkTo(endPoint, function (point) {
            var node = point.node;
            if (((self.utils.isText(node) && self.utils.isVisibleText(node)) || self.utils.isIcon && self.utils.isIcon(node)) &&
                (node !== endPoint.node || endPoint.offset)) {
                nodes.push(point.node);
            }
        });
        nodes = _.unique(nodes);
        // if fontawesome
        if (range.isCollapsed()) {
            nodes.push(startPoint.node);
        }

        // apply font: foreColor, backColor, size (the color can be use a class text-... or bg-...)
        var $font;
        var fonts = [];
        var style;
        var className;
        var i;
        if (color || bgcolor || size) {
            for (i = 0; i < nodes.length; i++) {
                node = nodes[i];
                font = this.utils.lastAncestor(node, this.utils.isFont);
                if (!font) {
                    if (node.textContent.match(this.utils.getRegex('startAndEndSpace'))) {
                        node.textContent = node.textContent.replace(this.utils.getRegex('startAndEndSpace', 'g'), this.utils.char('nbsp'));
                    }
                    font = this.document.createElement("font");
                    node.parentNode.insertBefore(font, node);
                    font.appendChild(node);
                }
                fonts.push(font);
                this._applyStylesToFontNode(font, color, bgcolor, size);
            }
        }
        // remove empty values
        // we must remove the value in 2 steps (applay inherit then remove) because some
        // browser like chrome have some time an error for the rendering and/or keep inherit
        for (i = 0; i < fonts.length; i++) {
            font = fonts[i];
            if (font.style.color === "inherit") {
                font.style.color = "";
            }
            if (font.style.backgroundColor === "inherit") {
                font.style.backgroundColor = "";
            }
            if (font.style.fontSize === "inherit") {
                font.style.fontSize = "";
            }
            $font = $(font);
            if (font.style.color === '' && font.style.backgroundColor === '' && font.style.fontSize === '') {
                $font.removeAttr("style");
            }
            if (!font.className.length) {
                $font.removeAttr("class");
            }
        }

        // target the deepest node
        if (startPoint.node.tagName && !startPoint.offset) {
            startPoint.node = this.utils.firstLeafUntil(startPoint.node.childNodes[startPoint.offset] || startPoint.node, function (n) {
                return (!self.utils.isMedia || !self.utils.isMedia(n)) && self.options.isEditableNode(n);
            });
            startPoint.offset = 0;
        }
        if (endPoint.node.tagName && !endPoint.offset) {
            endPoint.node = this.utils.firstLeafUntil(endPoint.node.childNodes[endPoint.offset] || endPoint.node, function (n) {
                return (!self.utils.isMedia || !self.utils.isMedia(n)) && self.options.isEditableNode(n);
            });
            endPoint.offset = 0;
        }

        // select nodes to clean (to remove empty font and merge same nodes)
        nodes = [];
        startPoint.walkTo(endPoint, function (point) {
            nodes.push(point.node);
        });
        nodes = _.unique(nodes);
        // remove node without attributes (move content), and merge the same nodes
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            if (this.utils.isText(node) && !this.utils.isVisibleText(node)) {
                continue;
            }
            font = this.utils.lastAncestor(node, this.utils.isFont);
            node = font || this.utils.ancestor(node, this.utils.isSpan);
            if (!node) {
                continue;
            }
            $font = $(node);
            className = this.utils.orderClass(node);
            style = this.utils.orderStyle(node);
            if (!className && !style) {
                $(node).before($(node).contents());
                if (endPoint.node === node) {
                    endPoint = endPoint.prevUntil(function (point) {
                        return point.node !== node;
                    });
                }
                $(node).remove();

                nodes.splice(i, 1);
                i--;
                continue;
            }
            var prev = font && font.previousSibling;
            while (prev && !font.tagName && !this.utils.isVisibleText(prev)) {
                prev = prev.previousSibling;
            }
            if (prev &&
                font.tagName === prev.tagName &&
                className === this.utils.orderClass(prev) && style === this.utils.orderStyle(prev)) {
                $(prev).append($(font).contents());
                if (endPoint.node === font) {
                    endPoint = endPoint.prevUntil(function (point) {
                        return point.node !== font;
                    });
                }
                $(font).remove();

                nodes.splice(i, 1);
                i--;
                continue;
            }
        }

        // restore selection
        range = range.replace({
            sc: startPoint.node,
            so: startPoint.offset,
            ec: endPoint.node,
            eo: endPoint.offset,
        }).normalize();
        this.dependencies.Range.save(range);
    },
    /**
     * Get the "format" ancestors list of nodes.
     * In this context, a "format" node is understood as
     * an editable block or an editable element expecting text
     * (eg.: p, h1, span).
     *
     * @param {Node[]} nodes
     * @returns {Node[]}
     */
    filterFormatAncestors: function (nodes) {
        var self = this;
        var selectedNodes = [];
        _.each(this.utils.filterLeafChildren(nodes), function (node) {
            var ancestor = self.utils.ancestor(node, function (node) {
                return self.utils.isCell(node) || (
                    !self.options.isUnbreakableNode(node) &&
                    (self.utils.isFormatNode(node, self.options.styleTags) || self.utils.isNodeBlockType(node))
                ) && !self.utils.isEditable(node);
            });
            if (!ancestor) {
                ancestor = node;
            }
            if (self.utils.isCell(ancestor)) {
                ancestor = node;
            }
            if (ancestor && selectedNodes.indexOf(ancestor) === -1) {
                selectedNodes.push(ancestor);
            }
        });
        return selectedNodes;
    },
    /**
     * Format a 'format' block: change its tagName (eg: p -> h1).
     *
     * @param {string} tagName
     *       P, H1, H2, H3, H4, H5, H6, BLOCKQUOTE, PRE
     */
    formatBlock: function (tagName, range) {
        var self = this;
        if (
            !range ||
            !this.editable.contains(range.sc) ||
            !this.editable.contains(range.ec) ||
            this.options.isUnbreakableNode(range.sc)
        ) {
            return;
        }
        if (!range.isCollapsed()) {
            range = range.replace(this.dom.splitTextAtSelection(range));
        }
        var nodes = range.getSelectedNodes();
        nodes = this.filterFormatAncestors(nodes);
        if (!nodes.length) {
            var node = range.sc;
            if (node.tagName === 'BR' || this.utils.isText(node)) {
                node = node.parentNode;
            }
            nodes = [node];
        }
        var changedNodes = [];
        _.each(nodes, function (node) {
            var newNode = self.document.createElement(tagName);
            $(newNode).append($(node).contents());
            var attributes = $(node).prop("attributes");
            _.each(attributes, function (attr) {
                $(newNode).attr(attr.name, attr.value);
            });
            $(node).replaceWith(newNode);
            changedNodes.push(newNode);
        });

        // Select all formatted nodes
        if (changedNodes.length) {
            var lastNode = changedNodes[changedNodes.length - 1];
            var startNode = changedNodes[0].firstChild || changedNodes[0];
            var endNode = lastNode.lastChild || lastNode;
            range = range.replace({
                sc: startNode,
                so: 0,
                ec: endNode,
                eo: this.utils.nodeLength(endNode),
            });
            this.dependencies.Range.save(range);
        }
    },
    /**
     * (Un-)format text: make it bold, italic, ...
     *
     * @param {string} tag
     *       B, I, U, S, SUP, SUB
     */
    formatText: function (tag, range) {
        if (!range || !this.editable.contains(range.sc) || !this.editable.contains(range.ec)) {
            return;
        }
        if (range.isCollapsed()) {
            if (this.utils.isInTag(range.sc, tag)) {
                range = this._unformatTextCollapsed(range, tag);
            } else {
                range = this._formatTextCollapsed(range, tag);
            }
        } else {
            if (this._isAllSelectedInTag(range, tag)) {
                range = this._splitEndsOfSelection(range);
                range = this._unformatTextSelection(range, tag);
            } else {
                range = this._splitEndsOfSelection(range);
                range = this._formatTextSelection(range, tag);
            }
        }

        this.dependencies.Range.save(range);
    },
    /**
     * Remove format on the current range.
     *
     * @see _isParentRemoveFormatCandidate
     */
    removeFormat: function (value, range) {
        this._selectCurrentIfCollapsed(range);
        if (!range.isCollapsed()) {
            range.replace(this.dom.splitTextAtSelection(range));
        }
        var selectedText = range.getSelectedTextNodes(this.options.isEditableNode);
        var selectedIcons = this.utils.isIcon ? _.filter(range.getSelectedNodes(), this.utils.isIcon) : [];
        if (!selectedText.length && !selectedIcons.length) {
            return;
        }
        _.each(selectedIcons, this._removeIconFormat.bind(this));
        _.each(selectedText, this._removeTextFormat.bind(this));
        var startNode = selectedText[0];
        var endNode = selectedText[selectedText.length - 1];
        range = range.replace({
            sc: startNode,
            so: 0,
            ec: endNode,
            eo: this.utils.nodeLength(endNode),
        });
        this.dependencies.Range.save(range);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {WrappedRange} range
     * @returns {Boolean} true if the given button should be active
     */
    _active: function (buttonName, focusNode) {
        var self = this;
        var formatName = buttonName.split('-')[1].toUpperCase();
        switch (buttonName.split('-', 1)[0]) {
            case 'formatBlock':
                var formatBlockAncestor = this.utils.ancestor(focusNode, function (n) {
                    return self.utils.isFormatNode(n, self.options.styleTags);
                });
                if (!formatBlockAncestor) {
                    return buttonName === 'formatBlock-p';
                }
                return formatBlockAncestor.tagName === formatName ||
                    formatBlockAncestor.className.indexOf(formatName) !== -1;
            case 'formatText':
                if (formatName === 'remove') {
                    return false;
                }
                return !!this.utils.ancestor(focusNode, function (node) {
                    return node.tagName === formatName;
                });
        }
        return false;
    },
    _ancestorWithTag: function (node, tag) {
        return this.utils.ancestor(node, function (n) {
            return n.tagName === tag;
        });
    },
    /**
     * Applies the given styles (fore- or backcolor, font size)
     * to a given <font> node.
     *
     * @private
     * @param {Node} node
     * @param {string} color (hexadecimal or class name)
     * @param {string} bgcolor (hexadecimal or class name)
     * @param {integer} size
     * @returns {Node} the <font> node
     */
    _applyStylesToFontNode: function (node, color, bgcolor, size) {
        var className = node.className.split(this.utils.getRegex('space'));
        var k;
        if (color) {
            for (k = 0; k < className.length; k++) {
                if (className[k].length && className[k].slice(0, 5) === "text-") {
                    className.splice(k, 1);
                    k--;
                }
            }
            if (color === 'text-undefined') {
                node.className = className.join(" ");
                node.style.color = "inherit";
            } else if (color.indexOf('text-') !== -1) {
                node.className = className.join(" ") + " " + color;
                node.style.color = "inherit";
            } else {
                node.className = className.join(" ");
                node.style.color = color;
            }
        }
        if (bgcolor) {
            for (k = 0; k < className.length; k++) {
                if (className[k].length && className[k].slice(0, 3) === "bg-") {
                    className.splice(k, 1);
                    k--;
                }
            }

            if (bgcolor === 'bg-undefined') {
                node.className = className.join(" ");
                node.style.backgroundColor = "inherit";
            } else if (bgcolor.indexOf('bg-') !== -1) {
                node.className = className.join(" ") + " " + bgcolor;
                node.style.backgroundColor = "inherit";
            } else {
                node.className = className.join(" ");
                node.style.backgroundColor = bgcolor;
            }
        }
        if (size) {
            node.style.fontSize = "inherit";
            if (!isNaN(size) && Math.abs(parseInt(this.window.getComputedStyle(node).fontSize, 10) - size) / size > 0.05) {
                node.style.fontSize = size + "px";
            }
        }
        return node;
    },
    _containsOnlySelectedText: function (node, texts) {
        var self = this;
        return _.all(node.childNodes, function (n) {
            return _.any(texts, function (t) {
                return n === t && !(self.utils.isText(n) && n.textContent === '');
            }) && self._containsOnlySelectedText(n);
        });
    },
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled: function (buttonName, focusNode) {
        return !!this.utils.ancestor(focusNode, this.utils.isFormatNode.bind(this.utils));
    },
    /**
     * Apply the given format (tag) to the nodes in range, then update the range.
     *
     * @private
     * @param {String} tag eg: 'B', 'I', 'U'
     */
    _formatTextSelection: function (range, tag) {
        var self = this;
        var textNodes = range.getSelectedTextNodes(this.options.isEditableNode);

        var textNodesToFormat = this._nonFormattedTextNodes(range, tag);
        _.each(textNodesToFormat, function (textNode) {
            self._formatTextNode(textNode, tag);
            self._mergeSimilarSiblingsByTag(textNode, tag, 'prev');
        });

        return range.replace({
            sc: textNodes[0],
            so: 0,
            ec: textNodes[textNodes.length - 1],
            eo: this.utils.nodeLength(textNodes[textNodes.length - 1]),
        });
    },
    /**
     * Format the text at range position with given tag and make it ready for input
     * by inserting a zero-width character and updating the range.
     *
     * @private
     * @param {Boolean} tag eg: 'B', 'I', 'U'
     */
    _formatTextCollapsed: function (range, tag) {
        range = this._insertFormatPlaceholder(range);
        var formatNode = this.document.createElement(tag);
        $(range.sc).wrap(formatNode);
        return range.replace({
            sc: range.sc,
            so: 0,
            ec: range.sc,
            eo: 1,
        });
    },
    /**
     * Apply the given format (tag) on a given node.
     *
     * @private
     * @param {Node} node
     * @param {Boolean} tag eg: 'B', 'I', 'U'
     */
    _formatTextNode: function (node, tag) {
        var tagNode = this.document.createElement(tag);
        $(node).wrap(tagNode);
    },
    /**
     * Insert a zero-width text node at range so as to be able to format it,
     * then select its contents.
     *
     * @returns {WrappedRange}
     */
    _insertFormatPlaceholder: function (range) {
        var br;
        if (range.sc.tagName === 'BR') {
            br = range.sc;
        } else if (range.sc.firstChild && range.sc.firstChild.tagName === 'BR') {
            br = range.sc.firstChild;
        }
        if (br || this.utils.isText(range.sc)) {
            var emptyText = this.document.createTextNode(this.utils.char('zeroWidth'));
            $(br || range.sc.splitText(range.so)).before(emptyText);
            $(br).remove();
            range = this.dependencies.Range.setRange({
                sc: emptyText,
                so: 0,
                ec: emptyText,
                eo: 1,
            });
        } else {
            range = this.dom.insertTextInline(this.utils.char('zeroWidth'), range);
            range = this.dependencies.Range.setRange(range).normalize();
            this.dependencies.Range.save(range);
        }
        return range;
    },
    /**
     * Return true if all the text in range is contained in nodes with the given tag name.
     *
     * @private
     * @param {String} tag eg: 'B', 'I', 'U'
     * @returns {Boolean}
     */
    _isAllSelectedInTag: function (range, tag) {
        var self = this;
        var textNodes = range.getSelectedTextNodes(this.options.isEditableNode);
        return _.all(textNodes, function (textNode) {
            return self.utils.isInTag(textNode, tag);
        });
    },
    /**
     * Return true if the parent of the given node is a removeFormat candidate:
     * - It is a removeFormat candidate as defined by W3C
     * - It is contained within the editable area
     * - It is not unbreakable
     *
     * @see utils.formatTags the list of removeFormat candidates as defined by W3C
     *
     * @private
     * @param {Node} node
     */
    _isParentRemoveFormatCandidate: function (node) {
        var parent = node.parentNode;
        if (!parent) {
            return false;
        }
        var isEditableOrAbove = parent && (parent === this.editable || $.contains(parent, this.editable));
        var isUnbreakable = parent && this.options.isUnbreakableNode(parent);
        var isRemoveFormatCandidate = parent && parent.tagName && this.utils.formatTags.indexOf(parent.tagName.toLowerCase()) !== -1;
        return parent && !isEditableOrAbove && !isUnbreakable && isRemoveFormatCandidate;
    },
    /**
     * Remove the edge between the range's starting container and its previous sibling,
     * and/or between the range's ending container and its next sibling, if they have the
     * same tag name. Then update the range and normalize the DOM.
     *
     * eg: <b>hello</b><b> range </b><b>world</b> becomes <b>hello range world</b>
     *
     * @private
     * @returns {WrappedRange}
     */
    _mergeSimilarSiblingsAtRange: function (range) {
        var start = range.sc.tagName ? range.sc : range.sc.parentNode;
        var end = range.ec.tagName ? range.ec : range.ec.parentNode;
        var isSameAsPrevious = start.previousSibling && start.tagName === start.previousSibling.tagName;
        if (this.utils.isInline(start) && isSameAsPrevious) {
            range.so = this.utils.nodeLength(range.sc.previousSibling);
            $(range.sc).before($(range.sc.previousSibling).contents());
        }
        var isSameAsNext = end.nextSibling && end.tagName === end.nextSibling.tagName;
        if (this.utils.isInline(end) && isSameAsNext) {
            range.eo = this.utils.nodeLength(range.eo.nextSibling);
            $(range.ec).after($(range.ec.nextSibling).contents());
        }
        return range.replace(range.getPoints());
    },
    /**
     * Remove the edge between a given node and its previous/next neighbor
     * if they both have `tag` as tag name.
     * eg: <b>hello</b><b> node </b><b> world </b> becomes <b>hello node world</b>
     *
     * @private
     * @param {Node} node
     * @param {Boolean} tag eg: 'B', 'I', 'U'
     * @param {String('prev'|'next')} direction
     */
    _mergeSimilarSiblingsByTag: function (node, tag, direction) {
        var tagAncestor = this._ancestorWithTag(node, tag);
        var nextElem = tagAncestor && tagAncestor[direction === 'prev' ? 'previousElementSibling' : 'nextElementSibling'];
        if (nextElem && nextElem.tagName === tag) {
            this.dom.deleteEdge(tagAncestor, direction, true);
        }
    },
    /**
     * Return the list of selected text nodes that are not contained
     * within a node of given tag name.
     *
     * @private
     * @param {Boolean} tag eg: 'B', 'I', 'U'
     * @returns {Node []}
     */
    _nonFormattedTextNodes: function (range, tag) {
        var self = this;
        var textNodes = range.getSelectedTextNodes(this.options.isEditableNode);
        return _.filter(textNodes, function (textNode) {
            return !self.utils.isInTag(textNode, tag);
        });
    },
    /**
     * Remove a node's blank siblings if any.
     *
     * @private
     * @param {Node} node
     */
    _removeBlankSiblings: function (node) {
        var self = this;
        var toRemove = [];
        $(node).siblings().each(function () {
            if (self.utils.isBlankNode(this)) {
                toRemove.push(this);
            }
        });
        $(toRemove).remove();
    },
    /**
     * Remove an icon's format (colors, font size).
     *
     * @private
     * @param {Node} icon
     */
    _removeIconFormat: function (icon) {
        $(icon).css({
            color: '',
            backgroundColor: '',
            fontSize: '',
        });
        var reColorClasses = /(^|\s+)(bg|text)-\S*|/g;
        icon.className = icon.className.replace(reColorClasses, '').trim();
    },
    /**
     * Remove a text node's format: remove its style parents (b, i, u, ...).
     *
     * @private
     * @param {Node} textNode
     */
    _removeTextFormat: function (textNode) {
        var node = textNode;
        while (this._isParentRemoveFormatCandidate(node)) {
            this.dom.splitAtNodeEnds(node);
            $(node.parentNode).before(node).remove();
        }
    },
    /**
     * Select the whole current node if the range is collapsed
     *
     * @private
     */
    _selectCurrentIfCollapsed: function (range) {
        if (!range.isCollapsed()) {
            return;
        }
        range = this.dependencies.Range.setRange({
            sc: range.sc,
            so: 0,
            ec: range.sc,
            eo: this.utils.nodeLength(range.sc),
        });
        this.dependencies.Range.save(range);
    },
    /**
     * Split the text nodes at both ends of the range, then update the range.
     *
     * @private
     * @returns {WrappedRange}
     */
    _splitEndsOfSelection: function (range) {
        var sameNode = range.sc === range.ec;
        if (this.utils.isText(range.ec)) {
            range.ec = range.ec.splitText(range.eo).previousSibling;
            range.eo = this.utils.nodeLength(range.ec);
        }
        if (this.utils.isText(range.sc)) {
            range.sc = range.sc.splitText(range.so);
            if (sameNode) {
                range.ec = range.sc;
                range.eo -= range.so;
            }
            range.so = 0;
        }
        return range.replace(range.getPoints());
    },
    /**
     * Unformat the text in given nodes then update the range to
     * the full selection of the given nodes.
     *
     * @private
     * @param {Node []} nodes
     * @param {String} tag eg: 'B', 'I', 'U'
     * @returns {WrappedRange}
     */
    _unformatText: function (range, nodes, tag) {
        var self = this;
        _.each(nodes, function (node, index) {
            var tagParent = self._ancestorWithTag(node, tag);
            if (self._containsOnlySelectedText(tagParent, nodes)) {
                return self._unwrapContents(tagParent);
            }
            self._unformatTextNode(node, tag);
        });
        range = range.replace({
            sc: nodes[0],
            so: 0,
            ec: nodes[nodes.length - 1],
            eo: this.utils.nodeLength(nodes[nodes.length - 1]),
        });
        this._removeBlankSiblings(range.sc);
        return this._mergeSimilarSiblingsAtRange(range);
    },
    /**
     * Unformat the text at range position and make it ready for input
     * by inserting a zero-width character and updating the range.
     *
     * @private
     * @param {String} tag eg: 'B', 'I', 'U'
     * @returns {WrappedRange}
     */
    _unformatTextCollapsed: function (range, tag) {
        range = this._insertFormatPlaceholder(range);
        this.dom.splitAtNodeEnds(range.sc);
        var blankText = range.sc;
        return this._unformatText(range, [blankText], tag);
    },
    /**
     * Remove the given format (tag) of the given node.
     * This is achieved by splitting the tree around the given node up to
     * its ancestor of given tag, then unwrapping the contents of said ancestor.
     *
     * @private
     * @param {Node} node The node to unformat
     * @param {String} tag eg: 'B', 'I', 'U'
     */
    _unformatTextNode: function (node, tag) {
        var root = this._ancestorWithTag(node, tag);
        if (!root) {
            return;
        }
        var options = {
            isSkipPaddingBlankNode: true,
            isNotSplitEdgePoint: true,
        };
        var startPoint = this.getPoint(node, 0);

        this.dom.splitTree(root, startPoint, options);

        root = this._ancestorWithTag(node, tag);
        var endPoint = this.getPoint(node, this.utils.nodeLength(node));
        this.dom.splitTree(root, endPoint, options);

        this._unwrapContents(root);
    },
    /**
     * Unformat the text in range then update the range.
     *
     * @private
     * @param {String} tag eg: 'B', 'I', 'U'
     * @returns {WrappedRange}
     */
    _unformatTextSelection: function (range, tag) {
        var textNodes = range.getSelectedTextNodes(this.options.isEditableNode);
        return this._unformatText(range, textNodes, tag);
    },
    /**
     * Unwrap the contents of a given node and return said contents.
     *
     * @private
     * @param {Node} node
     * @returns {jQuery}
     */
    _unwrapContents: function (node) {
        var $contents = $(node).contents();
        $(node).before($contents).remove();
        return $contents;
    },
});

var ParagraphPlugin = AbstractPlugin.extend({
    dependencies: ['Range', 'FontStyle', 'List'],
    xmlDependencies: ['/web_editor/static/src/xml/wysiwyg_format_text.xml'],

    buttons: {
        template: 'wysiwyg.buttons.paragraph',
        active: '_active',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Change the paragraph alignment of a 'format' block.
     *
     * @param {string} style
     *       justifyLeft, justifyCenter, justifyRight, justifyFull
     */
    formatBlockStyle: function (style, range) {
        var self = this;
        if (!range.isCollapsed()) {
            range.replace(this.dom.splitTextAtSelection(range));
        }
        var nodes = range.getSelectedNodes();
        nodes = this.dependencies.FontStyle.filterFormatAncestors(nodes);
        var align = style === 'justifyLeft' ? 'left' :
            style === 'justifyCenter' ? 'center' :
            style === 'justifyRight' ? 'right' : 'justify';
        _.each(nodes, function (node) {
            if (self.utils.isText(node)) {
                return;
            }
            var textAlign = self.window.getComputedStyle(node).textAlign;
            if (align !== textAlign) {
                if (align !== self.window.getComputedStyle(node.parentNode).textAlign) {
                    $(node).css('text-align', align);
                } else {
                    $(node).css('text-align', '');
                }
            }
        });
        this.editable.normalize();
    },
    /**
     * Indent a node (list or format node).
     *
     * @returns {false|Node[]} contents of list/indented item
     */
    indent: function (range) {
        return this._indent(false, range);
    },
    /**
     * Outdent a node (list or format node).
     *
     * @returns {false|Node[]} contents of list/outdented item
     */
    outdent: function (range) {
        return this._indent(true, range);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {WrappedRange} range
     * @returns {Boolean} true if the given button should be active
     */
    _active: function (buttonName, focusNode) {
        var alignName = buttonName.split('-')[1];
        var cssAlign = $(focusNode).css('text-align');
        if (alignName == 'left' && !cssAlign) {
            return true;
        }
        return alignName === cssAlign;
    },
    /**
     * Indent or outdent a format node.
     *
     * @param {bool} outdent true to outdent, false to indent
     * @returns {false|[]Node} indented nodes
     */
    _indent: function (outdent, range) {
        if (!range) {
            return;
        }

        var self = this;
        var nodes = [];
        var isWithinElem;
        var ancestor = range.commonAncestor();
        var $dom = $(ancestor);

        if (!this.utils.isList(ancestor)) {
            // to indent a selection, we indent the child nodes of the common
            // ancestor that contains this selection
            $dom = $(ancestor.tagName ? ancestor : ancestor.parentNode).children();
        }

        // if selection is inside indented contents and outdent is true, we can outdent this node
        var indentedContent = outdent && this.utils.ancestor(ancestor, function (node) {
            var style = self.utils.isCell(node) ? 'paddingLeft' : 'marginLeft';
            return node.tagName && !!parseFloat(node.style[style] || 0);
        });

        if (indentedContent) {
            $dom = $(indentedContent);
        } else {
            // if selection is inside a list, we indent its list items
            $dom = $(this.utils.ancestor(ancestor, this.utils.isList));
            if (!$dom.length) {
                // if the selection is contained in a single HTML node, we indent
                // the first ancestor 'content block' (P, H1, PRE, ...) or TD
                $dom = $(range.sc).closest(this.options.styleTags.join(',') + ',td');
            }
        }

        // if select tr, take the first td
        $dom = $dom.map(function () {
            return this.tagName === "TR" ? this.firstElementChild : this;
        });

        $dom.each(function () {
            if (isWithinElem || $.contains(this, range.sc)) {
                if (self.utils.isList(this)) {
                    if (outdent) {
                        var type = this.tagName === 'OL' ? 'ol' : (this.className && this.className.indexOf('o_checklist') !== -1 ? 'checklist' : 'ul');
                        isWithinElem = self.dependencies.List.convertList(isWithinElem, nodes, range.getStartPoint(), range.getEndPoint(), type);
                    } else {
                        isWithinElem = self._indentUL(isWithinElem, nodes, this, range.sc, range.ec);
                    }
                } else if (self.utils.isFormatNode(this, self.options.styleTags) || self.utils.ancestor(this, self.utils.isCell)) {
                    isWithinElem = self._indentFormatNode(outdent, isWithinElem, nodes, this, range.sc, range.ec);
                }
            }
        });

        if ($dom.parent().length) {
            var $parent = $dom.parent();

            // remove text nodes between lists
            var $ul = $parent.find('ul, ol');
            if (!$ul.length) {
                $ul = $(this.utils.ancestor(range.sc, this.utils.isList));
            }
            $ul.each(function () {
                var notWhitespace = /\S/;
                if (
                    this.previousSibling &&
                    this.previousSibling !== this.previousElementSibling &&
                    !this.previousSibling.textContent.match(notWhitespace)
                ) {
                    this.parentNode.removeChild(this.previousSibling);
                }
                if (
                    this.nextSibling &&
                    this.nextSibling !== this.nextElementSibling &&
                    !this.nextSibling.textContent.match(notWhitespace)
                ) {
                    this.parentNode.removeChild(this.nextSibling);
                }
            });

            // merge same ul or ol
            $ul.prev('ul, ol').each(function () {
                self.dom.deleteEdge(this, 'next');
            });

        }

        range = this.dependencies.Range.setRange(range.getPoints()).normalize();
        this.dependencies.Range.save(range);

        return !!nodes.length && nodes;
    },
    /**
     * Indent several LIs in a list.
     *
     * @param {bool} isWithinElem true if selection already inside the LI
     * @param {Node[]} nodes
     * @param {Node} UL
     * @param {Node} start
     * @param {Node} end
     * @returns {bool} isWithinElem
     */
    _indentUL: function (isWithinElem, nodes, UL, start, end) {
        var next;
        var tagName = UL.tagName;
        var node = UL.firstChild;
        var ul = document.createElement(tagName);
        ul.className = UL.className;
        var flag;

        if (isWithinElem) {
            flag = true;
        }

        // create and fill ul into a li
        while (node) {
            if (flag || node === start || $.contains(node, start)) {
                isWithinElem = true;
                node.parentNode.insertBefore(ul, node);
            }
            next = node.nextElementSibling;
            if (isWithinElem) {
                ul.appendChild(node);
                nodes.push(node);
            }
            if (node === end || $.contains(node, end)) {
                isWithinElem = false;
                break;
            }
            node = next;
        }

        var temp;
        var prev = ul.previousElementSibling;
        if (
            prev && prev.tagName === "LI" &&
            (temp = prev.firstElementChild) && temp.tagName === tagName &&
            ((prev.firstElementChild || prev.firstChild) !== ul)
        ) {
            $(prev.firstElementChild || prev.firstChild).append($(ul).contents());
            $(ul).remove();
            ul = prev;
            ul.parentNode.removeChild(ul.nextElementSibling);
        }
        next = ul.nextElementSibling;
        if (
            next && next.tagName === "LI" &&
            (temp = next.firstElementChild) && temp.tagName === tagName &&
            (ul.firstElementChild !== next.firstElementChild)
        ) {
            $(ul.firstElementChild).append($(next.firstElementChild).contents());
            $(next.firstElementChild).remove();
            ul.parentNode.removeChild(ul.nextElementSibling);
        }

        // wrap in li
        var li = this.document.createElement('li');
        li.className = 'o_indent';
        $(ul).before(li);
        li.appendChild(ul);

        return isWithinElem;
    },
    /**
     * Outdent a container node.
     *
     * @param {Node} node
     * @returns {float} margin
     */
    _outdentContainer: function (node) {
        var style = this.utils.isCell(node) ? 'paddingLeft' : 'marginLeft';
        var margin = parseFloat(node.style[style] || 0) - 1.5;
        node.style[style] = margin > 0 ? margin + "em" : "";
        return margin;
    },
    /**
     * Indent a container node.
     *
     * @param {Node} node
     * @returns {float} margin
     */
    _indentContainer: function (node) {
        var style = this.utils.isCell(node) ? 'paddingLeft' : 'marginLeft';
        var margin = parseFloat(node.style[style] || 0) + 1.5;
        node.style[style] = margin + "em";
        return margin;
    },
    /**
     * Indent/outdent a format node.
     *
     * @param {bool} outdent true to outdent, false to indent
     * @param {bool} isWithinElem true if selection already inside the element
     * @param {DOM[]} nodes
     * @param {DOM} p
     * @param {DOM} start
     * @param {DOM} end
     * @returns {bool} isWithinElem
     */
    _indentFormatNode: function (outdent, isWithinElem, nodes, p, start, end) {
        if (p === start || $.contains(p, start) || $.contains(start, p)) {
            isWithinElem = true;
        }
        if (isWithinElem) {
            nodes.push(p);
            if (outdent) {
                this._outdentContainer(p);
            } else {
                this._indentContainer(p);
            }
        }
        if (p === end || $.contains(p, end) || $.contains(end, p)) {
            isWithinElem = false;
        }
        return isWithinElem;
    },
});

Manager.addPlugin('Text', TextPlugin);
Manager.addPlugin('ForeColor', ForeColorPlugin);
Manager.addPlugin('BgColor', BgColorPlugin);
Manager.addPlugin('FontSize', FontSizePlugin);
Manager.addPlugin('FontStyle', FontStylePlugin);
Manager.addPlugin('Paragraph', ParagraphPlugin);

return {
    ForeColor: ForeColorPlugin,
    BgColor: BgColorPlugin,
    FontSize: FontSizePlugin,
    FontStyle: FontStylePlugin,
    Paragraph: ParagraphPlugin,
};

});
