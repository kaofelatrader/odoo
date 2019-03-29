odoo.define('web_editor.wysiwyg.plugin.textFormat', function (require) {
'use strict';

var ColorpickerDialog = require('wysiwyg.widgets.ColorpickerDialog');
var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');


//--------------------------------------------------------------------------
// Font (colorpicker & font-size)
//--------------------------------------------------------------------------

var TextPlugin = AbstractPlugin.extend({
    dependencies: ['Range'],

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

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
    /**
     * Applies the given styles (fore- or backcolor, font size) to the selection.
     * If no text is selected, apply to the current text node, if any.
     *
     * @param {string} color (hexadecimal or class name)
     * @param {string} bgcolor (hexadecimal or class name)
     * @param {integer} size
     * @param {WrappedRange} range
     */
    applyFont: function (color, bgcolor, size, range) {
        if (!range || !this.editable.contains(range.sc) || !this.editable.contains(range.ec)) {
            return;
        }
        if (range.isCollapsed() && this.utils.isText(range.sc)) {
            this._applyFontCollapsed(color, bgcolor, size, range);
        } else {
            this._applyFontToSelection(color, bgcolor, size, range);
        }
        this.dependencies.Range.save(range);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Applies the given styles (fore- or backcolor, font size) at collapsed range.
     *
     * @private
     * @param {String} [color]
     * @param {String} [bgcolor]
     * @param {Number} [size]
     * @param {WrappedRange} range
     */
    _applyFontCollapsed: function (color, bgcolor, size, range) {
        this._splitBeforeApplyFont(range);
        var zwcNode = document.createTextNode(this.utils.char('zeroWidth'));
        range.sc.parentNode.insertBefore(zwcNode, range.sc);
        var font = this._applyStylesToNode(zwcNode, color, bgcolor, size);
        range.replace({
            sc: font,
            so: 1,
        });
    },
    /**
     * Applies the given styles (fore- or backcolor, font size) to the selection.
     *
     * @private
     * @param {String} [color]
     * @param {String} [bgcolor]
     * @param {Number} [size]
     * @param {WrappedRange} range
     */
    _applyFontToSelection: function (color, bgcolor, size, range) {
        var self = this;
        this._splitBeforeApplyFont(range);
        range.getSelectedNodes(function (node) {
            return self.utils.isVisibleText(node) || self.dependencies.Common.isVoidBlock(node);
        }).forEach(function (node) {
            // Can we safely get rid of this ? Why was it there ?
            //
            // var reStartAndEndSpaceG = self.utils.getRegex('startAndEndSpace', 'g');
            // var nbsp = self.utils.char('nbsp');
            // node.textContent = node.textContent.replace(reStartAndEndSpaceG, nbsp); // TODO: MOVE!
            this._applyStylesToNode(node, color, bgcolor, size);
        }, this);
        this._cleanRangeAfterStyle(range);
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
    /**
     * Apply the given styles to a node's parent font node or wrap it in a new
     * font node with the given styles. Return the font node.
     *
     * @private
     * @param {Node} node
     * @param {String} color
     * @param {String} bgcolor 
     * @param {Number} size
     * @returns {Node}
     */
    _applyStylesToNode: function (node, color, bgcolor, size) {
        var font = this._getFormattableAncestor(node) || this._wrapInFontNode(node);
        this._applyStylesToFontNode(font, color, bgcolor, size);
        this._removeEmptyStyles(font);
        return font;
    },
    /**
     * Remove node without attributes (move content), and merge the same nodes
     *
     * @private
     * @param {WrappedRange} range
     */
    _cleanRangeAfterStyle: function (range) {
        var self = this;
        this._moveRangeToDeepUntil(range, function (n) {
            return self.dependencies.Common.isEditableNode(n) && !self.dependencies.Common.isVoidBlock(n);
        });
        range.getSelectedNodes(function (node) {
            return self.utils.isVisibleText(node) || self.dependencies.Common.isVoidBlock(node);
        }).forEach(function (node) {
            self._cleanNodeAfterStyle(node, range);
        });
        range.normalize();
    },
    /**
     * Clean a node after applying styles:
     * - Remove it if it has no attributes
     * - Merge adjacent nodes with the same tagName
     * and adapt the range according to changes.
     *
     * @private
     * @param {Node} node
     * @param {WrappedRange} range
     */
    _cleanNodeAfterStyle: function (node, range) {
        if (this.utils.isText(node) && !this.utils.isVisibleText(node)) {
            return;
        }
        node = this._getFormattableAncestor(node) || this.utils.ancestor(node, this.utils.isSpan);
        return !node || this._moveNodeWithoutAttr(node, range) ||
            this._mergeFontAncestorsIfSimilar(node, range);
    },
    /**
     * Get the deepest start/end point at range until predicate hit.
     *
     * @private
     * @param {WrappedRange} range
     * @param {Function (Node) => Boolean} pred
     * @param {Boolean} isEndPoint
     * @returns {BoundaryPoint}
     */
    _getDeepPointUntil: function (range, pred, isEndPoint) {
        pred = pred.bind(this);
        var point = range[isEndPoint ? 'getEndPoint' : 'getStartPoint']().enter();
        var isOnEdge = isEndPoint ? point.offset === this.utils.nodeLength(point.node) : !point.offset;
        if (!this.utils.isText(point.node) && isOnEdge) {
            point.node = this.utils.firstLeafUntil(point.node.childNodes[point.offset] || point.node, pred);
            point.offset = isEndPoint ? this.utils.nodeLength(point.node) : 0;
        }
        return point;
    },
    /**
     * Return the last ancestor that is a FONT node.
     *
     * @private
     * @param {Node} node
     * @returns {Node}
     */
    _getFormattableAncestor: function (node) {
        var self = this;
        return this.utils.lastAncestor(node, function (n) {
            return n.tagName && self.utils.formatTags.indexOf(n.tagName.toLowerCase()) !== -1;
        });
    },
    /**
     * Get `node`'s previous sibling that is visible text or element, if any.
     *
     * @private
     * @param {Node} node
     * @returns {Node|undefined}
     */
    _getPreviousVisibleNode: function (node) {
        var prev = node && node.previousSibling;
        while (prev && this.utils.isText(prev) && !this.utils.isVisibleText(prev)) {
            prev = prev.previousSibling;
        }
        return prev;
    },
    /**
     * Merge `node`'s last <font> ancestor with its sibling
     * if they have the same classes, styles and tagNames.
     * Then adapt the range according to changes.
     * Return true if the nodes were merged.
     *
     * @private
     * @param {Node} node
     * @param {WrappedRange} range
     * @returns {Boolean}
     */
    _mergeFontAncestorsIfSimilar: function (node, range) {
        var endPoint = range.getEndPoint();
        var font = this._getFormattableAncestor(node);
        var prev = this._getPreviousVisibleNode(font);
        var className = this.utils.orderClass(node);
        var style = this.utils.orderStyle(node);
        if (!prev ||
            font.tagName !== prev.tagName ||
            className !== this.utils.orderClass(prev) ||
            style !== this.utils.orderStyle(prev)) {
            return false;
        }
        $(prev).append($(font).contents());
        if (range.ec === font) {
            endPoint.prevUntil(function (point) {
                return point.node !== font;
            });
            range.ec = endPoint.node;
            range.eo = endPoint.offset;
        }
        $(font).remove();
        return true;
    },
    /**
     * If `node` has no class or style, move its contents before itself,
     * then remove the node. Adapt the range accord to changes.
     * Return true if the node was indeed removed.
     *
     * @private
     * @param {Node} node
     * @param {WrappedRange} range
     * @returns {Boolean}
     */
    _moveNodeWithoutAttr: function (node, range) {
        var endPoint = range.getEndPoint();
        var className = this.utils.orderClass(node);
        var style = this.utils.orderStyle(node);
        if (className || style) {
            return false;
        }
        $(node).before($(node).contents());
        if (range.ec === node) {
            endPoint.prevUntil(function (point) {
                return point.node !== node;
            });
            range.ec = endPoint.node;
            range.eo = endPoint.offset;
        }
        $(node).remove();
        return true;
    },
    /**
     * Move the range to its deepest start/end points until predicate hit.
     *
     * @private
     * @param {WrappedRange} range
     * @param {Function (Node) => Boolean} pred
     */
    _moveRangeToDeepUntil: function (range, pred) {
        var startPoint = this._getDeepPointUntil(range, pred);
        var endPoint = this._getDeepPointUntil(range, pred, true);
        range.replace({
            sc: startPoint.node,
            so: startPoint.offset,
            ec: endPoint.node,
            eo: endPoint.offset,
        });
    },
    /**
     * Remove a node's empty styles.
     * Note: We have to remove the value in 2 steps (apply inherit then remove)
     * because of behavior differences between browsers.
     *
     * @private
     * @param {Node} node
     */
    _removeEmptyStyles: function (node) {
        ['color', 'backgroundColor', 'fontSize'].forEach(function (styleName) {
            if (node.style[styleName] === 'inherit') {
                node.style[styleName] = '';
            }
        });
        if (node.style.color === '' && node.style.backgroundColor === '' && node.style.fontSize === '') {
            node.removeAttribute("style");
        }
        if (!node.className.length) {
            node.removeAttribute("class");
        }
    },
    /**
     * Split the DOM tree if necessary in order to apply a font on a selection,
     * then adapt the range.
     *
     * @private
     * @param {WrappedRange} range
     */
    _splitBeforeApplyFont: function (range) {
        var ancestor;
        var node;
        if (!range.isCollapsed()) {
            if (range.eo !== this.utils.nodeLength(range.ec)) {
                ancestor = this._getFormattableAncestor(range.ec) || range.ec;
                this.dom.splitTree(ancestor, range.getEndPoint().enter());
            }
            if (range.so) {
                ancestor = this._getFormattableAncestor(range.sc) || range.sc;
                node = this.dom.splitTree(ancestor, range.getStartPoint().enter());
                if (range.ec === range.sc) {
                    range.ec = node;
                    range.eo = this.utils.nodeLength(node);
                }
                range.sc = node;
                range.so = 0;
            }
        } else {
            ancestor = this._getFormattableAncestor(range.sc);
            if (ancestor) {
                node = this.dom.splitTree(ancestor, range.getStartPoint(), {
                    isSkipPaddingBlankNode: this.dependencies.Common.isVoidBlock(ancestor),
                });
            } else {
                node = range.sc.splitText(range.so);
            }
            range.replace({
                sc: node,
                so: 0,
            });
        }
    },
    /**
     * Create a FONT node and wrap `node` in it, then return the font node.
     *
     * @private
     * @param {Node} node
     * @returns {Node}
     */
    _wrapInFontNode: function (node) {
        var font = document.createElement('font');
        node.parentNode.insertBefore(font, node);
        font.appendChild(node);
        return font;
    },
});

var ForeColorPlugin = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_colorpicker.xml'],
    dependencies: ['Range', 'Text'],

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
                console.log('COLOR to load');
            this._initializePromise = this.options.getColors().then(function (colors) {
                console.log('COLOR');
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
        if (!color || color.startsWith('#')) {
            color = color || '';
            $(range.sc).css('color', color);
        } else {
            $(range.sc).addClass('text-' + color);
        }
        this.dependencies.Text.applyFont(color || 'text-undefined', null, null, range);
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
            while (this.editable !== focusNode && document !== focusNode) {
                if (focusNode.style && focusNode.style.color !== '') {
                    break;
                }
                focusNode = focusNode.parentNode;
            }
            return document !== focusNode && colorName === $(focusNode).css('color');
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
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_colorpicker.xml'],
    dependencies: ['Text'],

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
        if (!color || color.startsWith('#')) {
            color = color || '';
            $(range.sc).css('background-color', color);
        } else {
            $(range.sc).addClass('bg-' + color);
        }
        this.dependencies.Text.applyFont(null, color || 'bg-undefined', null, range);
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
            while (this.editable !== focusNode && document !== focusNode) {
                if (focusNode.style && focusNode.style.backgroundColor !== '') {
                    break;
                }
                focusNode = focusNode.parentNode;
            }
            return document !== focusNode && colorName === $(focusNode).css('background-color');
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
    dependencies: ['Text'],
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_format_text.xml'],

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
        this.dependencies.Text.applyFont(null, null, fontsize || 'inherit', range);
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
        focusNode = this.utils.isText(focusNode) ? focusNode.parentNode : focusNode;
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
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_format_text.xml'],

    buttons: {
        template: 'wysiwyg.buttons.fontstyle',
        active: '_active',
        enabled: '_enabled',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

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
                    !self.dependencies.Common.isUnbreakableNode(node) &&
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
            this.dependencies.Common.isUnbreakableNode(range.sc)
        ) {
            return;
        }
        if (!range.isCollapsed()) {
            range = range.replace(this.dom.splitTextAtSelection(range));
        }
        var nodes = range.getSelectedNodes(function (node) {
            return self.utils.isVisibleText(node) || self.dependencies.Common.isVoidBlock(node);
        });
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
            var newNode = document.createElement(tagName);
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
            range.collapse(); // Invisible character doesn't need to be selected
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
        var self = this;
        var Common = this.dependencies.Common;
        this._selectCurrentIfCollapsed(range);
        if (!range.isCollapsed()) {
            range.replace(this.dom.splitTextAtSelection(range));
        }
        var selectedText = range.getSelectedTextNodes(function (node) {
            return Common.isEditableNode(node) && (Common.isVoidBlock(node) || self.utils.isVisibleText(node));
        });
        var selectedVoids = range.getSelectedNodes(Common.isVoidBlock.bind(Common)) || [];
        if (!selectedText.length && !selectedVoids.length) {
            return;
        }
        var selection = this.utils.uniq(selectedText.concat(selectedVoids));
        _.each(selection, function (node) {
            self._removeFormatAncestors(node);
            self._removeNodeStyles(node);
        });
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

        var textNodesToFormat = this._nonFormattedTextNodes(range, tag);
        var rest = [];
        _.each(textNodesToFormat, function (textNode) {
            self._formatTextNode(textNode, tag);
            rest.push(self._mergeSimilarSiblingsByTag(textNode, tag, true));
        });

        return range.replace({
            sc: rest[0],
            so: 0,
            ec: rest[rest.length - 1],
            eo: this.utils.nodeLength(rest[rest.length - 1]),
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
        var formatNode = document.createElement(tag);
        $(range.sc).wrap(formatNode);
        return range.replace({
            sc: range.sc,
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
        var tagNode = document.createElement(tag);
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
            var emptyText = document.createTextNode(this.utils.char('zeroWidth'));
            $(br || range.sc.splitText(range.so)).before(emptyText);
            $(br).remove();
            range = this.dependencies.Range.setRange({
                sc: emptyText,
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
        var Common = this.dependencies.Common;
        var textNodes = range.getSelectedTextNodes(function (node) {
            return Common.isEditableNode(node) && (Common.isVoidBlock(node) || self.utils.isVisibleText(node));
        });
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
        var isUnbreakable = parent && this.dependencies.Common.isUnbreakableNode(parent);
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
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @returns {Node}
     */
    _mergeSimilarSiblingsByTag: function (node, tag, isPrev) {
        var rest = node;
        var tagAncestor = this._ancestorWithTag(node, tag);
        var nextElem = tagAncestor && tagAncestor[isPrev ? 'previousElementSibling' : 'nextElementSibling'];
        if (nextElem && nextElem.tagName === tag) {
            rest = this.dom.deleteEdge(tagAncestor, isPrev, {
                isRemoveBlock: false,
                isTryNonSim: false,
            }).node;
        }
        return rest;
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
        var Common = this.dependencies.Common;
        var textNodes = range.getSelectedTextNodes(function (node) {
            return Common.isEditableNode(node) && (Common.isVoidBlock(node) || self.utils.isVisibleText(node));
        });
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
        var Common = this.dependencies.Common;
        $(node).siblings().each(function () {
            if (self.utils.isBlankNode(this, Common.isVoidBlock.bind(Common))) {
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
     * Remove node's format: remove its format ancestors (b, i, u, ...).
     *
     * @see _isParentRemoveFormatCandidate (the format ancestors)
     * @private
     * @param {Node} textNode
     */
    _removeFormatAncestors: function (node) {
        while (this._isParentRemoveFormatCandidate(node) &&
            !this.dependencies.Common.isVoidBlock(node)) {
            this.dom.splitAtNodeEnds(node);
            $(node.parentNode).before(node).remove();
        }
    },
    _removeNodeStyles: function (node) {
        if (this.utils.isText(node)) {
            return;
        }
        $(node).css({
            color: '',
            backgroundColor: '',
            fontSize: '',
        });
        var reColorClasses = /(^|\s+)(bg|text)-\S*|/g;
        node.className = node.className.replace(reColorClasses, '').trim();
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
            if (tagParent && self._containsOnlySelectedText(tagParent, nodes)) {
                return self._unwrapContents(tagParent);
            }
            self._unformatTextNode(node, tag);
        });
        range.replace({
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
        var startPoint = this.utils.isText(node) ? this.getPoint(node, 0) : this.getPoint(node.parentNode, $(node).index());

        this.dom.splitTree(root, startPoint, options);

        root = this._ancestorWithTag(node, tag);
        var endPoint = this.utils.isText(node) ? this.getPoint(node, this.utils.nodeLength(node)) : this.getPoint(node.parentNode, startPoint.offset + 1);
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
        var self = this;
        var Common = this.dependencies.Common;
        var textNodes = range.getSelectedTextNodes(function (node) {
            return Common.isEditableNode(node) && (Common.isVoidBlock(node) || self.utils.isVisibleText(node));
        });
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
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_format_text.xml'],

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
     * @param {string} align
     *       left, center, right, justify
     */
    align: function (align, range) {
        var self = this;
        if (!range.isCollapsed()) {
            range.replace(this.dom.splitTextAtSelection(range));
        }
        var nodes = range.getSelectedNodes(function (node) {
            return self.utils.isVisibleText(node) || self.dependencies.Common.isVoidBlock(node);
        });
        nodes = this.dependencies.FontStyle.filterFormatAncestors(nodes);
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
    indent: function (value, range) {
        return this._indent(false, range);
    },
    /**
     * Outdent a node (list or format node).
     *
     * @returns {false|Node[]} contents of list/outdented item
     */
    outdent: function (value, range) {
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
        focusNode = this.utils.isText(focusNode) ? focusNode.parentNode : focusNode;
        var alignedAncestor = focusNode;
        var cssAlign = alignedAncestor.style.textAlign;
        while (alignedAncestor && alignedAncestor !== this.editable && !cssAlign) {
            cssAlign = alignedAncestor.style.textAlign;
            alignedAncestor = alignedAncestor.parentNode;
        }
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
                self.dom.deleteEdge(this, false);
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
        var li = document.createElement('li');
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
