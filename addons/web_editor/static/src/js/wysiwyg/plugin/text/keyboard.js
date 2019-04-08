odoo.define('web_editor.wysiwyg.plugin.keyboard', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var KeyboardPlugin = AbstractPlugin.extend({
    dependencies: ['Range', 'Paragraph', 'Link', 'History', 'Table'], // TODO: Remove dependencies

    editableDomEvents: {
        'keydown': '_onKeydown',
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
     * Perform various DOM and range manipulations after a deletion:
     * - Rerange out of BR elements
     * - Clean the DOM at current range position
     *
     * @see _handleDeletion
     *
     * @private
     * @param {WrappedRange} range
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @param {Boolean} doReplaceEmptyParent true to replace empty parent with empty p if any
     * @returns {WrappedRange}
     */
    _afterDeletion: function (range, isPrev, doReplaceEmptyParent) {
        if (this.utils.isEditable(range.sc) && this.utils.isBlankNode(range.sc)) {
            var p = document.createElement('p');
            var br = document.createElement('br');
            p.appendChild(br);
            range.sc.innerHTML = '';
            range.sc.appendChild(p);
            return range.replace({
                sc: br,
                so: 0,
            });
        }
        range = isPrev ? this._insertInvisibleCharAfterSingleBR(range) : range;
        range = this._rerangeOutOfBR(range, isPrev);
        range = this._cleanRangeAfterDeletion(range);
        if (doReplaceEmptyParent) {
            range = this._replaceEmptyParentWithEmptyP(range);
        }
        return range;
    },
    /**
     * Perform operations that are necessary after the insertion of a visible character:
     * - Adapt range for the presence of zero-width characters
     * - Move out of media
     * - Rerange
     *
     * @private
     */
    _afterVisibleChar: function () {
        var range = this.dependencies.Range.getRange();
        if (range.sc.tagName || this.utils.ancestor(range.sc, this.utils.isAnchor)) {
            return true;
        }
        var needReselect = false;
        var fake = range.sc.parentNode;
        if ((fake.className || '').indexOf('o_fake_editable') !== -1 && this.dependencies.Arch.isVoidBlock(fake)) {
            var $media = $(fake.parentNode);
            $media[fake.previousElementSibling ? 'after' : 'before'](fake.firstChild);
            needReselect = true;
        }
        if (range.sc.textContent.slice(range.so - 2, range.so - 1) === this.utils.char('zeroWidth')) {
            range.sc.textContent = range.sc.textContent.slice(0, range.so - 2) + range.sc.textContent.slice(range.so - 1);
            range.so = range.eo = range.so - 1;
            needReselect = true;
        }
        if (range.sc.textContent.slice(range.so, range.so + 1) === this.utils.char('zeroWidth')) {
            range.sc.textContent = range.sc.textContent.slice(0, range.so) + range.sc.textContent.slice(range.so + 1);
            needReselect = true;
        }
        if (needReselect) {
            this.dependencies.Range.setRange(range.getPoints()).normalize();
        }
    },
    /**
     * Perform various DOM and range manipulations to prepare a deletion:
     * - Rerange within the element targeted by the range
     * - Slice the text content if necessary
     * - Move before an invisible BR if necessary
     * - Replace a media with an empty SPAN if necessary
     * - Change the direction of deletion if necessary
     * - Clean the DOM at range position if necessary
     *
     * @see _handleDeletion
     *
     * @private
     * @param {WrappedRange} range
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @param {Boolean} didDeleteNodes true if nodes were already deleted prior to this call
     * @returns {Object} {didDeleteNodes: Boolean, range: WrappedRange, isPrev: Boolean}
     */
    _beforeDeletion: function (range, isPrev, didDeleteNodes) {
        var res = {
            range: range,
            isPrev: isPrev,
            didDeleteNodes: didDeleteNodes,
        };

        res.range = this._rerangeToOffsetChild(res.range, isPrev);
        res.range = this._sliceAndRerangeBeforeDeletion(res.range);
        res.range = isPrev ? this._moveBeforeInvisibleBR(res.range) : res.range;

        if (this.dependencies.Arch.isVoidBlock(res.range.sc)) {
            if (isPrev === (range.offset !== 0)) {
                var span = this._replaceMediaWithEmptySpan(res.range.sc);
                res.range.replace({
                    sc: span,
                    so: 0,
                });
                res.didDeleteNodes = true;
                return res;
            }
        }

        if (res.didDeleteNodes) {
            res.isPrev = false;
            return res;
        }
        
        res.range = this._cleanRangeBeforeDeletion(res.range, isPrev);

        return res;
    },
    /**
     * Clean the DOM at range position after a deletion:
     * - Remove empty inline nodes
     * - Fill the current node if it's empty
     *
     * @private
     * @param {WrappedRange} range
     * @returns {WrappedRange}
     */
    _cleanRangeAfterDeletion: function (range) {
        var point = range.getStartPoint();
        point = this.dom.removeEmptyInlineNodes(point);
        point = this.dom.fillEmptyNode(point);
        return range.replace({
            sc: point.node,
            so: point.offset,
        });
    },
    /**
     * Clean the DOM at range position:
     * - Remove all previous zero-width characters
     * - Remove leading/trailing breakable space
     *
     * @private
     * @param {WrappedRange} range
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @returns {WrappedRange}
     */
    _cleanRangeBeforeDeletion: function (range, isPrev) {
        if (isPrev) {
            this._removeAllPreviousInvisibleChars(range);
        }
        range = this._removeExtremeBreakableSpaceAndRerange(range);
        return range;
    },
    /**
     * Get information on the range in order to perform a deletion:
     * - The point at which to delete, if any
     * - Whether the node contains a block
     * - The block to remove, if any
     *
     * @private
     * @param {WrappedRange} range
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @param {Boolean} wasOnStartOfBR true if the requested deletion started at
     *                                 the beginning of a BR element
     * @returns {Object} {
     *      point: {false|BoundaryPoint},
     *      hasBlock: {Boolean},
     *      blockToRemove: {false|Node},
     * }
     */
    _getDeleteInfo: function (range, isPrev, wasOnStartOfBR) {
        var self = this;
        var hasBlock = false;
        var blockToRemove = false;
        var method = isPrev ? 'prevUntil' : 'nextUntil';

        var pt = range.getStartPoint()[method](function (point) {
            var isAtStartOfMedia = !point.offset && self.dependencies.Arch.isVoidBlock(point.node);
            var isBRorHR = point.node.tagName === 'BR' || point.node.tagName === 'HR';
            var isRootBR = wasOnStartOfBR && point.node === range.sc;
            var isOnRange = range.ec === point.node && range.eo === point.offset;

            if (!point.offset && self.utils.isNodeBlockType(point.node)) {
                hasBlock = true;
                if (blockToRemove) {
                    return true;
                }
            }

            if (!blockToRemove && (isAtStartOfMedia || isBRorHR && !isRootBR)) {
                blockToRemove = point.node;
                return false;
            }

            if (isOnRange) {
                return false;
            }

            return self._isDeletableNode(point.node);
        });

        return {
            point: !pt ? false : pt,
            hasBlock: hasBlock,
            blockToRemove: blockToRemove,
        };
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
        var range = this.dependencies.Range.getRange();

        var ancestor = this.utils.ancestor(range.sc, function (node) {
            return self.utils.isLi(node) || self.dependencies.Arch.isUnbreakableNode(node.parentNode) && node.parentNode !== self.editable ||
                self.utils.isNodeBlockType(node) && !self.utils.ancestor(node, self.utils.isLi);
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
     * Insert a zero-width character after a BR if the range is
     * at the beginning of an invisible text node
     * and after said single BR element.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {WrappedRange}
     */
    _insertInvisibleCharAfterSingleBR: function (range) {
        if (this._isAtStartOfInvisibleText(range) && this._isAfterSingleBR(range.sc)) {
            var invisibleChar = this.document.createTextNode(this.utils.char('zeroWidth'));
            $(range.sc.previousSibling).after(invisibleChar);
            range.replace({
                sc: invisibleChar,
                so: 1,
            });
        }
        return range;
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
     * Return true if the node comes after a BR element.
     *
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    _isAfterBR: function (node) {
        return node.previousSibling && node.previousSibling.tagName === 'BR';
    },
    /**
     * Return true if the range if positioned after a BR element that doesn't visually
     * show a new line in the DOM: a BR in an element that has only a BR, or text then a BR.
     * eg: <p><br></p> or <p>text<br></p>
     *
     * @private
     * @param {WrappedRange} range
     * @returns {Boolean}
     */
    _isAfterInvisibleBR: function (range) {
        return this._isAfterOnlyBR(range) || this._isAfterOnlyTextThenBR(range);
    },
    /**
     * Return true if the range is positioned on a text node, after an zero-width character.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {Boolean}
     */
    _isAfterInvisibleChar: function (range) {
        return !range.sc.tagName && range.so && range.sc.textContent[range.so - 1] === this.utils.char('zeroWidth');
    },
    /**
     * Return true if the range is positioned on a text node, after an leading zero-width character.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {Boolean}
     */
    _isAfterLeadingInvisibleChar: function (range) {
        return !range.sc.tagName && range.so === 1 && range.sc.textContent[0] === this.utils.char('zeroWidth');
    },
    /**
     * Return true if the range if positioned after a BR element in a node that has only a BR.
     * eg: <p><br></p>
     *
     * @private
     * @param {WrappedRange} range
     * @returns {Boolean}
     */
    _isAfterOnlyBR: function (range) {
        return this.utils.hasOnlyBR(range.sc) && range.so === 1;
    },
    /**
     * Return true if the range if positioned after a BR element in a node that has only text
     * and ends with a BR.
     * eg: <p>text<br></p>
     *
     * @private
     * @param {WrappedRange} range
     * @returns {Boolean}
     */
    _isAfterOnlyTextThenBR: function (range) {
        var self = this;
        var hasTrailingBR = range.sc.lastChild && range.sc.lastChild.tagName === 'BR';
        if (!hasTrailingBR) {
            return false;
        }
        var hasOnlyTextThenBR = _.all(range.sc.childNodes, function (n) {
            return self.utils.isText(n) || n === range.sc.lastChild;
        });
        var isAfterTrailingBR = range.so === self.utils.nodeLength(range.sc);
        return hasOnlyTextThenBR && isAfterTrailingBR;
    },
    /**
     * Return true if the node is after a single BR.
     *
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    _isAfterSingleBR: function (node) {
        var isPreviousAfterBR = node.previousSibling && this._isAfterBR(node.previousSibling);
        return this._isAfterBR(node) && !isPreviousAfterBR;
    },
    /**
     * Return true if the node comes after two BR elements.
     *
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    _isAfterTwoBRs: function (node) {
        var isAfterBR = this._isAfterBR(node);
        var isPreviousSiblingAfterBR = node.previousSibling && this._isAfterBR(node.previousSibling);
        return isAfterBR && isPreviousSiblingAfterBR;
    },
    /**
     * Return true if the range is positioned at the start of an invisible text node.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {Boolean}
     */
    _isAtStartOfInvisibleText: function (range) {
        return !range.so && this.utils.isText(range.sc) && !this.utils.isVisibleText(range.sc);
    },
    /**
     * Return true if the range is positioned on a text node, before a trailing zero-width character.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {Boolean}
     */
    _isBeforeTrailingInvisibleChar: function (range) {
        var isBeforeLastCharOfText = !range.sc.tagName && range.so === this.utils.nodeLength(range.sc) - 1;
        var isLastCharInvisible = range.sc.textContent.slice(range.so) === this.utils.char('zeroWidth');
        return isBeforeLastCharOfText && isLastCharInvisible;
    },
    /**
     * Return true if the node is deletable.
     *
     * @private
     * @param {Node} node
     * @return {Boolean}
     */
    _isDeletableNode: function (node) {
        var isVisibleText = this.utils.isVisibleText(node);
        var isVoidBlock = this.dependencies.Arch.isVoidBlock(node);
        var isBR = node.tagName === 'BR';
        var isEditable = this.dependencies.Arch.isEditableNode(node);
        return isEditable && (isVisibleText || isVoidBlock || isBR);
    },
    /**
     * Return true if the range is positioned on an edge to delete, depending on the given direction.
     *
     * @private
     * @param {WrappedRange} range
     * @param {Boolean} isPrev true to delete left
     */
    _isOnEdgeToDelete: function (range, isPrev) {
        var isOnBR = range.sc.tagName === 'BR';
        var parentHasOnlyBR = range.sc.parentNode && this.utils.hasOnlyBR(range.sc.parentNode);
        var isOnDirEdge;
        if (isPrev) {
            isOnDirEdge = range.so === 0;
        } else {
            isOnDirEdge = range.so === this.utils.nodeLength(range.sc);
        }
        return (!isOnBR || parentHasOnlyBR) && isOnDirEdge;
    },
    /**
     * Move the range before a BR if that BR doesn't visually show a new line in the DOM.
     * Return the new range.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {WrappedRange}
     */
    _moveBeforeInvisibleBR: function (range) {
        if (this._isAfterInvisibleBR(range)) {
            range.so -= 1;
        }
        return range;
    },
    /**
     * Perform a deletion in the given direction.
     * Note: This is where the actual deletion takes place.
     *       It should be preceded by _beforeDeletion and
     *       followed by _afterDeletion.
     *
     * @see _handleDeletion
     *
     * @private
     * @param {WrappedRange} range
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @param {Boolean} wasOnStartOfBR true if the requested deletion started at
     *                                 the beginning of a BR element
     * @returns {BoundaryPoint|null} point on which to rerange or null if no change was made
     */
    _performDeletion: function (range, isPrev, wasOnStartOfBR) {
        var didDeleteNodes = false;
        if (this._isOnEdgeToDelete(range, isPrev)) {
            var rest = this.dom.deleteEdge(range.sc, isPrev);
            didDeleteNodes = !!rest;
            if (didDeleteNodes) {
                return rest;
            }
        }

        var deleteInfo = this._getDeleteInfo(range, isPrev, wasOnStartOfBR);

        if (!deleteInfo.point) {
            return null;
        }

        var point = deleteInfo.point;
        var blockToRemove = deleteInfo.blockToRemove;
        var hasBlock = deleteInfo.hasBlock;

        var isLonelyBR = blockToRemove && blockToRemove.tagName === 'BR' && this.utils.hasOnlyBR(blockToRemove.parentNode);
        var isHR = blockToRemove && blockToRemove.tagName === "HR";

        if (blockToRemove && !isLonelyBR) {
            $(blockToRemove).remove();
            point = isHR ? this.dom.deleteEdge(range.sc, isPrev) : point;
            didDeleteNodes = true;
        } else if (!hasBlock) {
            var isAtEndOfNode = point.offset === this.utils.nodeLength(point.node);
            var shouldMove = isAtEndOfNode || !isPrev && !!point.offset;

            point.offset = shouldMove ? point.offset - 1 : point.offset;
            point.node = this._removeCharAtOffset(point);
            didDeleteNodes = true;

            var isInPre = !!this.utils.ancestor(range.sc, this.utils.isPre);
            if (!isInPre) {
                this.dom.secureExtremeSingleSpace(point.node);
            }

            if (isPrev && !point.offset && !this._isAfterBR(point.node)) {
                point.node = this._replaceLeadingSpaceWithSingleNBSP(point.node);
            }
        }

        return didDeleteNodes ? point : null;
    },
    /**
     * Prevent the appearance of a text node with the editable DIV as direct parent:
     * wrap it in a p element.
     *
     * @private
     */
    _preventTextInEditableDiv: function () {
        var range = this.dependencies.Range.getRange();
        while (
            this.utils.isText(this.editable.firstChild) &&
            !this.utils.isVisibleText(this.editable.firstChild)
        ) {
            var node = this.editable.firstChild;
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
        var editableIsEmpty = !this.editable.childNodes.length;
        if (editableIsEmpty) {
            var p = document.createElement('p');
            p.innerHTML = '<br>';
            this.editable.appendChild(p);
            range.replace({
                sc: p,
                so: 0,
            });
        } else if (this.utils.isBlankNode(this.editable.firstChild, this.dependencies.Arch.isVoidBlock) &&
            !range.sc.parentNode) {
            this.editable.firstChild.innerHTML = '<br/>';
            range.replace({
                sc: this.editable.firstChild,
                so: 0,
            });
        }

        this.dependencies.Range.setRange(range.getPoints());
    },
    /**
     * Remove all invisible chars before the current range, that are adjacent to it,
     * then rerange.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {WrappedRange}
     */
    _removeAllPreviousInvisibleChars: function (range) {
        while (this._isAfterInvisibleChar(range)) {
            var text = range.sc.textContent;
            range.sc.textContent = text.slice(0, range.so - 1) + text.slice(range.so, text.length);
            range.so -= 1;
        }
        return range;
    },
    /**
     * Remove a char from a point's text node, at the point's offset.
     *
     * @private
     * @param {Object} point
     * @returns {Node}
     */
    _removeCharAtOffset: function (point) {
        var text = point.node.textContent;
        var startToOffset = text.slice(0, point.offset);
        var offsetToEnd = text.slice(point.offset + 1);
        point.node.textContent = startToOffset + offsetToEnd;
        return point.node;
    },
    /**
     * Remove any amount of leading/trailing breakable space at range position.
     * Then move the range and return it.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {WrappedRange}
     */
    _removeExtremeBreakableSpaceAndRerange: function (range) {
        var isInPre = !!this.utils.ancestor(range.sc, this.utils.isPre);
        if (!range.sc.tagName && !isInPre) {
            var changed = this.dom.removeExtremeBreakableSpace(range.sc);
            range.so = range.eo = range.so > changed.start ? range.so - changed.start : 0;
            range.so = range.eo = range.so > this.utils.nodeLength(range.sc) ? this.utils.nodeLength(range.sc) : range.so;
            range = this.dependencies.Range.setRange(range.getPoints());
            this.dependencies.Range.save(range);
        }
        return range;
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
     * Remove the first unbreakable ancestor's next sibling if empty.
     *
     * @private
     * @param {Node} node
     */
    _removeNextEmptyUnbreakable: function (node) {
        var self = this;
        var unbreakable = this.utils.ancestor(node, this.dependencies.Arch.isUnbreakableNode);
        if (unbreakable === this.editable) {
            return;
        }
        var nextUnbreakable = unbreakable && unbreakable.nextElementSibling;
        var isNextEmpty = nextUnbreakable && this.utils.isEmpty(nextUnbreakable) && !this.utils.isVoid(nextUnbreakable);
        var isNextContainsOnlyInvisibleText = nextUnbreakable && _.all($(nextUnbreakable).contents(), function (n) {
            return self.utils.isInvisibleText(n);
        });
        if (isNextEmpty || isNextContainsOnlyInvisibleText) {
            $(nextUnbreakable).remove();
        }
    },
    /**
     * If the range's start container is empty and constitutes the only contents of its parent,
     * replace it with an empty p, then rerange.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {WrappedRange}
     */
    _replaceEmptyParentWithEmptyP: function (range) {
        if (range.sc === this.editable) {
            return range;
        }
        var node = this.utils.isVoid(range.sc) && range.sc.parentNode ? range.sc.parentNode : range.sc;
        var parentOnlyHasNode = node.parentNode && this.utils.onlyContains(node.parentNode, node);
        if (this.utils.isEmpty(node) && node.tagName !== 'LI' && parentOnlyHasNode) {
            var emptyP = document.createElement('p');
            var br = document.createElement('br');
            $(emptyP).append(br);
            $(node).before(emptyP).remove();
            range.sc = range.ec = br;
            range.so = range.eo = 0;
        }
        return range;
    },
    /**
     * Replace all leading space from a text node with one non-breakable space.
     *
     * @param {Node} node
     * @returns {Node} node
     */
    _replaceLeadingSpaceWithSingleNBSP: function (node) {
        var startSpace = this.utils.getRegex('startSpace');
        node.textContent = node.textContent.replace(startSpace, this.utils.char('nbsp'));
        return node;
    },
    /**
     * Replace a media node with an empty SPAN and return that SPAN.
     *
     * @param {Node} media
     * @returns {Node} span
     */
    _replaceMediaWithEmptySpan: function (media) {
        var self = this;
        var span = document.createElement('span');
        media = this.utils.ancestor(media, function (n) {
            return !n.parentNode || !self.dependencies.Arch.isVoidBlock(n.parentNode);
        });
        $(media).replaceWith(span);
        return span;
    },
    /**
     * Move the (collapsed) range to get out of BR elements.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {WrappedRange}
     */
    _rerangeOutOfBR: function (range, isPrev) {
        range = this._rerangeToFirstNonBRElementLeaf(range);
        range = this._rerangeToNextNonBR(range, !isPrev);
        return range;
    },
    /**
     * Move the (collapsed) range to the first leaf that is not a BR element.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {WrappedRange}
     */
    _rerangeToFirstNonBRElementLeaf: function (range) {
        var leaf = this.utils.firstNonBRElementLeaf(range.sc);
        if (leaf !== range.sc) {
            range.replace({
                sc: leaf,
                so: 0,
            });
        }
        return range;            
    },
    /**
     * Move the (collapsed) range to the next (or previous) node that is not a BR element.
     *
     * @private
     * @param {WrappedRange} range
     * @param {Boolean} previous true to move to the previous node
     * @returns {WrappedRange}
     */
    _rerangeToNextNonBR: function (range, previous) {
        var point = range.getStartPoint();
        var method = previous ? 'prevUntilNode' : 'nextUntilNode';
        point = point[method](this.utils.not(this.utils.isBR.bind(this.utils)));
        if (point) {
            range.replace({
                sc: point.node,
                so: point.offset,
            });
        }
        return range;
    },
    /**
     * Move the (collapsed) range to the child of the node at the current offset if possible.
     *
     * @private
     * @param {WrappedRange} range
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @returns {WrappedRange}
     */
    _rerangeToOffsetChild: function (range, isPrev) {
        if (range.sc.childNodes[range.so]) {
            var node;
            var offset;
            if (isPrev && range.so > 0) {
                node = range.sc.childNodes[range.so - 1];
                offset = this.utils.nodeLength(node);
                range.replace({
                    sc: node,
                    so: offset,
                });
            } else {
                node = range.sc.childNodes[range.so];
                offset = 0;
                range.replace({
                    sc: node,
                    so: offset,
                });
            }
        }
        return range;
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
    /**
     * Before a deletion, if necessary, slice the text content at range, then rerange.
     *
     * @param {WrappedRange} range
     * @returns {WrappedRange}
     */
    _sliceAndRerangeBeforeDeletion: function (range) {
        if (this._isAfterLeadingInvisibleChar(range) && !this._isAfterTwoBRs(range.sc)) {
            range.sc.textContent = range.sc.textContent.slice(1);
            range.so = 0;
        }
        if (this._isBeforeTrailingInvisibleChar(range) && !this._isAfterBR(range.sc)) {
            range.sc.textContent = range.sc.textContent.slice(0, range.so);
        }
        return range;
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
        var self = this;
        var handled = false;

        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            this._selectAll();
            return;
        }

        if (e.key &&
            (e.key.length === 1 || e.key === "Dead" || e.key === "Unidentified") &&
            !e.ctrlKey && !e.altKey && !e.metaKey) {

            if (e.key === "Dead" || e.key === "Unidentified") {
                this._accented = true;
            }

            // Record undo only if either:
            clearTimeout(this.lastCharIsVisibleTime);
            // e.key is punctuation or space
            var stopChars = [' ', ',', ';', ':', '?', '.', '!'];
            if (stopChars.indexOf(e.key) !== -1) {
                this.lastCharVisible = false;
            }
            // or not on top of history stack (record undo after undo)
            var history = this.dependencies.History.getHistoryStep();
            if (history && history.stack.length && history.stackOffset < history.stack.length - 1) {
                this.lastCharVisible = false;
            }
            // or no new char for 500ms
            this.lastCharIsVisibleTime = setTimeout(function () {
                self.lastCharIsVisible = false;
            }, 500);
            if (!this.lastCharIsVisible) {
                this.lastCharIsVisible = true;
                this.dependencies.History.recordUndo();
            }

            if (e.key !== "Dead") {
                this._onVisibleChar(e, this._accented);
            }
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
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onVisibleChar: function (e, accented) {
        var self = this;
        e.preventDefault();
        if (accented) {
            this.editable.normalize();
            var baseRange = this.dependencies.Range.getRange();

            var $parent = $(baseRange.sc.parentNode);
            var parentContenteditable = $parent.attr('contenteditable');
            $parent.attr('contenteditable', false);

            var accentPlaceholder = document.createElement('span');
            $(baseRange.sc).after(accentPlaceholder);
            $(accentPlaceholder).attr('contenteditable', true);

            this.dependencies.Range.setRange({
                sc: accentPlaceholder,
                so: 0,
            });

            setTimeout(function () {
                var accentedChar = accentPlaceholder.innerHTML;
                $(accentPlaceholder).remove();
                if (parentContenteditable) {
                    $parent.attr('contenteditable', parentContenteditable);
                } else {
                    $parent.removeAttr('contenteditable');
                }
                var range = self.dependencies.Range.setRange(baseRange);
                range = self.dom.insertTextInline(accentedChar, range);
                self.dependencies.Range.setRange(range);
            });
        } else {
            var range = this.dom.insertTextInline(e.key, this.dependencies.Range.getRange());
            this.dependencies.Range.setRange(range);
        }
        return true;
    },
});

Manager.addPlugin('Keyboard', KeyboardPlugin);

return KeyboardPlugin;
});
