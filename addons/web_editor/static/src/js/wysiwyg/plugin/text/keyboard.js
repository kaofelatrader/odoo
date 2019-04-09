odoo.define('web_editor.wysiwyg.plugin.keyboard', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var KeyboardPlugin = AbstractPlugin.extend({
    dependencies: ['Range', 'Paragraph', 'Link', 'History', 'Table'], // TODO: Remove dependencies

    editableDomEvents: {
        'keydown': '_onKeydown',
        'textInput': '_onTextInput',
        'DOMNodeInserted editable': '_removeGarbageSpans',
    },
    tab: '\u00A0\u00A0\u00A0\u00A0',

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Handle TAB keydown event.
     *
     * @param {Boolean} [untab] true for shift+tab
     */
    handleTab: function (untab) {
        var range = this.dependencies.Range.getRange();
        var point = range.getStartPoint();
        var startSpace = this.utils.getRegex('startSpace');

        // In table, on tab switch to next cell
        if (range.isOnCell()) {
            var nextCell = this.dependencies.Table[untab ? 'prev' : 'next'](null, range);
            if (!nextCell) {
                return;
            }
            var elementChild = nextCell[untab ? 'lastElementChild' : 'firstElementChild'];
            var nextText = this.utils[untab ? 'lastLeaf' : 'firstLeaf'](elementChild || nextCell);
            range.replace({
                sc: nextText,
                so: untab ? this.utils.nodeLength(nextText) : 0,
            });
            this.dependencies.Range.setRange(range);
            this.dependencies.Range.save();
            return;
        }
        // If on left edge point: indent/outdent
        if (this.utils.isText(point.node)) { // Clean up start spaces on textNode
            point.node.textContent.replace(startSpace, function (startSpaces) {
                point.offset = startSpaces.length === point.offset ? 0 : point.offset;
                return '';
            });
        }
        if (point.isLeftEdgeOfBlock() || this.utils.isEmpty(point.node)) {
            this.dependencies.Paragraph[untab ? 'outdent' : 'indent'](null, range);
            this.dependencies.Range.getRange().normalize();
            return;
        }
        // Otherwise insert a tab or do nothing
        if (!untab) {
            this._insertTab();
            this.dependencies.Range.getRange().normalize();
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Handle the recording of history steps on character input.
     *
     * @param {String} key
     */
    _handleCharInputHistory: function (key) {
        var self = this;

        clearTimeout(this.lastCharIsVisibleTime);

        var stopChars = [' ', ',', ';', ':', '?', '.', '!'];
        var history = this.dependencies.History.getHistoryStep();

        var isStopChar = stopChars.indexOf(key) !== -1;
        var isTopOfHistoryStack = !history || history.stack.length ||
            history.stackOffset >= history.stack.length - 1;

        if (isStopChar || !isTopOfHistoryStack) {
            this.lastCharVisible = false;
        }
        this.lastCharIsVisibleTime = setTimeout(function () {
            self.lastCharIsVisible = false;
        }, 500);
        if (!this.lastCharIsVisible) {
            this.lastCharIsVisible = true;
            this.dependencies.History.recordUndo();
        }
    },
    /**
     * Handle deletion (BACKSPACE / DELETE).
     *
     * @private
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @returns {Boolean} true if case handled
     */
    _handleDeletion: function (isPrev) {
        var range = this.dependencies.Range.getRange();
        var didDeleteNodes = !range.isCollapsed();
        var point = this.dom.deleteSelection(range);
        range = this.dependencies.Range.setRange({
            sc: point.node,
            so: point.offset,
        });
        var wasOnStartOfBR = isPrev && !range.so && range.sc.tagName === 'BR';

        this._removeNextEmptyUnbreakable(range.sc);
        var temp = this._beforeDeletion(range, isPrev, didDeleteNodes);
        didDeleteNodes = temp.didDeleteNodes;
        range = temp.range;
        isPrev = temp.isPrev;

        if (!didDeleteNodes) {
            var rangePoint = this._performDeletion(range, isPrev, wasOnStartOfBR);
            didDeleteNodes = !!rangePoint;
            if (didDeleteNodes) {
                range.replace({
                    sc: rangePoint.node,
                    so: rangePoint.offset,
                });
            }
        }

        range = this._afterDeletion(range, isPrev, !didDeleteNodes);

        this.dependencies.Range.setRange(range.getPoints()).collapse(isPrev);
        this.editable.normalize();
        return didDeleteNodes;
    },
    /**
     * Handle ENTER.
     *
     * @private
     * @returns {Boolean} true if case handled
     */
    _handleEnter: function () {
        var self = this;
        var range = this.dependencies.Arch.getRange();
        var startArchNode = this.dependencies.Arch.manager.getNode(range.start.id);

        var ancestor = startArchNode.ancestor(function () {
            return this.isLi() || this.parent && this.parent.isUnbreakable() && !this.parent.isContentEditable() ||
                this.isNodeBlockType() && !this.ancestor(this.isLi);
        });

        if (
            this.utils.isLi(ancestor) && !$(ancestor.parentNode).hasClass('list-group') &&
            this.utils.getRegexBlank({
                space: true,
                newline: true,
            }).test(ancestor.textContent) &&
            $(ancestor).find('br').length <= 1 &&
            !$(ancestor).find('.fa, img').length
        ) {
            // double enter in a list make oudent
            this.dependencies.Paragraph.outdent(null, range);
            return true;
        }

        var btn = this.utils.ancestor(range.sc, function (n) {
            return $(n).hasClass('btn');
        });

        var point = range.getStartPoint();

        if (this.utils.isText(point.node) && this.dependencies.Arch.isUnbreakableNode(point.node.parentNode)) {
            return this._handleShiftEnter();
        }

        if (!this.utils.isText(point.node) && point.node.childNodes[point.offset] && point.node.childNodes[point.offset].tagName === "BR") {
            point = point.next();
        }
        if (point.node.tagName === "BR") {
            point = point.next();
        }

        var isSkipPaddingBlankNode = this.utils.isEditable(ancestor) ||
            (!this.utils.isNodeBlockType(point.node.parentNode) && !!point.node.parentNode.nextSibling);
        var next = this.dom.splitTree(ancestor, point, {
            isSkipPaddingBlankNode: isSkipPaddingBlankNode,
        });
        while (next.firstChild) {
            next = next.firstChild;
        }

        // if there is no block in the split parents, then we add a br between the two node
        var hasSplitBlock = false;
        var node = next;
        var lastChecked = node;
        while (node && node !== ancestor && node !== this.editable) {
            if (this.utils.isNodeBlockType(node)) {
                hasSplitBlock = true;
                break;
            }
            lastChecked = node;
            node = node.parentNode;
        }
        if (!hasSplitBlock && !this.utils.isText(lastChecked)) {
            $(lastChecked).before(document.createElement('br'));
        }

        if (this.utils.isText(next)) {
            this.dom.secureExtremeSingleSpace(next);
        }
        if (next.tagName !== "BR" && next.innerHTML === "") {
            next.innerHTML = this.utils.char('zeroWidth');
        }
        if (ancestor && !this.utils.isEditable(ancestor)) {
            var firstChild = this.utils.firstLeafUntil(ancestor, function (n) {
                return !self.dependencies.Arch.isVoidBlock(n) && self.dependencies.Arch.isEditableNode(n);
            });
            var lastChild = this.utils.lastLeafUntil(ancestor, function (n) {
                return !self.dependencies.Arch.isVoidBlock(n) && self.dependencies.Arch.isEditableNode(n);
            });
            if (this.utils.isBlankNode(ancestor, this.dependencies.Arch.isVoidBlock)) {
                firstChild = this.utils.isText(firstChild) ? firstChild.parentNode : firstChild;
                $(firstChild).contents().remove();
                $(firstChild).append(document.createElement('br'));
            }
            if (lastChild.tagName === 'BR' && lastChild.previousSibling) {
                $(lastChild).after(this.document.createTextNode(this.utils.char('zeroWidth')));
            }
        }

        // move to next editable area
        point = this.getPoint(next, 0);
        if (
            (!this.utils.isText(point.node) && point.node.tagName !== 'BR') ||
            this.utils.isInvisibleText(point.node)
        ) {
            point = point.nextUntil(function (pt) {
                if (pt.node === point.node) {
                    return false;
                }
                return (
                        pt.node.tagName === "BR" ||
                        self.utils.isVisibleText(pt.node)
                    ) &&
                    self.dependencies.Arch.isEditableNode(pt.node);
            });
            point = point || this.getPoint(next, 0);
            if (point.node.tagName === "BR") {
                point = point.next();
            }
        }

        // if the left part of the split node ends with a space, replace that space with nbsp
        if (range.sc.textContent) {
            var endSpace = this.utils.getRegex('endSpace');
            range.sc.textContent = range.sc.textContent.replace(endSpace,
                function (trailingSpaces) {
                    return Array(trailingSpaces.length + 1).join(self.utils.char('nbsp'));
                }
            );
        }

        // On buttons, we want to split the button and move to the beginning of it
        if (btn) {
            next = this.utils.ancestor(point.node, function (n) {
                return $(n).hasClass('btn');
            });

            // Move carret to the new button
            range = this.dependencies.Range.setRange({
                sc: next.firstChild,
                so: 0
            });

            // Force content in empty buttons, the carret can be moved there
            this.dependencies.Link.fillEmptyLink(next);
            this.dependencies.Link.fillEmptyLink(btn);

            // Move carret to the new button
            range = this.dependencies.Range.setRange({
                sc: next.firstChild,
                so: 0,
            });
        } else {
            range = this.dependencies.Range.setRange({
                sc: point.node,
                so: point.offset,
            }).normalize();
        }

        return true;
    },
    /**
     * Handle SHIFT+ENTER.
     * 
     * @private
     * @returns {Boolean} true if case handled
     */
    _handleShiftEnter: function () {
        var self = this;
        var range = this.dependencies.Range.getRange();
        var target = range.sc.childNodes[range.so] || range.sc;
        var before;
        if (!this.utils.isText(target)) {
            if (target.tagName === "BR") {
                before = target;
            } else if (target === range.sc) {
                if (range.so) {
                    before = range.sc.childNodes[range.so - 1];
                } else {
                    before = this.document.createTextNode('');
                    $(range.sc).append(before);
                }
            }
        } else {
            before = target;
            var after = target.splitText(target === range.sc ? range.so : 0);
            if (
                !after.nextSibling && after.textContent === '' &&
                this.utils.isNodeBlockType(after.parentNode)
            ) {
                after.textContent = this.utils.char('zeroWidth');
            }
            if (!after.tagName && (!after.previousSibling || after.previousSibling.tagName === "BR")) {
                after.textContent = after.textContent.replace(startSpace, this.utils.char('nbsp'));
            }
        }

        if (!before) {
            return true;
        }

        var br = document.createElement('br');
        $(before).after(br);
        var next = this.getPoint(br, 0);
        var reStartSpace = /^ +/;

        if (this.utils.isText(before)) {
            next = next.next();
            var nextNode = this.utils.firstLeafUntil(next.node.childNodes[next.offset] || next.node, function (n) {
                return !self.dependencies.Arch.isVoidBlock(n) && self.dependencies.Arch.isEditableNode(n);
            });
            if (this.utils.isText(nextNode)) {
                next.node = nextNode;
                next.offset = 0;
            }
        }

        if (
            next.node.tagName === "BR" && next.node.nextSibling &&
            !next.node.nextSibling.tagName && !this.utils.ancestor(next.node, this.utils.isPre)
        ) {
            next.node.nextSibling.textContent = next.node.nextSibling.textContent.replace(reStartSpace, this.utils.char('nbsp'));
        }
        if (
            this.utils.isText(next.node) &&
            (!next.node.previousSibling || next.node.previousSibling.tagName === "BR") &&
            !this.utils.ancestor(next.node, this.utils.isPre)
        ) {
            next.node.textContent = next.node.textContent.replace(reStartSpace, this.utils.char('nbsp'));
        }

        range = this.dependencies.Range.setRange({
            sc: next.node,
            so: next.offset,
        });

        return true;
    },
    /**
     * Insert a Horizontal Rule element (hr).
     *
     * @private
     */
    _insertHR: function () {
        var self = this;
        var hr = document.createElement('hr');
        this.dom.insertBlockNode(hr, this.dependencies.Range.getRange());
        var point = this.getPoint(hr, 0);
        point = point.nextUntil(function (pt) {
            return pt.node !== hr && !self.dependencies.Arch.isUnbreakableNode(pt.node);
        }) || this.getPoint(hr, 0);
        this.dependencies.Range.setRange({
            sc: point.node,
            so: point.offset,
        });
    },
    /**
     * Insert a TAB (4 non-breakable spaces).
     *
     * @private
     */
    _insertTab: function () {
        var range = this.dom.insertTextInline(this.tab, this.dependencies.Range.getRange());
        range = this.dependencies.Range.setRange(range).normalize();
        this.dependencies.Range.save(range);
    },
    /**
     * Patch for Google Chrome's contenteditable SPAN bug.
     *
     * @private
     * @param {jQueryEvent} e
     */
    _removeGarbageSpans: function (e) {
        if (e.target.className === "" && e.target.tagName == "SPAN" &&
            e.target.style.fontStyle === "inherit" &&
            e.target.style.fontVariantLigatures === "inherit" &&
            e.target.style.fontVariantCaps === "inherit") {
            var $span = $(e.target);
            $span.after($span.contents()).remove();
        }
    },
    /**
     * Select all the contents of the current unbreakable ancestor.
     */
    _selectAll: function () {
        var self = this;
        var range = this.dependencies.Range.getRange();
        var unbreakable = this.utils.ancestor(range.sc, this.dependencies.Arch.isUnbreakableNode);
        var $contents = $(unbreakable).contents();
        var startNode = $contents.length ? $contents[0] : unbreakable;
        var pointA = this.getPoint(startNode, 0);
        pointA = pointA.nextUntil(function (point) {
            return self.utils.isVisibleText(point.node);
        });
        var endNode = $contents.length ? $contents[$contents.length - 1] : unbreakable;
        var endOffset = $contents.length ? this.utils.nodeLength($contents[$contents.length - 1]) : 1;
        var pointB = this.getPoint(endNode, endOffset);
        pointB = pointB.prevUntil(function (point) {
            return self.utils.isVisibleText(point.node);
        });
        if (pointA && pointB) {
            range.replace({
                sc: pointA.node,
                so: pointA.offset,
                ec: pointB.node,
                eo: pointB.offset,
            }).normalize();
            range = this.dependencies.Range.setRange(range.getPoints());
            this.dependencies.Range.save(range);
        }
    },


    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    /** 
     * Customize handling of certain keydown events.
     *
     * @private
     * @param {SummernoteEvent} se
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case handled
     */
    _onKeydown: function (e) {
        var handled = false;

        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            this._selectAll();
            return;
        }

        var isChar = e.key && e.key.length === 1;
        var isAccented = e.key && (e.key === "Dead" || e.key === "Unidentified");
        var isModified = e.ctrlKey || e.altKey || e.metaKey;
        if ((isChar || isAccented) && !isModified) {
            if (isAccented) {
                this._accented = isAccented;
            }
            this._handleCharInputHistory(e.key);
        } else {
            this.lastCharIsVisible = false;
            switch (e.keyCode) {
                case 8: // BACKSPACE
                    handled = this._onBackspace(e);
                    break;
                case 13: // ENTER
                    handled = this._onEnter(e);
                    break;
                case 46: // DELETE
                    handled = this._onDelete(e);
                    break;
            }
            if (handled) {
                this._preventTextInEditableDiv();
                this.dependencies.Range.save(this.dependencies.Range.getRange());
                e.preventDefault();
            }
        }
        if (e.key !== "Dead") {
            this._accented = false;
        }
    },
    /**
     * Handle BACKSPACE keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onBackspace: function (e) {
        var self = this;
        var range = this.dependencies.Range.getRange();

        // Special cases
        if (range.isCollapsed()) {

            // Do nothing if on left edge of a table cell
            var point = range.getStartPoint();
            if (point.node.childNodes[point.offset]) {
                point.node = point.node.childNodes[point.offset];
                point.offset = this.utils.nodeLength(point.node);
            }
            if (point.isLeftEdgeOfTag('TD')) {
                return true;
            }

            // Outdent if on left edge of an indented block
            point = range.getStartPoint();
            var isIndented = !!this.utils.ancestor(point.node, function (n) {
                var style = self.utils.isCell(n) ? 'paddingLeft' : 'marginLeft';
                return n.tagName && !!parseFloat(n.style[style] || 0);
            });
            if (point.isLeftEdgeOfBlock() && isIndented) {
                this.dependencies.Paragraph.outdent(null, range);
                return true;
            }
        }

        var needOutdent = this.utils.isInList(range.sc) && range.getStartPoint().isEdgeOfTag('LI', 'left');
        var didDelete;
        if (!needOutdent || !range.isCollapsed()) {
            didDelete = this._handleDeletion(true);
        }
        if (!didDelete && needOutdent) {
            this.dependencies.Range.setRange(range.getPoints());
            this.dependencies.Paragraph.outdent(null, range);
        }

        return true;
    },
    /**
     * Handle DELETE keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onDelete: function (e) {
        var range = this.dependencies.Range.getRange();

        // Special case
        if (range.isCollapsed()) {
            // Do nothing if on left edge of a table cell
            if (range.getStartPoint().isRightEdgeOfTag('TD')) {
                return true;
            }
        }

        this._handleDeletion(false);
        return true;
    },
    /**
     * Handle ENTER keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onEnter: function (e) {
        var range = this.dependencies.Range.getRange();
        var point = this.dom.deleteSelection(range);
        range = this.dependencies.Range.setRange({
            sc: point.node,
            so: point.offset,
        });
        this.dependencies.Range.save(range);

        if (e.shiftKey) {
            this._handleShiftEnter();
        } else if (e.ctrlKey) {
            this._insertHR();
        } else {
            this._handleEnter();
        }
        return true;
    },
    /**
     * Handle visible char keydown event.
     *
     * @private
     * @param {TextEvent} ev
     */
    _onTextInput: function (ev) {
        ev.preventDefault();
        var point = this.dependencies.Arch.insert(ev.data);
        this.dependencies.Arch.setRange(point.id, point.offset);
    },
});

Manager.addPlugin('Keyboard', KeyboardPlugin);

return KeyboardPlugin;
});
