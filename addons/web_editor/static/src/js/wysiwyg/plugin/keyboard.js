odoo.define('web_editor.wysiwyg.plugin.keyboard', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var KeyboardPlugin = AbstractPlugin.extend({
    dependencies: ['Range', 'List', 'Link', 'History'], // TODO: Remove dependencies

    editableDomEvents: {
        'keydown': '_onKeydown',
        'DOMNodeInserted .note-editable': '_removeGarbageSpans',
    },
    tab: '\u00A0\u00A0\u00A0\u00A0',

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------


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
     * @param {String('prev'|'next')} direction 'prev' to delete BEFORE the carret
     * @returns {WrappedRange}
     */
    _afterDeletion: function (range, direction) {
        range = direction === 'prev' ? this._insertInvisibleCharAfterSingleBR(range) : range;
        range = this._rerangeOutOfBR(range, direction);
        range = this._cleanRangeAfterDeletion(range);
        range = this._replaceEmptyParentWithEmptyP(range);
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
        if ((fake.className || '').indexOf('o_fake_editable') !== -1 && this.utils.isMedia(fake)) {
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
     * @param {String('prev'|'next')} direction
     * @param {Boolean} didDeleteNodes true if nodes were already deleted prior to this call
     * @returns {Object} {didDeleteNodes: Boolean, range: WrappedRange, direction: String('prev'|next')}
     */
    _beforeDeletion: function (range, direction, didDeleteNodes) {
        var res = {
            range: range,
            direction: direction,
            didDeleteNodes: didDeleteNodes,
        };

        res.range = this._rerangeToOffsetChild(res.range, direction);
        res.range = this._sliceAndRerangeBeforeDeletion(res.range);
        res.range = direction === 'prev' ? this._moveBeforeInvisibleBR(res.range) : res.range;

        if (this.utils.isMedia(res.range.sc)) {
            var span = this._replaceMediaWithEmptySpan(res.range.sc);
            res.range.replace({
                sc: span,
                so: 0,
                ec: span,
                eo: 0,
            });
            res.didDeleteNodes = true;
            return res;
        }

        if (res.didDeleteNodes) {
            res.direction = 'next';
            return res;
        }
        
        res.range = this._cleanRangeBeforeDeletion(res.range, direction);

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
        point = this.utils.fillEmptyNode(point);
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
     * @param {String('prev'|'next')} direction
     * @returns {WrappedRange}
     */
    _cleanRangeBeforeDeletion: function (range, direction) {
        if (direction === 'prev') {
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
     * @param {String('prev'|'next')} direction
     * @param {Boolean} wasOnStartOfBR true if the requested deletion started at
     *                                 the beginning of a BR element
     * @returns {Object} {
     *      point: {false|Object},
     *      hasBlock: {Boolean},
     *      blockToRemove: {false|Node},
     * }
     */
    _getDeleteInfo: function (range, direction, wasOnStartOfBR) {
        var self = this;
        var hasBlock = false;
        var blockToRemove = false;
        var method = direction === 'prev' ? 'prevUntil' : 'nextUntil';

        var pt = range.getStartPoint();
        pt = pt[method](function (point) {
            var isAtStartOfMedia = !point.offset && self.utils.isMedia(point.node);
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
            point: pt || false,
            hasBlock: hasBlock,
            blockToRemove: blockToRemove,
        };
    },
    /**
     * Handle deletion (BACKSPACE / DELETE).
     *
     * @private
     * @param {String('prev'|'next')} direction 'prev' to delete BEFORE the carret
     * @returns {Boolean} true if case handled
     */
    _handleDeletion: function (direction) {
        var range = this.dependencies.Range.getRange();
        var point = this.dom.deleteSelection(range);
        var didDeleteNodes = !!point;
        if (didDeleteNodes) {
            range = this.dependencies.Range.setRange({
                sc: point.node,
                so: point.offset,
            });
            this.dependencies.Range.save(range);
        }

        range = this.dependencies.Range.getRange();
        var wasOnStartOfBR = direction === 'prev' && !range.so && range.sc.tagName === 'BR';

        this._removeNextEmptyUnbreakable(range.sc);
        var temp = this._beforeDeletion(range, direction, didDeleteNodes);
        didDeleteNodes = temp.didDeleteNodes;
        range = temp.range;
        direction = temp.direction;

        if (!didDeleteNodes) {
            var newRange = this._performDeletion(range, direction, wasOnStartOfBR);
            didDeleteNodes = newRange.so !== range.so || newRange.sc !== range.sc;
            range = newRange;
        }

        range = this._afterDeletion(range, direction);

        range = this.dependencies.Range.setRange(range.getPoints()).collapse(direction === 'prev');
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
            return self.utils.isLi(node) || self.options.isUnbreakableNode(node.parentNode) && node.parentNode !== self.editable ||
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
            this.dependencies.List.outdent();
            return true;
        }

        var btn = this.utils.ancestor(range.sc, function (n) {
            return $(n).hasClass('btn');
        });

        var point = range.getStartPoint();

        if (!point.node.tagName && this.options.isUnbreakableNode(point.node.parentNode)) {
            return this._handleShiftEnter();
        }

        if (point.node.tagName && point.node.childNodes[point.offset] && point.node.childNodes[point.offset].tagName === "BR") {
            point = point.next();
        }
        if (point.node.tagName === "BR") {
            point = point.next();
        }

        var next = this.dom.splitTree(ancestor, point, {
            isSkipPaddingBlankNode: !this.utils.isNodeBlockType(point.node.parentNode) && !!point.node.parentNode.nextSibling
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
        if (!hasSplitBlock && lastChecked.tagName) {
            $(lastChecked).before(this.document.createElement('br'));
        }

        if (!next.tagName) {
            this.dom.secureExtremeSingleSpace(next);
        }
        if (next.tagName !== "BR" && next.innerHTML === "") {
            next.innerHTML = this.utils.char('zeroWidth');
        }
        if (ancestor) {
            var firstChild = this.utils.firstLeafUntil(ancestor, function (n) {
                return (!self.utils.isMedia || !self.utils.isMedia(n)) && self.options.isEditableNode(n);
            });
            var lastChild = this.utils.lastLeaf(ancestor);
            if (this.utils.isBlankNode(ancestor)) {
                firstChild = this.utils.isText(firstChild) ? firstChild.parentNode : firstChild;
                $(firstChild).contents().remove();
                $(firstChild).append(this.document.createElement('br'));
            }
            if (lastChild.tagName === 'BR' && lastChild.previousSibling) {
                $(lastChild).after(this.document.createTextNode(this.utils.char('zeroWidth')));
            }
        }

        // move to next editable area
        point = this.getPoint(next, 0);
        if (
            (point.node.tagName && point.node.tagName !== 'BR') ||
            !this.utils.isVisibleText(point.node.textContent)
        ) {
            point = point.nextUntil(function (pt) {
                if (pt.node === point.node) {
                    return;
                }
                return (
                        pt.node.tagName === "BR" ||
                        self.utils.isVisibleText(pt.node)
                    ) &&
                    self.options.isEditableNode(pt.node);
            });
            point = point || this.getPoint(next, 0);
            if (point.node.tagName === "BR") {
                point = point.next();
            }
        }

        if (!hasSplitBlock && !point.node.tagName) {
            point.node.textContent = this.utils.char('zeroWidth') + point.node.textContent;
            point.offset = 1;
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
            this.dependencies.Link.fillEmptyLink(next, true);
            this.dependencies.Link.fillEmptyLink(btn, true);

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
        if (target.tagName) {
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

        var br = this.document.createElement('br');
        $(before).after(br);
        var next = this.getPoint(br, 0);
        var startSpace = this.utils.getRegex('startSpace');

        if (!before.tagName) {
            next = next.next();
            var nextNode = this.utils.firstLeafUntil(next.node.childNodes[next.offset] || next.node, function (n) {
                return (!self.utils.isMedia || !self.utils.isMedia(n)) && self.options.isEditableNode(n);
            });
            if (!nextNode.tagName) {
                next.node = nextNode;
                next.offset = 0;
            }
        }

        if (
            next.node.tagName === "BR" && next.node.nextSibling &&
            !next.node.nextSibling.tagName && !this.utils.ancestor(next.node, this.utils.isPre)
        ) {
            next.node.nextSibling.textContent = next.node.nextSibling.textContent.replace(startSpace, this.utils.char('nbsp'));
        }
        if (
            !next.node.tagName &&
            (!next.node.previousSibling || next.node.previousSibling.tagName === "BR") &&
            !this.utils.ancestor(next.node, this.utils.isPre)
        ) {
            next.node.textContent = next.node.textContent.replace(startSpace, this.utils.char('nbsp'));
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
        var hr = this.document.createElement('hr');
        this.dom.insertBlockNode(hr, this.dependencies.Range.getRange());
        var point = this.getPoint(hr, 0);
        point = point.nextUntil(function (pt) {
            return pt.node !== hr && !self.options.isUnbreakableNode(pt.node);
        }) || point;
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
        return this._hasOnlyBR(range.sc) && range.so === 1;
    },
    /**
     * Return true if the node has for only element child a BR element.
     *
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    _hasOnlyBR: function (node) {
        return node.childElementCount === 1 && node.firstChild.tagName === 'BR';
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
        var isMedia = this.utils.isMedia(node);
        var isBR = node.tagName === 'BR';
        var isEditable = this.options.isEditableNode(node);
        return isEditable && (isVisibleText || isMedia || isBR);
    },
    /**
     * Return true if the range is positioned on an edge to delete, depending on the given direction.
     *
     * @private
     * @param {WrappedRange} range
     * @param {String('prev'|'next')} direction
     */
    _isOnEdgeToDelete: function (range, direction) {
        var isOnBR = range.sc.tagName === 'BR';
        var parentHasOnlyBR = range.sc.parentNode && range.sc.parentNode.innerHTML.trim() === "<br>";
        var isOnDirEdge;
        if (direction === 'next') {
            isOnDirEdge = range.so === this.utils.nodeLength(range.sc);
        } else {
            isOnDirEdge = range.so === 0;
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
     * @param {String('prev'|'next')} direction 'prev' to delete BEFORE the carret
     * @param {Boolean} wasOnStartOfBR true if the requested deletion started at
     *                                 the beginning of a BR element
     * @returns {WrappedRange}
     */
    _performDeletion: function (range, direction, wasOnStartOfBR) {
        var didDeleteNodes = false;
        if (this._isOnEdgeToDelete(range, direction)) {
            var rest = this.dom.deleteEdge(range.sc, direction);
            didDeleteNodes = !!rest;
            if (didDeleteNodes) {
                return range.replace({
                    sc: rest.node,
                    so: rest.offset,
                });
            }
        }

        var deleteInfo = this._getDeleteInfo(range, direction, wasOnStartOfBR);

        if (!deleteInfo.point) {
            return range;
        }

        var point = deleteInfo.point;
        var blockToRemove = deleteInfo.blockToRemove;
        var hasBlock = deleteInfo.hasBlock;

        var isLonelyBR = blockToRemove && blockToRemove.tagName === 'BR' && this._hasOnlyBR(blockToRemove.parentNode);
        var isHR = blockToRemove && blockToRemove.tagName === "HR";

        if (blockToRemove && !isLonelyBR) {
            $(blockToRemove).remove();
            point = isHR ? this.dom.deleteEdge(range.sc, direction) : point;
            didDeleteNodes = true;
        } else if (!hasBlock) {
            var isAtEndOfNode = point.offset === this.utils.nodeLength(point.node);
            var shouldMove = isAtEndOfNode || direction === 'next' && point.offset;

            point.offset = shouldMove ? point.offset - 1 : point.offset;
            point.node = this._removeCharAtOffset(point);
            didDeleteNodes = true;

            var isInPre = !!this.utils.ancestor(range.sc, this.utils.isPre);
            if (!isInPre) {
                this.dom.secureExtremeSingleSpace(point.node);
            }

            if (direction === 'prev' && !point.offset && !this._isAfterBR(point.node)) {
                point.node = this._replaceLeadingSpaceWithSingleNBSP(point.node);
            }
        }

        if (didDeleteNodes) {
            range.replace({
                sc: point.node,
                so: point.offset,
            });
        }
        return range;
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
            var p = this.document.createElement('p');
            p.innerHTML = '<br>';
            this.editable.appendChild(p);
            range.replace({
                sc: p,
                so: 0,
            });
        } else if (this.utils.isBlankNode(this.editable.firstChild) && !range.sc.parentNode) {
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
        var unbreakable = this.utils.ancestor(node, this.options.isUnbreakableNode);
        if (unbreakable === this.editable) {
            return;
        }
        var nextUnbreakable = unbreakable && unbreakable.nextElementSibling;
        var isNextEmpty = nextUnbreakable && this.utils.isEmpty(nextUnbreakable) && !this.utils.isVoid(nextUnbreakable);
        var isNextContainsOnlyInvisibleText = nextUnbreakable && _.all($(nextUnbreakable).contents(), function (n) {
            return self.utils.isText(n) && !self.utils.isVisibleText(n);
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
     * @param {Object} range
     * @returns {Object} range
     */
    _replaceEmptyParentWithEmptyP: function (range) {
        if (range.sc === this.editable || range.sc.parentNode === this.editable) {
            return range;
        }
        var node = this.utils.isVoid(range.sc) && range.sc.parentNode ? range.sc.parentNode : range.sc;
        var parentOnlyHasNode = node.parentNode && this.utils.onlyContains(node.parentNode, node);
        if (this.utils.isEmpty(node) && node.tagName !== 'LI' && parentOnlyHasNode) {
            var emptyP = this.document.createElement('p');
            var br = this.document.createElement('br');
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
        var span = this.document.createElement('span');
        media = this.utils.ancestor(media, function (n) {
            return !n.parentNode || !self.utils.isMedia(n.parentNode);
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
    _rerangeOutOfBR: function (range, direction) {
        range = this._rerangeToFirstNonBRElementLeaf(range);
        range = this._rerangeToNextNonBR(range, direction === 'next');
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
        var method = previous ? 'prevUntil' : 'nextUntil';
        point = point[method](function (pt) {
            return pt.node.tagName !== 'BR';
        });
        range.replace({
            sc: point.node,
            so: point.offset,
        });
        return range;
    },
    /**
     * Move the (collapsed) range to the child of the node at the current offset if possible.
     *
     * @private
     * @param {WrappedRange} range
     * @param {String('prev'|'next')} direction
     * @returns {WrappedRange}
     */
    _rerangeToOffsetChild: function (range, direction) {
        if (range.sc.childNodes[range.so]) {
            var node;
            var offset;
            if (direction === 'prev' && range.so > 0) {
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
        var unbreakable = this.utils.ancestor(range.sc, this.options.isUnbreakableNode);
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
        range.sc = pointA.node;
        range.so = pointA.offset;
        range.ec = pointB.node;
        range.eo = pointB.offset;
        range.select().normalize();
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
                case 9: // TAB
                    handled = this._onTab(e);
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
        var needOutdent = false;

        // Special cases
        if (range.isCollapsed()) {

            // Do nothing if on left edge of a table cell
            var point = range.getStartPoint();
            if (point.node.childNodes[point.offset]) {
                point.node = point.node.childNodes[point.offset];
                point.offset = this.utils.nodeLength(point.node);
            }
            if (this.utils.isLeftEdgeOfTag(point, 'TD')) {
                return true;
            }

            // Outdent if on left edge of an indented block
            point = range.getStartPoint();
            var isIndented = !!this.utils.ancestor(point.node, function (n) {
                var style = self.utils.isCell(n) ? 'paddingLeft' : 'marginLeft';
                return n.tagName && !!parseFloat(n.style[style] || 0);
            });
            if (point.isLeftEdgeOfBlock()) {
                if (isIndented) {
                    this.dependencies.List.outdent();
                    return true;
                }
                if (this.utils.ancestor(range.sc, this.utils.isLi)) {
                    needOutdent = true;
                }
            }
        }

        var flag = this._handleDeletion('prev');

        if (!flag && needOutdent) {
            this.dependencies.Range.setRange(range.getPoints());
            this.dependencies.List.outdent();
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
            if (this.utils.isRightEdgeOfTag(range.getStartPoint(), 'TD')) {
                return true;
            }
        }

        this._handleDeletion('next');
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
     * Handle TAB keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onTab: function (e) {
        // If TAB not handled, prevent default and do nothing
        if (!this.options.keyMap.pc.TAB) {
            this.trigger_up('wysiwyg_blur', {
                key: 'TAB',
                keyCode: 9,
                shiftKey: e.shiftKey,
            });
            return true;
        }
        var range = this.dependencies.Range.getRange();
        var point = range.getStartPoint();
        var startSpace = this.utils.getRegex('startSpace');

        if (!range.isOnCell()) {
            // If on left edge point: indent/outdent
            if (!point.node.tagName) { // Clean up start spaces on textNode
                point.node.textContent.replace(startSpace, function (startSpaces) {
                    point.offset = startSpaces.length === point.offset ? 0 : point.offset;
                    return '';
                });
            }
            if (point.isLeftEdgeOfBlock() || this.utils.isEmpty(point.node)) {
                if (e.shiftKey) {
                    this.dependencies.List.outdent();
                } else {
                    this.dependencies.List.indent();;
                }
                this.dependencies.Range.getRange().normalize();
                return true;
            }
            // Otherwise insert a tab or do nothing
            if (!e.shiftKey) {
                this._insertTab();
                this.dependencies.Range.getRange().normalize();
            }
            return true;
        }
        // In table, on tab switch to next cell
        return false;
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

            var accentPlaceholder = this.document.createElement('span');
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
                range = this.dependencies.Range.setRange(range).normalize();
                self.dependencies.Range.save(range);
            });
        } else {
            var range = this.dom.insertTextInline(e.key, this.dependencies.Range.getRange());
            range = this.dependencies.Range.setRange(range).normalize();
            this.dependencies.Range.save(range);
        }
        return true;
    },
});

Manager.addPlugin('Keyboard', KeyboardPlugin);

return KeyboardPlugin;
});
