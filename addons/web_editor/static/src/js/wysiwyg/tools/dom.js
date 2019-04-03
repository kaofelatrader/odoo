odoo.define('wysiwyg.Dom', function (require) {
'use strict';

var BoundaryPoint = require('wysiwyg.BoundaryPoint');
var Class = require('web.Class');
var utils = require('wysiwyg.utils');

var Dom = Class.extend({
    /**
     * @param {Object} options
     * @param {Function (Node) => Boolean} options.isVoidBlock
     * @param {Function (Node) => Boolean} options.isEditableNode
     * @param {Function (Node) => Boolean} options.isUnbreakableNode
     */
    init: function (options) {
        this.options = options;
    },

    /**
     * Remove the DOM between 2 points (respecting unbreakable rules).
     *
     * @param {BoundaryPoint} pointA
     * @param {BoundaryPoint} pointB
     * @param {Boolean} [doPadBlank]
     * @returns {BoundaryPoint}
     */
    deleteBetween: function (pointA, pointB, doPadBlank) {
        var nextNode = this._prepareDelete(pointA, pointB);
        var nodes = this._getNodesToDelete(pointA, nextNode);
        $(nodes).remove();
        var newPoint = this._cleanAfterDelete(pointA, nextNode, nodes, doPadBlank);
        if (newPoint && utils.isEditable(newPoint.node)) {
            newPoint.replace(newPoint.node.firstElementChild, 0);
        }
        return newPoint || pointA;
    },
    /**
     * Remove the edge between a node and its sibling
     * (= merge the nodes, respecting unbreakable rules).
     *
     * @param {Node} node
     * @param {Boolean} isPrev true to delete previous edge, false for next
     * @param {Object} [options]
     * @param {Boolean} [options.isTryNonSim] (default: true) - true to try merging non-similar nodes
     * @param {Boolean} [options.isRemoveBlock] (default: true) - true to not try merging non-similar nodes
     * @returns {BoundaryPoint|null} (null if no change)
     */
    deleteEdge: function (node, isPrev, options) {
        return this._deleteEdgeRec(node, isPrev, false, options);
    },
    /**
     * Deletes the contents of the selected DOM.
     *
     * @param {WrappedRange} range
     * @param {Boolean} [doPadBlank]
     * @returns {BoundaryPoint|null}
     */
    deleteSelection: function (range, doPadBlank) {
        if (range.isCollapsed()) {
            return range.getStartPoint();
        }
        var point = this.deleteBetween(range.getStartPoint(), range.getEndPoint(), doPadBlank);

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
            !point.node.tagName && utils.getRegexBlank({
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
            var text = document.createTextNode('');
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
            if ((!tree || $.contains(tree, range.sc) || tree === range.sc) && (point.offset || point.node.tagName)) {
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
                $(unbreakable).wrap(document.createElement('p'));
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
        var point = this.deleteSelection(range, true);
        while (!point.welcomesText()) {
            point.enter();
        }
        range.replace({
            sc: point.node,
            so: point.offset,
        });
        range.deleteContents();
        range.standardizeRangeOnEdge(this.options.isEditableNode);

        var textNode = this._insertTextNodeInEditableArea(range, text);
        // if the text node can't be inserted in the dom (not editable area) do nothing
        if (!textNode) {
            return range;
        }
        range.replace({
            sc: textNode,
            so: utils.nodeLength(textNode),
        });

        this.secureExtremeSingleSpace(range.sc);
        return this._removeInvisibleChar(range);
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
        var isAfterBlank = node.previousSibling && utils.isBlankNode(node.previousSibling, this.options.isVoidBlock);
        if (isAfterBlank) {
            $(node.previousSibling).remove();
        }
        var isBeforeBlank = node.nextSibling && utils.isBlankNode(node.nextSibling, this.options.isVoidBlock);
        if (isBeforeBlank) {
            $(node.nextSibling).remove();
        }
    },
    /**
     * Removes the block target and joins its siblings.
     *
     * @param {Node} target
     * @param {Boolean} doNotInsertP true to NOT fill an empty unbreakable with a p element.
     * @param {Boolean} doRemoveAgain true to allow removing another block on delete edge.
     * @returns {BoundaryPoint}
     */
    removeBlockNode: function (target, doNotInsertP, doRemoveAgain) {
        var parent = target.parentNode;
        var offset = [].indexOf.call(parent.childNodes, target);
        var point = this._removeBlock(target, doRemoveAgain);
        this._removeBlankContents(parent);
        point = this._cleanAfterRemoveBlock(point, doNotInsertP);

        return point && point.node && (point.offset || point.offset === 0) ? point : new BoundaryPoint(parent, offset);
    },
    /**
     * Removes the empty inline nodes around the point, and joins its siblings.
     *
     * @param {BoundaryPoint} point
     * @returns {BoundaryPoint}
     */
    removeEmptyInlineNodes: function (point) {
        var node = point.node;
        if (utils.isText(point.node) && !point.node.textContent.length) {
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
            (utils.isText(node) ? node.textContent : node.innerHTML) === '' &&
            !utils.isNodeBlockType(node) &&
            this.options.isEditableNode(node.parentNode) &&
            (!node.attributes || !node.attributes.contenteditable) &&
            !this.options.isVoidBlock(node)
        ) {
            prev = node.previousSibling;
            next = node.nextSibling;
            point = new BoundaryPoint(node.parentNode, [].indexOf.call(node.parentNode.childNodes, node));
            $(node).remove();
            node = point.node;
        }
        if (next && utils.isText(next)) {
            if (/^\s+[^\s<]/.test(next.textContent)) {
                next.textContent = next.textContent.replace(utils.getRegex('startSpace'), utils.char('nbsp'));
            }
        }
        if (prev) {
            if (utils.isText(prev)) {
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
        this.splitTree(node.parentNode, endPoint, splitOptions);
        this.splitTree(node.parentNode, startPoint, splitOptions);
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
     * Clean the DOM after deleting a selection:
     * - remove inline nodes if needed
     * - clean a list if needed (remove empty li, ul, ol)
     * - delete edges if needed
     *
     * @private
     * @param {BoundaryPoint} point
     * @param {Node} nextNode
     * @param {Node []} removedNodes
     * @param {Boolean} [doPadBlank]
     * @returns {BoundaryPoint}
     */
    _cleanAfterDelete: function (point, nextNode, removedNodes, doPadBlank) {
        var newPoint = new BoundaryPoint(nextNode, 0)
            .enterUntil(utils.and(this.options.isVoidBlock, this.options.isEditableNode));

        if (removedNodes.length > 1 || removedNodes.length && !utils.isText(removedNodes[0])) {
            newPoint.replace(this.removeEmptyInlineNodes(point));
        }

        this._cleanListAfterDelete(point, nextNode);

        if (!utils.editableAncestor(point.node)) {
            point.replace(newPoint);
        }

        if (removedNodes.length && point.node.parentNode !== nextNode.parentNode) {
            if (doPadBlank && utils.isBlankNode(point.node)) {
                this._padBlankNode(point.node);
            }
            return this.deleteEdge(point.node, false) || point;
        }

        return point.replace(this.fillEmptyNode(point));
    },
    /**
     * Clean point after removing a block:
     * - Pad/fill its node if needed
     * - Move it if it's in a BR
     *
     * @private
     * @param {BoundaryPoint} point
     * @param {Boolean} doNotInsertP true to NOT fill an empty unbreakable with a p element.
     * @returns {BoundaryPoint} point
     */
    _cleanAfterRemoveBlock: function (point, doNotInsertP) {
        var parentIsBlank = utils.getRegexBlank({
            space: true,
            invisible: true,
        }).test(point.node.parentNode.innerHTML);
        if (!doNotInsertP && parentIsBlank) {
            var p = this._fillNode(point.node.parentNode);
            point.replace(p, 0);
        }

        if (point && point.node.tagName === "BR" && point.node.parentNode) {
            point.replace(point.node.parentNode, [].indexOf.call(point.node.parentNode.childNodes, point.node));
        }

        return point;
    },
    /**
     * Remove whole li/ul/ol if deleted all contents of li/ul/ol.
     *
     * @private
     * @param {BoundaryPoint} point
     * @param {Node} nextNode
     */
    _cleanListAfterDelete: function (point, nextNode) {
        var self = this;
        var ul = utils.ancestor(nextNode, utils.isList);
        var isNextNodeBlank = nextNode[utils.isText(nextNode) ? 'textContent' : 'innerHTML'] === '';
        if (!ul || !isNextNodeBlank || point.node === nextNode.previousSibling) {
            return;
        }
        var toRemove = nextNode;
        var isParentBreakableBlank = function (node) {
            return node.parentNode &&
                !self.options.isUnbreakableNode(node.parentNode) &&
                utils.isBlankNode(node.parentNode);
        };
        while (toRemove !== ul && isParentBreakableBlank(toRemove)) {
            toRemove = toRemove.parentNode;
        }
        $(toRemove).remove();
    },
    /**
     * Recursive helper to `deleteEdge`. Delete the edge between a node and its sibling,
     * then do the same inside the node and at its new edges until there is nothing to
     * do anymore. If the first next sibling is void, remove it (unless `isRemoveBlock`
     * is false). Return a point on which to focus (see `_getDeleteEdgeResult`).
     *
     * @see deleteEdge
     * @see removeBlockNode
     * @see _getDeleteEdgeResult
     * @private
     * @param {Node} node
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @param {Boolean} didChange true if anything was changed with deleteEdge yet
     * @param {Object} [options]
     * @param {Boolean} [options.isTryNonSim] (default: true) - true to try merging non-similar nodes
     * @param {Boolean} [options.isRemoveBlock] (default: true) - true to not try merging non-similar nodes
     * @returns {Point|null} null if nothing changed
     */
    _deleteEdgeRec: function (node, isPrev, didChange, options) {
        options = utils.defaults(options || {}, {
            isTryNonSim: true,
            isRemoveBlock: true,
        });
        var edgeMethod = utils[isPrev ? 'isLeftEdge' : 'isRightEdge'].bind(utils);
        while (node.parentNode && edgeMethod(node) && !utils.isEditable(node.parentNode)) {
            node = node.parentNode;
        }
        var next = isPrev ? node.previousSibling : node.nextSibling;
        while (next && utils.isInvisibleText(next)) {
            next = isPrev ? next.previousSibling : next.nextSibling;
        }

        if (!utils.isText(node) && utils.isBlankNode(node) && options.isRemoveBlock) {
            return this.removeBlockNode(node, false, true);
        }
        if (options.isRemoveBlock && (this.options.isVoidBlock(node) || utils.isVoid(node))) {
            // special case: may call deleteEdge again
            return this.removeBlockNode(node, false, true);
        }

        if (!next || this.options.isUnbreakableNode(next)) {
            return this._getDeleteEdgeResult(node, isPrev, didChange); // base case
        }
        if (!utils.isText(next) && utils.isBlankNode(next)) {
            return options.isRemoveBlock ? this.removeBlockNode(next, false, true) : this._getDeleteEdgeResult(node, isPrev, didChange);
        }
        if (this.options.isVoidBlock(next) || utils.isVoid(next)) {
            // special case: may call deleteEdge again
            return options.isRemoveBlock ? this.removeBlockNode(next) : this._getDeleteEdgeResult(node, isPrev, didChange);
        }
        if (utils.compareNodes(node, next)) {
            next = isPrev ? [node, node = next][0] : next; // swap node and next
            if (utils.isText(node) && utils.isText(next)) {
                return this._mergeTextNodes(node, next, isPrev, didChange); // base case
            }
            return this._mergeNodes(node, next, isPrev, options); // recursive: calls back _deleteEdgeRec
        }
        if (utils.isText(node) && !utils.welcomesText(node.parentNode) || utils.isText(next) && !utils.welcomesText(next.parentNode)) {
            next = utils.isText(node) ? [node, node = next][0] : next; // next is text, node is elem
            return this._mergeTextIntoElement(node, next, isPrev); // base case
        }
        if (options.isTryNonSim) {
            next = this._findNextBlockToMerge(node, isPrev);
            if (next) {
                if (utils.isList(node) && !utils.isLi(next)) {
                    node = utils[isPrev ? 'lastLeafUntil' : 'firstLeafUntil'](node, utils.not(utils.isLi.bind(utils)));
                    node = isPrev ? node.lastElementChild || node : node.firstElementChild || node;
                }
                next = isPrev ? [node, node = next][0] : next; // swap node and next
                return this._mergeNodes(node, next, isPrev, options); // recursive: calls back _deleteEdgeRec
            }
        }
        return this._getDeleteEdgeResult(node, isPrev, didChange); // base case
    },
    /**
     * Fill a node tu ensure correct DOM and selection.
     *
     * @private
     * @param {Node} node
     * @returns {Node}
     */
    _fillNode: function (node) {
        if (this.options.isUnbreakableNode(node) && node.tagName !== "TD") {
            var p = document.createElement('p');
            this._padBlankNode(p);
            $(node).append(p);
        } else {
            this._padBlankNode(node);
        }
        return node;
    },
    /**
     * Find the previous/next non-similar block to merge with.
     * "Similar" means that they have the same tag, styles, classes and attributes.
     *
     * @private
     * @param {Node} node
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @returns {false|Node}
     */
    _findNextBlockToMerge: function (node, isPrev) {
        var startNode = node;
        var mergeableTags = this.options.styleTags.join(', ') + ', li';
        var blockToMerge = false;

        var li = utils.ancestor(node, function (n) {
            return n !== node && utils.isNodeBlockType(n) || utils.isLi(n);
        });
        li = li && utils.isLi(li) ? li : undefined;
        if (li && !isPrev) {
            if (li.nextElementSibling) {
                node = li;
            } else {
                node = utils.ancestor(node, function (n) {
                    return ((n.tagName === 'UL' || n.tagName === 'OL') && n.nextElementSibling);
                });
            }
        }

        if (!node || !node[!isPrev ? 'nextElementSibling' : 'previousElementSibling']) {
            return false;
        }

        node = node[!isPrev ? 'nextElementSibling' : 'previousElementSibling'];

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
            node = node[!isPrev ? 'firstElementChild' : 'lastElementChild'];
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
            blockToMerge = $mergeable[!isPrev ? 'first' : 'last']()[0] || false;
        }

        return blockToMerge;
    },
    /**
     * Get a focusable point after deleting edges or null if nothing was deleted.
     *
     * @see deleteEdge
     * @private
     * @param {Node} node
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @param {Boolean} didChange true if anything was changed with deleteEdge
     * @param {Number} offset
     * @returns {BoundaryPoint|null} null if nothing changed
     */
    _getDeleteEdgeResult: function (node, isPrev, didChange, offset) {
        node = utils[isPrev ? 'firstLeaf' : 'lastLeaf'](node);
        if (!offset && offset !== 0) {
            offset = isPrev ? 0 : utils.nodeLength(node);
        }
        return didChange ? new BoundaryPoint(node, offset) : null;
    },
    /**
     * Return a list of nodes to delete between a starting point
     * and the node that follows the selection (after tree split).
     *
     * @private
     * @param {BoundaryPoint} startPoint
     * @param {Node} nextNode
     * @returns {Node []}
     */
    _getNodesToDelete: function (startPoint, nextNode) {
        var pred = function (pt) {
            return pt.node === nextNode || !pt.node;
        };
        var nodes = [];
        var handler = function (pt) {
            if (utils.isText(pt.node) && pt.offset) {
                return;
            }
            var target = pt.node.childNodes[pt.offset] || pt.node;
            if (target === startPoint.node || $.contains(target, startPoint.node) || target === nextNode || $.contains(target, nextNode)) {
                return;
            }
            var nodesHasTarget = nodes.indexOf(target) !== -1 || utils.ancestor(target, function (targetAncestor) {
                return nodes.indexOf(targetAncestor) !== -1;
            });
            if (!nodesHasTarget) {
                nodes.push(target);
            }
        };
        startPoint.walkUntil(pred, handler);
        return nodes;
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
    /**
     * Insert a text node in an editable area.
     *
     * @private
     * @param {WrappedRange} range
     * @param {Node} text
     * @returns {Node}
     */
    _insertTextNodeInEditableArea: function (range, text) {
        var textNode = document.createTextNode(text);
        if (this.options.isEditableNode(range.sc) && $(range.sc).closest('[contenteditable]').attr('contenteditable') === 'true') {
            if (utils.isVisibleText(range.sc)) {
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
            } else if (range.so === utils.nodeLength(range.sc) || range.sc.childNodes[range.so]) {
                var node = range.so === utils.nodeLength(range.sc) ? range.sc.childNodes[range.so - 1] : range.sc.childNodes[range.so];
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
     * Return a function that takes a point and returns true
     * if that point is different from `startNode` and is on a
     * node that is visible and editable (or if it has no node at all).
     *
     * @private
     * @param {Node} startNode
     * @returns {Function (BoundaryPoint) => Boolean}
     */
    _isOtherVisiblePoint: function (startNode) {
        var self = this;
        return function (point) {
            if (point.node === startNode) {
                return false;
            }
            return !point.node || utils.isEditable(point.node) ||
                self.options.isEditableNode(point.node) &&
                    (point.node.tagName === "BR" || utils.isVisibleText(point.node));
        };
    },
    /**
     * Merge two similar nodes together:
     * - append the contents of `otherNode` into `node`
     * - remove `otherNode`
     * - delete the new edges if necessary
     *
     * @private
     * @param {Node} node
     * @param {Node} otherNode
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @param {Object} [options]
     * @param {Boolean} [options.isTryNonSim] (default: true) - true to try merging non-similar nodes
     * @param {Boolean} [options.isRemoveBlock] (default: true) - true to not try merging non-similar nodes
     * @returns {BoundaryPoint}
     */
    _mergeNodes: function (node, otherNode, isPrev, options) {
        var $contents = $(otherNode).contents();
        $contents = $contents.filter(function (index, node) {
            return !utils.isInvisibleText(node);
        });
        if (utils.hasOnlyBR(node) && $contents.length === 1 && utils.isBR($contents[0])) {
            $contents = $();
        }
        $(node).append($contents);
        while (otherNode.parentNode && !utils.isEditable(otherNode.parentNode) && utils.isBlankNode(otherNode.parentNode)) {
            otherNode = otherNode.parentNode;
        }
        $(otherNode).remove();
        if ($contents.length) {
            node = utils.firstLeaf($contents[0]);
            isPrev = true;
        } else if (utils.isBlankNode(node)) {
            node = this._replaceEmptyNodeWithEmptyP(node);
            isPrev = false;
        }
        return this._deleteEdgeRec(node, isPrev, true, options);
    },
    _mergeTextIntoElement: function (element, textNode, isPrev) {
        var clone = document.createTextNode(textNode.textContent);
        var elementText = utils.lastLeaf(element, utils.isText.bind(utils));
        $(elementText).after(clone);
        $(textNode).remove();
        return this._mergeTextNodes(elementText, clone, isPrev, true);
    },
    /**
     * Merge two text nodes together:
     * - Append the text contents of `otherNode` to `node`
     * - Remove `otherNode`
     * - Make sure to keep only the visible leading/trailing spaces
     *
     * @private
     * @param {Node} node
     * @param {Node} otherNode
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @param {Boolean} didChange true if anything was changed with deleteEdge yet
     * @returns {BoundaryPoint}
     */
    _mergeTextNodes: function (node, otherNode, isPrev, didChange) {
        var nodePoint = new BoundaryPoint(node, node.textContent.length);
        var trimmedNodePoint = this._removeInvisibleTrailingSpace(nodePoint);
        var otherNodePoint = new BoundaryPoint(otherNode, 0);
        var trimmedOtherNodePoint = this._removeInvisibleLeadingSpace(otherNodePoint);

        node.textContent = trimmedNodePoint.node.textContent.replace(/\u00A0$/, ' ') + trimmedOtherNodePoint.node.textContent;
        $(otherNode).remove();
        return this._getDeleteEdgeResult(node, isPrev, didChange, trimmedNodePoint.offset);
    },
    _removeInvisibleLeadingSpace: function (point) {
        var newNodeText = point.node.textContent;
        for (var i = 0; i < point.node.textContent.length; i ++) {
            if (newNodeText[i] === ' ' && i + 1 < newNodeText.length && newNodeText[i + 1] === ' ') {
                var afterI = i + 1 > newNodeText.length ? newNodeText.length : i + 1;
                newNodeText = newNodeText.slice(0, i) + newNodeText.slice(afterI, newNodeText.length);
                point.offset = point.offset >= i ? point.offset - 1 : point.offset;
                i = i - 1;
            }
        }
        var leadingSpace = newNodeText.match(/^ +/);
        if (leadingSpace) {
            point.offset = point.offset >= leadingSpace.index ? point.offset - leadingSpace.length : point.offset;
            newNodeText = newNodeText.slice(0, leadingSpace.index) + newNodeText.slice(leadingSpace.index + 1, newNodeText.length);
        }
        point.node = document.createTextNode(newNodeText);
        return point;
    },
    _removeInvisibleTrailingSpace: function (point) {
        var newNodeText = point.node.textContent;
        for (var i = point.node.textContent.length - 1; i >= 0; i--) {
            if (newNodeText[i] === ' ' && i - 1 >= 0 && newNodeText[i - 1] === ' ') {
                var afterI = i + 1 > newNodeText.length ? newNodeText.length : i + 1;
                newNodeText = newNodeText.slice(0, i) + newNodeText.slice(afterI, newNodeText.length);
                point.offset = point.offset >= i ? point.offset - 1 : point.offset;
            }
        }
        var trailingSpace = newNodeText.match(/ +$/);
        if (trailingSpace && trailingSpace.length > 1) {
            point.offset = point.offset >= trailingSpace.index ? point.offset - trailingSpace.length : point.offset;
            newNodeText = newNodeText.slice(0, trailingSpace.index);
        }
        point.node = document.createTextNode(newNodeText);
        return point;
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
     * Prepare the deletion between two points:
     * - split the tree at both points
     * - move the points if needed
     *
     * @private
     * @param {BoundaryPoint} pointA
     * @param {BoundaryPoint} pointB
     * @returns {Node} the node after the split point
     */
    _prepareDelete: function (pointA, pointB) {
        pointB.enterUntil(utils.and(utils.not(this.options.isVoidBlock), this.options.isEditableNode))
            .nextUntilNode(utils.not(utils.isBR.bind(utils)));

        var next = this._splitBeforeDelete(pointA, pointB);

        pointA.prevUntilNode(utils.not(this.options.isVoidBlock));
        pointA.offset = utils.nodeLength(pointA.node);
        return next;
    },
    /**
     * Remove the text nodes contained within a node,
     * that are blank or filled with invisible characters.
     *
     * @private
     * @param {Node} node
     */
    _removeBlankContents: function (node) {
        $(node).contents().filter(function () {
            return utils.isText(this) && utils.getRegexBlank({
                atLeastOne: true,
                invisible: true,
            }).test(this.textContent);
        }).remove();
    },
    /**
     * Remove a block and return a focusable point where the block used to be.
     *
     * @private
     * @param {Node} block
     * @param {Boolean} doRemoveAgain true to allow removing another block on delete edge.
     * @returns {BoundaryPoint}
     */
    _removeBlock: function (block, doRemoveAgain) {
        var isPrev = false;
        var point = new BoundaryPoint(block, 0).prevUntil(this._isOtherVisiblePoint(block));
        if (!point) {
            isPrev = true;
            point = new BoundaryPoint(block, 0).nextUntil(this._isOtherVisiblePoint(block));
        }
        if (!point) {
            var invisibleTextNode = document.createTextNode('');
            $(block).before(invisibleTextNode);
            point = new BoundaryPoint(invisibleTextNode, 0);
            isPrev = false;
        }

        $(block).remove();

        var edgeMethod = utils[isPrev ? 'isLeftEdge' : 'isRightEdge'].bind(utils);
        var isPointOnEdge = point && point.node && edgeMethod(point.node);

        return isPointOnEdge ? this.deleteEdge(point.node, isPrev, {
            isTryNonSim: false,
            isRemoveBlock: doRemoveAgain || false,
        }) || point : point;
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
        if (fake.classList.contains('o_fake_editable') && this.options.isVoidBlock(fake)) {
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
     * If the element is blank, replace it with an empty p, then return the empty p.
     *
     * @private
     * @param {Node} node
     * @returns {Node}
     */
    _replaceEmptyNodeWithEmptyP: function (node) {
        var emptyP = document.createElement('p');
        var br = document.createElement('br');
        $(emptyP).append(br);
        $(node).before(emptyP).remove();
        return emptyP;
    },
    /**
     * Split the DOM tree before deleting between two points
     * (split at both points, on the level of their common ancestor).
     *
     * @private
     * @param {BoundaryPoint} pointA
     * @param {BoundaryPoint} pointB
     * @returns {Node} the node after the split pointB
     */
    _splitBeforeDelete: function (pointA, pointB) {
        var commonAncestor = utils.commonAncestor(pointA.node, pointB.node);
        var options = {
            isSkipPaddingBlankNode: true,
            isNoSplitEdgePoint: true,
            nextText: true,
        };
        var next = this._splitPointAt(commonAncestor, pointB, options);
        this._splitPointAt(commonAncestor, pointA, options);
        return next;
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
     * Split the DOM tree at the point, on the level of the point's
     * first ancestor that is either the root or unbreakable.
     *
     * @private
     * @param {Node} root
     * @param {BoundaryPoint} point
     * @returns {Node} the node after the split point
     */
    _splitPointAt: function (root, point, options) {
        var self = this;
        options = options || {};
        var ancestor = utils.ancestor(point.node, function (node) {
            return node === root || self.options.isUnbreakableNode(node.parentNode);
        });
        return this.splitTree(ancestor, point, options);
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
    /**
     * Wrap a text node in a Paragraph element, then return the text node.
     *
     * @param {Node} textNode
     * @returns {Node}
     */
    _wrapTextInP: function (textNode) {
        if (utils.ancestor(textNode, utils.isAnchor)) {
            return textNode;
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
                var blankP = document.createElement('p');
                $(textNode).after(blankP);
                $(blankP).prepend(textNode);
                textNode = blankP.firstChild;
            }
        }
        return textNode;
    },
});

return Dom;
});
