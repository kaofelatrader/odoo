odoo.define('wysiwyg.Dom', function (require) {
'use strict';

var BoundaryPoint = require('wysiwyg.BoundaryPoint');
var Class = require('web.Class');
var utils = require('wysiwyg.utils');

var Dom = Class.extend({
    /**
     * @param {Node} doc the current document being edited
     */
    init: function (doc, options) {
        this.document = doc;
        this.$editable = $(this.document).find('.note-editable');
        this.editable = this.$editable[0];
        this.options = options;
    },

    /**
     * Remove the DOM between 2 points (respecting unbreakable rules).
     *
     * @param {BoundaryPoint} pointA
     * @param {BoundaryPoint} pointB
     * @returns {BoundaryPoint} pointA, updated if necessary
     */
    deleteBetween: function (pointA, pointB) {
        var self = this;
        if (pointB.node.childNodes[pointB.offset]) {
            var firstLeaf = utils.firstLeafUntil(pointB.node.childNodes[pointB.offset], function (n) {
                return (!utils.isMedia || !utils.isMedia(n)) && self.options.isEditableNode(n);
            });
            pointB = new BoundaryPoint(firstLeaf, 0);
        }
        if (pointB.node.tagName && pointB.node.tagName !== 'BR' && pointB.offset >= utils.nodeLength(pointB.node)) {
            pointB = pointB.next();
        }
        var changed;
        var commonAncestor = utils.commonAncestor(pointA.node, pointB.node);

        var ecAncestor = utils.ancestor(pointB.node, function (node) {
            return node === commonAncestor || self.options.isUnbreakableNode(node.parentNode);
        });
        var next = this.splitTree(ecAncestor, pointB, {
            nextText: true,
        });

        var scAncestor = utils.ancestor(pointA.node, function (node) {
            return node === commonAncestor || self.options.isUnbreakableNode(node.parentNode);
        });
        if (utils.isIcon && utils.isIcon(pointA.node)) {
            pointA = pointA.prev();
        }
        this.splitTree(scAncestor, pointA, {
            nextText: true,
        });
        pointA.offset = utils.nodeLength(pointA.node);

        var nodes = [];
        pointA.nextUntil(function (point) {
            if (point.node === next || !point.node) {
                return true;
            }
            if (utils.isText(point.node) && point.offset) {
                return;
            }
            var target = point.node.childNodes[point.offset] || point.node;
            if (target === pointA.node || $.contains(target, pointA.node) || target === next || $.contains(target, next)) {
                return;
            }
            if (
                nodes.indexOf(target) === -1 && !utils.ancestor(target, function (target) {
                    return nodes.indexOf(target) !== -1;
                })
            ) {
                nodes.push(target);
            }
        });
        $(nodes).remove();

        changed = !!nodes.length;
        var toMerge = changed && pointA.node.parentNode !== next.parentNode;


        var pointNode = utils.firstLeafUntil(next, function (n) {
            return (!utils.isMedia || !utils.isMedia(n)) && self.options.isEditableNode(n);
        });
        var point = new BoundaryPoint(pointNode, 0);
        if (nodes.length > 1 || nodes.length && !utils.isText(nodes[0])) {
            point = this.removeEmptyInlineNodes(point);
        }

        // Remove whole li/ul/ol if deleted all contents of li/ul/ol
        var ul = utils.ancestor(next, function (n) {
            return n.tagName === 'UL' || n.tagName === 'OL';
        });
        if (ul && next[utils.isText(next) ? 'textContent' : 'innerHTML'] === '' && pointA.node !== next.previousSibling) {
            var toRemove = next;
            while (
                toRemove !== ul && toRemove.parentNode &&
                !this.options.isUnbreakableNode(toRemove.parentNode) &&
                utils.isBlankNode(toRemove.parentNode)
            ) {
                toRemove = toRemove.parentNode;
            }
            $(toRemove).remove();
        }
        if (!utils.editableAncestor(pointA.node)) {
            pointA = point;
        }

        if (toMerge) {
            pointA = this.deleteEdge(pointA.node, 'next') || pointA;
        }

        return pointA;
    },
    /**
     * Remove the edge between a node and its sibling
     * (= merge the nodes, respecting unbreakable rules).
     *
     * @param {Node} node
     * @param {String('next'|'prev')} direction
     * @param {Boolean} doNotTryNonSim true to not try merging non-similar nodes
     * @returns {BoundaryPoint}
     */
    deleteEdge: function (node, direction, doNotTryNonSim) {
        var self = this;
        var prevOrNext = direction === 'prev' ? 'previousSibling' : 'nextSibling';
        var result = false;
        var startN = node;

        if (node.tagName === 'BR' && node.nextSibling && !(utils.isText(node.nextSibling) && !utils.isVisibleText(node.nextSibling))) {
            node = node.nextSibling;
            node = utils.firstLeafUntil(node, function (n) {
                return (!utils.isMedia || !utils.isMedia(n)) && self.options.isEditableNode(n);
            });
        }

        var nodes = [];
        var next;
        while (node && !utils.isEditable(node) && !this.options.isUnbreakableNode(node)) {
            nodes.push(node);

            next = node[prevOrNext];
            while (next && !next.tagName) {
                if (!utils.getRegex('char').test(next.textContent)) {
                    next = next[prevOrNext];
                    continue;
                }
                break;
            }

            if (next) {
                break;
            }
            node = node.parentNode;
        }

        if (next && next.tagName === 'TABLE') {
            return new BoundaryPoint(node, 0);
        }

        var ifBrRemovedAndMerge = !_.filter(nodes, utils.isNodeBlockType.bind(utils)).length;
        var brRemoved = false;

        var spaceToRemove = [];
        while ((node = nodes.pop())) {
            next = node[prevOrNext];
            while (next && !next.tagName) {
                if (!utils.getRegex('char').test(next.textContent)) {
                    spaceToRemove.push(next);
                    next = next[prevOrNext];
                    continue;
                }
                break;
            }
            if (
                !next ||
                !(node.tagName || next.tagName === 'BR') ||
                !next.tagName
            ) {
                continue;
            }

            if (!brRemoved && next.tagName === 'BR' && (!next[prevOrNext] || utils.compareNodes(node, next[prevOrNext]))) {
                var newNext = next[prevOrNext];
                $(next).remove();
                next = newNext;
                var offset = (next ? direction === 'prev' : direction === 'next') ? utils.nodeLength(next) : 0;
                result = new BoundaryPoint(next || node, offset);
                if (!ifBrRemovedAndMerge) {
                    continue;
                }
                brRemoved = true;
                ifBrRemovedAndMerge = false;
            }

            if (!utils.compareNodes(node, next)) {
                continue;
            }
            _.each(spaceToRemove, function (space) {
                $(space).remove();
            });
            spaceToRemove = [];
            next = node[prevOrNext];
            var $next = $(next);
            if (next.tagName) {
                var textNode;
                var nextTextNode;
                var deep;
                if (direction === 'prev') {
                    textNode = utils.firstLeafUntil(node, function (n) {
                        return (!utils.isMedia || !utils.isMedia(n)) && self.options.isEditableNode(n);
                    });
                    if (!textNode.tagName && !utils.ancestor(textNode, utils.isPre)) {
                        this.removeExtremeBreakableSpace(textNode);
                        nextTextNode = utils.lastLeaf(next);
                        if (!nextTextNode.tagName && !utils.ancestor(nextTextNode, utils.isPre)) {
                            this.removeExtremeBreakableSpace(nextTextNode);
                        }
                    }
                    deep = utils.lastLeaf(next);
                    result = new BoundaryPoint(deep, utils.nodeLength(deep));
                    if (
                        utils.getRegex('char').test(node.textContent) || node.childElementCount > 1 ||
                        node.firstElementChild && node.firstElementChild.tagName !== "BR"
                    ) {
                        $next.append($(node).contents());
                    }
                    $(node).remove();
                } else {
                    nextTextNode = utils.firstLeafUntil(next, function (n) {
                        return (!utils.isMedia || !utils.isMedia(n)) && self.options.isEditableNode(n);
                    });
                    if (!nextTextNode.tagName && !utils.ancestor(nextTextNode, utils.isPre)) {
                        this.removeExtremeBreakableSpace(nextTextNode);
                        textNode = utils.lastLeaf(node);
                        if (!textNode.tagName && !utils.ancestor(textNode, utils.isPre)) {
                            this.removeExtremeBreakableSpace(textNode);
                        }
                    }
                    if (node.innerHTML.trim() === '<br>') {
                        $(node).contents().remove();
                    }
                    deep = utils.lastLeaf(node);
                    result = new BoundaryPoint(deep, utils.nodeLength(deep));
                    $(node).append($next.contents());
                    $next.remove();
                }
                continue;
            } else if (!utils.getRegex('char').test(next.textContent)) {
                result = new BoundaryPoint(node, direction === 'prev' ? 0 : utils.nodeLength(node));
                $next.remove();
                continue;
            }

            break;
        }

        if (!result && startN && !doNotTryNonSim) {
            result = this.deleteNonSimilarEdge(startN, direction);
        }

        var reStartOrEndNBSP = /^\u00A0|\u00A0$/g;
        if (result && result.node && reStartOrEndNBSP.test(result.node.textContent)) {
            result.node.textContent = result.node.textContent.replace(reStartOrEndNBSP, ' ');
        }

        return result;
    },
    /**
     * Find and delete the previous/next non-similar edge if possible.
     * "Similar" means that they have the same tag, styles, classes and attributes.
     *
     * @param {Node} node
     * @param {String} direction 'prev' or 'next'
     * @returns {false|Object} {node, offset}
     */
    deleteNonSimilarEdge: function (node, direction) {
        var self = this;
        var next = node[direction === 'next' ? 'nextSibling' : 'previousSibling'];
        while (
            next && utils.isText(next) &&
            utils.getRegexBlank({
                space: true,
                invisible: true,
            }).test(next.textContent)
        ) {
            next = next[direction === 'next' ? 'nextSibling' : 'previousSibling'];
        }

        if (next) {
            return;
        }

        node = utils.firstBlockAncestor(node);

        if (this.options.isUnbreakableNode(node)) {
            return;
        }

        var point = new BoundaryPoint(node, direction === 'prev' ? 0 : utils.nodeLength(node));
        var otherBlock = this._findNextBlockToMerge(point.node, direction, this.options.styleTags);

        if (!otherBlock) {
            return;
        }

        var blockToMergeFrom = direction === 'next' ? otherBlock : point.node;
        var blockToMergeInto = direction === 'next' ? point.node : otherBlock;

        // empty tag are removed
        if (
            utils.getRegexBlank({
                space: true,
                newline: true,
            }).test(blockToMergeInto.textContent) &&
            !$(blockToMergeInto).find('.fa').length && $(blockToMergeInto).find('br').length <= 1
        ) {
            $(blockToMergeInto).remove();
            var pointNode = utils.firstLeafUntil(blockToMergeFrom, function (n) {
                return (!utils.isMedia || !utils.isMedia(n)) && self.options.isEditableNode(n);
            });
            return new BoundaryPoint(pointNode, 0);
        }

        return this.mergeNonSimilarBlocks(blockToMergeFrom, blockToMergeInto);
    },
    /**
     * Deletes the contents of the selected DOM.
     *
     * @param {WrappedRange} range
     * @returns {BoundaryPoint|null}
     */
    deleteSelection: function (range) {
        if (range.isCollapsed()) {
            return null;
        }
        var point = this.deleteBetween(range.getStartPoint(), range.getEndPoint());
        point = this.fillEmptyNode(point);

        // remove tooltip when remove DOM nodes
        $('body > .tooltip').tooltip('hide');

        return point;
    },
    /**
     * Fill up an empty node so as to allow the carret to go inside it.
     * A block node will be filled with a <br>, with the offset before it.
     * An inline node will be filled with two zero-width spaces, with the offset in between the two.
     * Returns the given point (with the completed node and the updated offset).
     *
     * @param {Object} point {node, offset}
     * @returns {Object} {node, offset}
     */
    fillEmptyNode: function (point) {
        if (
            !point.node.tagName &&utils.getRegexBlank({
                space: true,
                invisible: true,
                nbsp: true,
            }).test(point.node.parentNode.innerHTML)
        ) {
            point.node = point.node.parentNode;
            point.offset = 0;
        }
        if (
            point.node.tagName && point.node.tagName !== 'BR' &&
            utils.getRegexBlank({
                space: true,
                invisible: true,
                nbsp: true,
            }).test(point.node.innerHTML)
        ) {
            var text = this.document.createTextNode('');
            point.node.innerHTML = '';
            point.node.appendChild(text);
            point.node = text;
            point.offset = 0;
        }
        if (point.node.parentNode.innerHTML === '') {
            if (utils.isNodeBlockType(point.node.parentNode)) {
                var node = point.node.parentNode;
                node.innerHTML = '<br/>';
                point.node = node.firstChild;
                point.offset = 0;
            } else {
                point.node.textContent = '\uFEFF\uFEFF';
                point.offset = 1;
            }
        }
        return point;
    },
    /**
     * Inserts a block node (respecting the rules of unbreakable nodes).
     * In order to insert the node, the DOM tree is split at the carret position.
     * If there is a selection, it is deleted first.
     *
     * @param {WrappedRange} range
     * @param {Node} node
     */
    insertBlockNode: function (node, range) {
        var self = this;
        range = range.deleteContents();
        var point = range.getStartPoint();
        var unbreakable = point.node;
        if (!this.options.isUnbreakableNode(point.node)) {
            unbreakable = utils.ancestor(point.node, function (node) {
                return self.options.isUnbreakableNode(node.parentNode) || utils.isEditable(node);
            }) || point.node;
        }

        if (unbreakable === point.node && !point.offset && point.node.tagName !== 'P') {
            if (point.node.innerHTML === '<br>') {
                $(point.node.firstElementChild).remove();
            }
            if (point.node.tagName === "BR") {
                $(point.node).replaceWith(node);
            } else {
                point.node.append(node);
            }
            return;
        }
        if (!this.options.isUnbreakableNode(point.node)) {
            var tree = this.splitTree(unbreakable, point, {
                isSkipPaddingBlankNode: true,
                isNotSplitEdgePoint: true,
            });
            if ((!tree || $.contains(tree, range.sc)) && (point.offset || point.node.tagName)) {
                tree = tree || utils.ancestor(point.node, function (node) {
                    return self.options.isUnbreakableNode(node.parentNode);
                });
                $(tree).after(node);
            } else {
                $(tree).before(node);
            }
        } else {
            // prevent unwrapped text in unbreakable
            if (utils.isText(unbreakable)) {
                $(unbreakable).wrap(this.document.createElement('p'));
                unbreakable.splitText(point.offset);
                unbreakable = unbreakable.parentNode;
                point.offset = 1;
            }
            $(unbreakable.childNodes[point.offset]).before(node);
        }
        if (range.sc.innerHTML === '<br>') {
            var clone = range.sc.cloneNode(true);
            if (node.previousSibling === range.sc) {
                $(node).after(clone);
            } else if (node.nextSibling === range.sc) {
                $(node).before(clone);
            }
        }
    },
    /**
     * Inserts a string as a text node in the DOM.
     * If the range is on a text node, splits the text node first.
     * Otherwise just inserts the text node.
     * Wraps it in a P if needed.
     *
     * @param {WrappedRange} range
     * @param {String} text
     * @returns {WrappedRange}
     */
    insertTextInline: function (text, range) {
        if (text === " ") {
            text = utils.char('nbsp');
        }
        this.editable.normalize();
        var point = this.deleteSelection(range);
        range.replace({
            sc: point.node,
            so: point.offset,
        });
        this.editable.normalize();

        if (!range.sc.tagName && /\S/.test(range.sc.textContent)) {
            var before = range.sc.textContent.slice(0, range.so);
            var after = range.sc.textContent.slice(range.so);

            if (
                (before.length || after.length) &&
                (!before.length || before[before.length - 1] === ' ') &&
                (!after.length || after[0] === ' ')
            ) {
                var startSpace = utils.getRegex('startSpace');
                var endSpace = utils.getRegex('endSpace');
                before = before.replace(endSpace, utils.char('nbsp'));
                after = after.replace(startSpace, utils.char('nbsp'));
                range.sc.textContent = before + after;
                if (range.so > before.length) {
                    range.so = range.eo = before.length;
                }
            }
        }


        range.deleteContents();
        range.standardizeRangeOnEdge(this.options.isEditableNode);
        var textNode = this._insertTextNodeInEditableArea(range, text);

        // if the text node can't be inserted in the dom (not editable area) do nothing
        if (!textNode) {
            return;
        }

        this.secureExtremeSingleSpace(range.sc);

        this._wrapTextWithP(textNode);

        range = range.replace({
            sc: textNode,
            so: text.length,
        }).normalize();

        this.editable.normalize();

        // Clean up and make leading/trailing/multiple space visible
        var reStartBlanks = utils.getRegex('startBlanks', '', '^([\\s\\u00A0\\uFEFF]*)');
        var reEndBlanks = utils.getRegex('endBlanks', '', '([\\s\\u00A0\\uFEFF]*)$');
        var reAllNBSP = /\u00A0/g;
        var reMultipleSpace = /(\s){2,}/;

        var startBlanks = range.sc.textContent.match(reStartBlanks)[0] || '';
        var endBlanks = range.sc.textContent.match(reEndBlanks)[0] || '';
        var trimmed = range.sc.textContent.replace(reStartBlanks, '').replace(reEndBlanks, '');
        // Remove the single inner nbsp's and replace the multiple inner spaces with nbsp's
        var cleanContents = trimmed.replace(reAllNBSP, ' ')
            .replace(reMultipleSpace, function (space) {
                return Array(space.length + 1).join(utils.char('nbsp'));
            });
        // Keep the leading/trailing whitespace, nbsp's and zero-width chars
        range.sc.textContent = startBlanks + cleanContents + endBlanks;

        return this._removeInvisibleChar(range);
    },
    /**
     * Merges mergeFromBlock into mergeIntoBlock, respecting the rules of unbreakable.
     *
     * @param {Node} mergeFromBlock block to merge from
     * @param {Node} mergeIntoBlock block to merge into
     * @returns {Object} {node, offset}
     */
    mergeNonSimilarBlocks: function (mergeFromBlock, mergeIntoBlock) {
        var point;
        var mergeableTags = this.options.styleTags.join(', ') + ', li';
        var $contents = $(mergeFromBlock).find('*').addBack()
            .filter(mergeableTags)
            .filter(function (i, n) {
                if (!(n.tagName === 'LI' && $(n).find(mergeableTags).length)) {
                    return n;
                }
            }).contents();
        var containsUnbreakables = !!$contents.filter(this.options.isUnbreakable).length;

        if ($contents.length && !containsUnbreakables) {
            if (utils.isText($contents[0])) {
                this.removeExtremeBreakableSpace($contents[0]);
            }
            var $lastContents = $(mergeIntoBlock).contents().last();
            if (!($contents.length === 1 && $contents[0].tagName === 'BR')) {
                if (mergeIntoBlock.innerHTML.trim() === '<br>') {
                    $(mergeIntoBlock).contents().remove();
                    $(mergeIntoBlock).append($contents);
                    $lastContents = false;
                } else {
                    $lastContents.after($contents);
                }
            }
            while (mergeFromBlock.parentNode && utils.isBlankNode(mergeFromBlock.parentNode)) {
                mergeFromBlock = mergeFromBlock.parentNode;
            }
            $(mergeFromBlock).remove();

            point = {};
            if ($lastContents && $lastContents.length) {
                point = new BoundaryPoint($lastContents[0], utils.nodeLength($lastContents[0]));
            } else {
                point = new BoundaryPoint($contents[0], 0);
            }

            point = this.deleteEdge(point.node, 'next', true) || point;
        }
        return point;
    },
    /**
     * Remove the given node from the DOM.
     *
     * @param {Node} node
     * @param {Boolean} isRemoveChild true to remove the node's child as well
     */
    remove: function (node, isRemoveChild) {
        if (!node || !node.parentNode) {
            return;
        }
        if (node.removeNode) {
            node.removeNode(isRemoveChild);
            return;
        }
        var parent = node.parentNode;
        if (!isRemoveChild) {
            var nodes = [];
            for (var i = 0, len = node.childNodes.length; i < len; i++) {
                nodes.push(node.childNodes[i]);
            }
            for (var i = 0, len = nodes.length; i < len; i++) {
                parent.insertBefore(nodes[i], node);
            }
        }
        parent.removeChild(node);
    },
    /**
     * Remove a node's direct blank siblings, if any.
     * Eg: Text<i></i>Node<b></b>Text => TextNodeText
     *
     * @param {Node} node
     */
    removeBlankSiblings: function (node) {
        var isAfterBlank = node.previousSibling && utils.isBlankNode(node.previousSibling);
        if (isAfterBlank) {
            $(node.previousSibling).remove();
        }
        var isBeforeBlank = node.nextSibling && utils.isBlankNode(node.nextSibling);
        if (isBeforeBlank) {
            $(node.nextSibling).remove();
        }
    },
    /**
     * Removes the block target and joins its siblings.
     *
     * @param {Node} target
     * @param {Boolean} doNotInsertP true to NOT fill an empty unbreakable with a p element.
     * @returns {Object} {node, offset}
     */
    removeBlockNode: function (target, doNotInsertP) {
        var check = function (point) {
            if (point.node === target) {
                return false;
            }
            return !point.node || this.options.isEditableNode(point.node) &&
                (point.node.tagName === "BR" || utils.isVisibleText(point.node));
        }.bind(this);
        var parent = target.parentNode;
        var offset = [].indexOf.call(parent.childNodes, target);
        var deleteEdge = 'next';
        var startPoint = new BoundaryPoint(target, 0);
        var point = startPoint.prevUntil(check);
        if (!point || !point.node) {
            deleteEdge = 'prev';
            point = startPoint.nextUntil(check);
        }
        if (!point || !point.node) {
            var invisibleTextNode = this.document.createTextNode(utils.char('zeroWidth'));
            $(target).before(invisibleTextNode);
            point = startPoint.replace(invisibleTextNode, 1);
        }

        $(target).remove();

        if (
            point && (deleteEdge === 'prev' && point.offset) ||
            deleteEdge === 'next' && point.offset === utils.nodeLength(point.node)
        ) {
            point = this.deleteEdge(point.node, deleteEdge) || point;
        }

        $(parent).contents().filter(function () {
            return utils.isText(this) && utils.getRegexBlank({
                atLeastOne: true,
                invisible: true,
            }).test(this.textContent);
        }).remove();

        var br;
        if (parent.innerHTML === '') {
            br = this.document.createElement('br');
            $(parent).append(br);
            point = startPoint.replace(parent, 0);
        }

        if (!doNotInsertP && utils.getRegexBlank({
                space: true,
                invisible: true,
            }).test(parent.innerHTML)) {
            br = this.document.createElement('br');
            if (this.options.isUnbreakableNode(parent) && parent.tagName !== "TD") {
                var p = this.document.createElement('p');
                $(p).append(br);
                $(parent).append(p);
            } else {
                $(parent).append(br);
            }
            point = startPoint.replace(br.parentNode, 0);
        }

        if (point && point.node.tagName === "BR" && point.node.parentNode) {
            point = startPoint.replace(point.node.parentNode, [].indexOf.call(point.node.parentNode.childNodes, point.node));
        }

        return point && point.node && point.offset ? point : startPoint.replace(parent, offset);
    },
    /**
     * Removes the empty inline nodes around the point, and joins its siblings.
     *
     * @param {Object} point {node, offset}
     * @returns {Object} {node, offset}
     */
    removeEmptyInlineNodes: function (point) {
        var node = point.node;
        if (!point.node.tagName && !point.node.textContent.length) {
            node = node.parentNode;
            if ($(node).hasClass('o_default_snippet_text')) {
                // for default snippet value
                return point;
            }
        }
        var prev;
        var next;
        while (
            node.tagName !== 'BR' &&
            (node.tagName ? node.innerHTML : node.textContent) === '' &&
            !utils.isNodeBlockType(node) &&
            this.options.isEditableNode(node.parentNode) &&
            (!node.attributes || !node.attributes.contenteditable) &&
            !utils.isMedia(node)
        ) {
            prev = node.previousSibling;
            next = node.nextSibling;
            point = new BoundaryPoint(node.parentNode, [].indexOf.call(node.parentNode.childNodes, node));
            $(node).remove();
            node = point.node;
        }
        if (next && !next.tagName) {
            if (/^\s+[^\s<]/.test(next.textContent)) {
                next.textContent = next.textContent.replace(utils.getRegex('startSpace'), utils.char('nbsp'));
            }
        }
        if (prev) {
            if (!prev.tagName) {
                if (/[^\s>]\s+$/.test(prev.textContent)) {
                    prev.textContent = prev.textContent.replace(utils.getRegex('endSpace'), ' ');
                }
            }
            point = new BoundaryPoint(prev, utils.nodeLength(prev));
        }
        return point;
    },
    /**
     * Removes any amount of leading/trailing breakable space from a text node.
     * Returns how many characters were removed at the start
     * and at the end of the text node.
     *
     * @param {Node} textNode
     * @param {Boolean} secureExtremeties (defaults to true)
     * @returns {Object} removed {start, end}
     */
    removeExtremeBreakableSpace: function (textNode, secureExtremeties) {
        if (arguments.length === 1) {
            secureExtremeties = true;
        }
        if (secureExtremeties) {
            this.secureExtremeSingleSpace(textNode);
        }
        var removed = {
            start: 0,
            end: 0,
        };
        textNode.textContent = textNode.textContent.replace(utils.getRegex('startNotChar'), function (toRemove) {
            removed.start = toRemove.length;
            return '';
        });
        textNode.textContent = textNode.textContent.replace(utils.getRegex('endNotChar'), function (toRemove) {
            removed.end = toRemove.length;
            return '';
        });
        return removed;
    },
    /**
     * Makes the leading/trailing single space of a node non breakable (nbsp).
     *
     * @param {Node} node
     */
    secureExtremeSingleSpace: function (node) {
        if (utils.getRegex('endSingleSpace').test(node.textContent)) {
            // if the text ends with a single space, make it insecable
            node.textContent = node.textContent.substr(0, node.textContent.length - 1) + utils.char('nbsp');
        }
        if (utils.getRegex('startSingleSpace').test(node.textContent)) {
            // if the text starts with a single space, make it insecable
            node.textContent = utils.char('nbsp') + node.textContent.substr(1, node.textContent.length);
        }
    },
    /**
     * Split the DOM tree at the node's start and end points.
     *
     * @param {Node} node
     */
    splitAtNodeEnds: function (node) {
        if (!node.parentNode) {
            return;
        }
        var startPoint = new BoundaryPoint(node, 0);
        var endPoint = new BoundaryPoint(node, utils.nodeLength(node));
        var splitOptions = {
            isSkipPaddingBlankNode: true,
        };
        this.splitTree(node.parentNode, startPoint, splitOptions);
        this.splitTree(node.parentNode, endPoint, splitOptions);
        // Splitting at ends may create blank nodes (because of this.splitTree) so let's clean it up:
        this.removeBlankSiblings(node.parentNode);
    },
    /**
     * Split the text nodes at range start and end points, if any.
     *
     * @param {WrappedRange} range
     * @returns {WrappedRange}
     */
    splitTextAtSelection: function (range) {
        var sameNode = range.sc === range.ec;
        var ecAfterSplit = this._splitText(range.getEndPoint());
        if (ecAfterSplit) {
            range.ec = ecAfterSplit.previousSibling;
            range.eo = utils.nodeLength(range.ec);
        }
        var scAfterSplit = this._splitText(range.getStartPoint());
        if (scAfterSplit) {
            range.sc = scAfterSplit;
            if (sameNode) {
                range.ec = range.sc;
                range.eo -= range.so;
            }
            range.so = 0;
        }
        return range;
    },
    /**
     * Split the DOM tree at given point, up until given root.
     * Note: By default, pad potentially generated blank elements.
     *
     * Eg.:
     * Dom: `<p><b>text</b></p>`
     * Point: `text` node, with offset 2
     * - Example 1: root is `<b>` node
     * -> Result: `<p><b>te</b><b>xt</b></p>`
     * -> Return: `<b>xt</b>` node
     * - Example 2: root is `<p>` node
     * -> Result: `<p><b>te</b></p><p><b>xt</b></p>`
     * -> Return: `<p><b>xt</b></p>` node
     *
     * @param {Node} root node up to which to split the tree
     * @param {BoundaryPoint} point
     * @param {Object} [options]
     * @param {Boolean} [options.nextText] - default: false
     * @param {Boolean} [options.isSkipPaddingBlankNode] true to NOT pad blank nodes - default: false
     * @param {Boolean} [options.isNotSplitEdgePoint] true to NOT if the point is on an edge - default: false
     * @returns {Node} right node of point
     */
    splitTree: function (root, point, options) {
        var self = this;
        var next;
        var nextText;
        if (options && options.nextText && utils.isText(point.node)) {
            nextText = point.node.splitText(point.offset);
        }
        var emptyText = false;
        if (utils.isText(point.node) && point.node.textContent === "") {
            emptyText = true;
            point.node.textContent = utils.char('zeroWidth');
            point.offset = 1;
        }
        var ancestors = utils.listAncestor(point.node, function (n) {
            return n === root;
        });
        switch (ancestors.length) {
            case 0:
                next = null;
                break;
            case 1:
                next = this._splitNode(point, options);
                break;
            default:
                next = ancestors.reduce(function (node, parent) {
                    node = node === point.node ? self._splitNode(point, options) : node;
                    var splitPoint = new BoundaryPoint(parent, node ? utils.position(node) : utils.nodeLength(parent));
                    return self._splitNode(splitPoint, options);
                });
                break;
        }
        if (emptyText) {
            point.node.textContent = '';
        }
        var result = nextText || next || point.node;
        var att = nextText ? 'textContent' : 'innerHTML';
        if (/^\s+([^\s<])/.test(result[att])) {
            result[att] = result[att].replace(utils.getRegex('startSpace'), utils.char('nbsp'));
        }
        return result;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Find the previous/next non-similar block to merge with.
     * "Similar" means that they have the same tag, styles, classes and attributes.
     *
     * @private
     * @param {Node} node
     * @param {String} direction 'prev' or 'next
     * @returns {false|Node}
     */
    _findNextBlockToMerge: function (node, direction) {
        var startNode = node;
        var mergeableTags = this.options.styleTags.join(', ') + ', li';
        var blockToMerge = false;

        var li = utils.ancestor(node, function (n) {
            return n !== node && utils.isNodeBlockType(n) || utils.isLi(n);
        });
        li = li && utils.isLi(li) ? li : undefined;
        if (li && direction === 'next') {
            if (li.nextElementSibling) {
                node = li;
            } else {
                node = utils.ancestor(node, function (n) {
                    return ((n.tagName === 'UL' || n.tagName === 'OL') && n.nextElementSibling);
                });
            }
        }

        if (!node || !node[direction === 'next' ? 'nextElementSibling' : 'previousElementSibling']) {
            return false;
        }

        node = node[direction === 'next' ? 'nextElementSibling' : 'previousElementSibling'];

        var ulFoldedSnippetNode = utils.ancestor(node, function (n) {
            return $(n).hasClass('o_ul_folded');
        });
        var ulFoldedSnippetStartNode = utils.ancestor(startNode, function (n) {
            return $(n).hasClass('o_ul_folded');
        });
        if (
            (this.options.isUnbreakableNode(node) && (!ulFoldedSnippetNode || utils.isEditable(ulFoldedSnippetNode))) &&
            this.options.isUnbreakableNode(startNode) && (!ulFoldedSnippetStartNode || utils.isEditable(ulFoldedSnippetStartNode))
        ) {
            return false;
        }

        node = utils.firstBlockAncestor(node);

        li = utils.ancestor(node, function (n) {
            return n !== node && utils.isNodeBlockType(n) || utils.isLi(n);
        });
        li = li && utils.isLi(li) ? li : undefined;
        node = li || node;

        if (node.tagName === 'UL' || node.tagName === 'OL') {
            node = node[direction === 'next' ? 'firstElementChild' : 'lastElementChild'];
        }

        if (this.options.isUnbreakableNode(node)) {
            return false;
        }

        if (node === startNode || $(node).has(startNode).length || $(startNode).has(node).length) {
            return false;
        }

        var $mergeable = $(node).find('*').addBack()
            .filter(mergeableTags)
            .filter(function (i, n) {
                if (!(n.tagName === 'LI' && $(n).find(mergeableTags).length)) {
                    return n;
                }
            });
        if ($mergeable.length) {
            blockToMerge = $mergeable[direction === 'next' ? 'first' : 'last']()[0] || false;
        }

        return blockToMerge;
    },
    /**
     * Insert a given node after a given `preceding` node.
     *
     * @private
     * @param {Node} node
     * @param {Node} preceding
     * @returns {Node}
     */
    _insertAfter: function (node, preceding) {
        var next = preceding.nextSibling;
        var parent = preceding.parentNode;
        if (next) {
            parent.insertBefore(node, next);
        }
        else {
            parent.appendChild(node);
        }
        return node;
    },
    _insertTextNodeInEditableArea: function (range, text) {
        // try to insert the text node in editable area
        var textNode = this.document.createTextNode(text);
        if (this.options.isEditableNode(range.sc) && $(range.sc).closest('[contenteditable]').attr('contenteditable') === 'true') {
            if (utils.isText(range.sc) && utils.isVisibleText(range.sc)) {
                var invisibleToRemove = /^\uFEFF+$/.test(range.sc.textContent) && range.sc;
                // If range is on visible text: split the text at offset and insert the text node
                if (!invisibleToRemove) {
                    range.sc.splitText(range.so);
                    range.so = range.eo = utils.nodeLength(range.sc);
                }
                $(range.sc).after(textNode);
                if (invisibleToRemove) {
                    $(invisibleToRemove).remove();
                    range.replace({
                        sc: textNode,
                        so: utils.nodeLength(textNode),
                    });
                }
            } else if (utils.isBR(range.sc)) {
                if (range.sc.nextSibling && utils.isVisibleText(range.sc.nextSibling)) {
                    $(range.sc).before(textNode);
                } else {
                    $(range.sc).replaceWith(textNode);
                }
            } else if (utils.isVoid(range.sc)) {
                $(range.sc).before(textNode);
            } else if (range.sc.childNodes[range.so]) {
                var node = range.sc.childNodes[range.so];
                if (utils.isBR(node)) {
                    $(node).replaceWith(textNode);
                } else {
                    $(node).before(textNode);
                }
            } else if (utils.isText(range.sc)) {
                $(range.sc).after(textNode);
            } else if (this.options.isUnbreakableNode(range.sc)) {
                $(range.sc).append(textNode);
            }
        }
        if (!textNode.parentNode && this.options.isEditableNode(range.sc.parentNode)) {
            $(range.sc).before(textNode);
        }

        return textNode.parentNode && textNode;
    },
    /**
     * Pad the given node with `utils.blank` if the node is empty (for cursor position).
     *
     * @private
     * @param {Node} node
     */
    _padBlankNode: function (node) {
        if (!utils.isVoid(node) && !utils.nodeLength(node)) {
            node.innerHTML = utils.blank;
        }
    },
    /**
     * Perform operations that are necessary after the insertion of a visible character:
     * adapt range for the presence of zero-width characters, move out of media, rerange.
     *
     * @private
     * @param {WrappedRange} range
     * @returns {WrappedRange}
     */
    _removeInvisibleChar: function (range) {
        if (range.sc.tagName || utils.ancestor(range.sc, utils.isAnchor)) {
            return range;
        }
        var fake = range.sc.parentNode;
        if (fake.classList.contains('o_fake_editable') && utils.isMedia(fake)) {
            var $media = $(fake.parentNode);
            $media[fake.previousElementSibling ? 'after' : 'before'](fake.firstChild);
        }
        if (range.sc.textContent.slice(range.so - 2, range.so - 1) === utils.char('zeroWidth')) {
            range.sc.textContent = range.sc.textContent.slice(0, range.so - 2) + range.sc.textContent.slice(range.so - 1);
            range.so = range.eo = range.so - 1;
        }
        if (range.sc.textContent.slice(range.so, range.so + 1) === utils.char('zeroWidth')) {
            range.sc.textContent = range.sc.textContent.slice(0, range.so) + range.sc.textContent.slice(range.so + 1);
        }
        return range;
    },
    /**
     * Split the given point's element node at its offset.
     *
     * @private
     * @param {BoundaryPoint} point
     * @param {Object} [options]
     * @param {Boolean} [options.isSkipPaddingBlankNode] true to NOT pad blank nodes - default: false
     * @param {Boolean} [options.isNotSplitEdgePoint] true to NOT if the point is on an edge - default: false
     * @returns {Node} right node of point
     */
    _splitElement: function (point, options) {
        options = options || {};
        if (utils.isText(point.node)) {
            return;
        }
        if (options.isNotSplitEdgePoint && point.isEdge()) {
            return point.isLeftEdge() ? point.node : point.node.nextSibling;
        }
        var childNode = point.node.childNodes[point.offset];
        var clone = this._insertAfter(point.node.cloneNode(false), point.node);
        utils.appendChildNodes(clone, utils.listNext(childNode));
        if (!options.isSkipPaddingBlankNode) {
            this._padBlankNode(point.node);
            this._padBlankNode(clone);
        }
        return clone;
    },
    /**
     * Split the given point's node at its offset.
     *
     * @private
     * @param {BoundaryPoint} point
     * @param {Object} [options]
     * @param {Boolean} [options.isSkipPaddingBlankNode] true to NOT pad blank nodes - default: false
     * @param {Boolean} [options.isNotSplitEdgePoint] true to NOT if the point is on an edge - default: false
     * @returns {Node} right node of point
     */
    _splitNode: function (point, options) {
        options = options || {};

        if (utils.isText(point.node)) {
            return this._splitText(point);
        } else {
            return this._splitElement(point, options);
        }
    },
    /**
     * Split the given point's text node at its offset.
     *
     * @private
     * @param {BoundaryPoint} point
     * @returns {Node} right node of point
     */
    _splitText: function (point) {
        if (!utils.isText(point.node)) {
            return;
        }
        if (point.isEdge()) {
            return point.isLeftEdge() ? point.node : point.node.nextSibling;
        }
        return point.node.splitText(point.offset);
    },
    _wrapTextWithP: function (textNode) {
        if (utils.ancestor(textNode, utils.isAnchor)) {
            return;
        }
        var self = this;
        var isFormatNode = utils.ancestor(textNode, function (n) {
            return utils.isFormatNode(n, self.options.styleTags);
        });
        if (!isFormatNode) {
            var hasInlineParent = utils.ancestor(textNode.parentNode, function (node) {
                return !utils.isNodeBlockType(node);
            });
            if (
                !hasInlineParent &&
                (textNode.tagName ||
                    !(textNode.previousSibling && utils.isVisibleText(textNode.previousSibling) ||
                      textNode.nextSibling && utils.isVisibleText(textNode.nextSibling))
                )
            ) {
                var blankP = this.document.createElement('p');
                $(textNode).after(blankP);
                $(blankP).prepend(textNode);
            }
        }
    },
});

return Dom;
});
