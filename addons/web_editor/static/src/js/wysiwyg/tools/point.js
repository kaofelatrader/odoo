odoo.define('wysiwyg.BoundaryPoint', function (require) {
'use strict';

var utils = require('wysiwyg.utils');

/**
 * @constructor
 * @param {Node} node
 * @param {Number} offset
 */
function BoundaryPoint (node, offset) {
    this.node = node;
    this.offset = offset;
}

BoundaryPoint.prototype = {
    /**
     * If possible, move the point to its offset-th child, at offset 0.
     * Can be chained.
     *
     * @returns {BoundaryPoint}
     */
    enter: function () {
        if (!utils.isText(this.node) && this.node.childNodes[this.offset]) {
            this.replace(this.node.childNodes[this.offset], 0);
        }
        return this;
    },
    /**
     * If possible, move the point to its first leaf until optional predicate hit, at offset 0.
     * Can be chained.
     *
     * @param {Function (Node) => Boolean} [pred]
     * @returns {BoundaryPoint}
     */
    enterUntil: function (pred) {
        if (!utils.isText(this.node) && this.node.childNodes[this.offset]) {
            var firstLeaf = utils.firstLeafUntil(this.node.childNodes[this.offset], function (node) {
                return !pred || pred(node);
            });
            this.replace(firstLeaf, 0);
        }
        return this;
    },
    /**
     * Return true if the point is on an edge.
     *
     * @returns {Boolean}
     */
    isEdge: function () {
        return this.isLeftEdge() || this.isRightEdge();
    },
    /**
     * Return true if the point is on the requested edge of a block.
     *
     * @param {Boolean} isLeft
     * @returns {Boolean}
     */
    isEdgeOfBlock: function (isLeft) {
        return this.isEdgeOfPred(function (node) {
            return utils.isNodeBlockType(node);
        }, isLeft);
    },
    /**
     * Return true if the point is on the requested edge of a node
     * that matches the given predicate function.
     *
     * @param {Function (Node) => Boolean} pred
     * @param {Boolean} isLeft
     * @returns {Boolean}
     */
    isEdgeOfPred: function (pred, isLeft) {
        pred = pred.bind(this);
        var isEdge = isLeft ? 'isLeftEdge' : 'isRightEdge';
        var ancestorChildrenOfTag = utils.listAncestor(this.node, function (node) {
            return node.parentNode && pred(node.parentNode);
        });
        if (!ancestorChildrenOfTag.length || !this[isEdge]()) {
            return false;
        }
        return _.all(ancestorChildrenOfTag, utils[isEdge].bind(utils));
    },
    /**
     * Returns true if the point is on the left/right edge of the first
     * previous/next point with the given tag name (skips insignificant nodes).
     *
     * @param {String} tagName
     * @param {Boolean} isLeft
     * @returns {Boolean}
     */
    isEdgeOfTag: function (tagName, isLeft) {
        return this.isEdgeOfPred(function (node) {
            return utils.makePredByNodeName(tagName)(node);
        }, isLeft);
    },
    /**
     * Return true if the point is on the left edge of a block node
     * (skips insignificant nodes).
     *
     * @returns {Boolean}
     */
    isLeftEdgeOfBlock: function () {
        return this.isEdgeOfBlock(true);
    },
    /**
     * Return true if the point is on the left edge of the first
     * previous point with the given tag name (skips insignificant nodes).
     *
     * @param {String} tagName
     * @returns {Boolean}
     */
    isLeftEdgeOfTag: function (tagName) {
        return this.isEdgeOfTag(tagName, true);
    },
    /**
     * Return true if the given point is on a left edge.
     *
     * @returns {Boolean}
     */
    isLeftEdge: function () {
        if (this.offset === 0) {
            return true;
        }
        if (utils.isText(this.node)) {
            var reInvisible = utils.getRegex('invisible');
            var leftOffset = 0;
            var text = this.node.textContent;
            while (leftOffset < utils.nodeLength(this.node) && text[leftOffset] && reInvisible.test(text[leftOffset])) {
                leftOffset += 1;
            }
            if (this.offset !== leftOffset) {
                return false;
            }
        }
        return utils.isLeftEdge(this.node);
    },
    /**
     * Return true if the given point is on the left edge of the given ancestor node.
     *
     * @param {Node} ancestor
     * @returns {Boolean}
     */
    isLeftEdgeOf: function (ancestor) {
        return this.isLeftEdge() && utils.isLeftEdgeOf(this.node, ancestor);
    },
    /**
     * Returns true if the point is on the right edge of the first
     * next point with the given tag name (skips insignificant nodes).
     *
     * @param {String} tagName
     * @returns {Boolean}
     */
    isRightEdgeOfTag: function (tagName) {
        return this.isEdgeOfTag(tagName, false);
    },
    /**
     * Return true if the given point is on a right edge.
     *
     * @returns {Boolean}
     */
    isRightEdge: function () {
        if (this.offset === utils.nodeLength(this.node)) {
            return true;
        }
        if (utils.isText(this.node)) {
            var reInvisible = utils.getRegex('invisible');
            var rightOffset = utils.nodeLength(this.node);
            var text = this.node.textContent;
            while (rightOffset > 0 && text[rightOffset - 1] && reInvisible.test(text[rightOffset - 1])) {
                rightOffset -= 1;
            }
            if (this.offset !== rightOffset) {
                return false;
            }
        }
        return utils.isRightEdge(this.node);
    },
    /**
     * Return true if the given point is on the right edge of the given ancestor node.
     *
     * @param {Node} ancestor
     * @returns {Boolean}
     */
    isRightEdgeOf: function (ancestor) {
        return this.isRightEdge() && utils.isRightEdgeOf(this.node, ancestor);
    },
    /**
     * Return true if the point is the same point as `point`.
     *
     * @param {BoundaryPoint} point
     * @returns {Boolean}
     */
    isSameAs: function (point) {
        return this.node === point.node && this.offset === point.offset;
    },
    /**
     * Returns true if point should be ignored.
     * This is generally used for trying to figure out if the point is an edge point.
     *
     * @param {Boolean} isPrev
     * @param {Object} options
     * @param {Boolean} options.noSkipBlankText true to not skip blank text
     * @param {Boolean} options.noSkipSingleBRs true to not skip single BRs
     * @param {Boolean} options.noSkipExtremeBreakableSpace true to not skip leading/trailing breakable space
     * @param {Boolean} options.noSkipParent true to not skip to leaf nodes or offset 0
     * @param {Boolean} options.noSkipSibling true to not skip if on edge and sibling is skippable
     * @returns {Boolean}
     */
    isSkippable: function (isPrev, options) {
        options = options || {};
        var isEdge = isPrev ? this.isLeftEdge() : this.isRightEdge();

        // skip blank text nodes
        if (
            !options.noSkipBlankText &&
            utils.isBlankText(this.node)
        ) {
            return true;
        }
        // skip single BRs
        if (
            !options.noSkipSingleBRs &&
            this.node.tagName === 'BR' &&
            (!this.node.previousSibling || utils.isBlankText(this.node.previousSibling)) &&
            (!this.node.nextSibling || utils.isBlankText(this.node.nextSibling))
        ) {
            return true;
        }
        // skip leading/trailing breakable space
        if (
            !options.noSkipExtremeBreakableSpace &&
            (isPrev && !isEdge && this.offset <= utils.countLeadingBreakableSpace(this.node) ||
                !isPrev && this.offset > utils.nodeLength(this.node) - utils.countTrailingBreakableSpace(this.node))
        ) {
            return true;
        }
        // skip to leaf node or edge
        var node = isPrev ? this.node.childNodes[0] : this.node.childNodes[this.node.childNodes.length - 1];
        var offset = isPrev ? 0 : utils.nodeLength(node);
        if (
            !options.noSkipParent &&
            !isEdge && this.node.childNodes.length &&
            new BoundaryPoint(node, offset).isSkippable(isPrev, options)
        ) {
            return true;
        }
        // skip if on edge and sibling is skippable
        var sibling = isPrev ? this.node.previousSibling : this.node.nextSibling;
        offset = isPrev ? 0 : utils.nodeLength(sibling);
        if (
            !options.noSkipSibling &&
            isEdge && sibling &&
            new BoundaryPoint(sibling, offset).isSkippable(isPrev, _.defaults({
                noSkipSibling: true,
            }, options))
        ) {
            return true;
        }
        return false;
    },
    /**
     * Return true if the given point is visible (can set cursor).
     *
     * @returns {Boolean}
     */
    isVisible: function () {
        if (utils.isText(this.node) || !utils.hasChildren(this.node) || utils.isEmpty(this.node)) {
            return true;
        }
        var leftNode = this.node.childNodes[this.offset - 1];
        var rightNode = this.node.childNodes[this.offset];
        if ((!leftNode || utils.isVoid(leftNode)) && (!rightNode || utils.isVoid(rightNode))) {
            return true;
        }
        return false;
    },
    /**
     * Return the given point's next point.
     *
     * @param {Boolean} isSkipInnerOffset true to skip the node's inner offset
     * @returns {BoundaryPoint}
     */
    next: function (isSkipInnerOffset) {
        var node, offset;
        if (utils.nodeLength(this.node) === this.offset) {
            if (utils.isEditable(this.node)) {
                return null;
            }
            node = this.node.parentNode;
            offset = utils.position(this.node) + 1;
            if (utils.isEditable(node) && offset !== utils.nodeLength(node)) {
                return this.replace(node, offset).next(isSkipInnerOffset);
            }
        } else if (utils.hasChildren(this.node)) {
            node = this.node.childNodes[this.offset];
            offset = 0;
        } else {
            node = this.node;
            offset = isSkipInnerOffset ? utils.nodeLength(this.node) : this.offset + 1;
        }
        return this.replace(node, offset);
    },
    /**
     * Return the given point's next point until predicate hit.
     *
     * @param {Function} pred
     * @returns {BoundaryPoint|null}
     */
    nextUntil: function (pred) {
        return this._moveUntilHelper(pred, false, false);

    },
    /**
     * Return the given point's next point until the point's node
     * matches the predicate function.
     *
     * @param {Function} pred
     * @returns {BoundaryPoint|null}
     */
    nextUntilNode: function (pred) {
        return this._moveUntilHelper(pred, false, true);
    },
    /**
     * Return the given point's previous point.
     *
     * @param {Boolean} isSkipInnerOffset true to skip the node's inner offset
     * @returns {BoundaryPoint}
     */
    prev: function (isSkipInnerOffset) {
        var node;
        var offset;
        if (this.offset === 0) {
            if (utils.isEditable(this.node)) {
                return null;
            }
            node = this.node.parentNode;
            offset = utils.position(this.node);
            if (utils.isEditable(node) && offset) {
                return this.replace(node, offset).prev(isSkipInnerOffset);
            }
        } else if (utils.hasChildren(this.node)) {
            node = this.node.childNodes[this.offset - 1];
            offset = utils.nodeLength(node);
        } else {
            node = this.node;
            offset = isSkipInnerOffset ? 0 : this.offset - 1;
        }
        return this.replace(node, offset);
    },
    /**
     * Return the given point's previous point until predicate hit.
     *
     * @param {Function} pred
     * @returns {BoundaryPoint|null}
     */
    prevUntil: function (pred) {
        return this._moveUntilHelper(pred, true, false);
    },
    /**
     * Return the given point's previous point until the point's node
     * matches the predicate function.
     *
     * @param {Function} pred
     * @returns {BoundaryPoint|null}
     */
    prevUntilNode: function (pred) {
        return this._moveUntilHelper(pred, true, true);
    },
    /**
     * Replace the current point's node and offset with the
     * given (point's) node and offset.
     *
     * @param {BoundaryPoint|Node} pointOrNode
     * @param {Number} offset
     * @returns {BoundaryPoint}
     */
    replace: function (pointOrNode, offset) {
        var node;
        if (pointOrNode.node && (pointOrNode.offset || pointOrNode.offset === 0)) {
            node = pointOrNode.node;
            offset = pointOrNode.offset;
        } else {
            node = pointOrNode;
        }
        this.node = node;
        this.offset = offset;
        return this;
    },
    /**
     * Skips points to ignore (generally for trying to figure out if edge point).
     * Returns the resulting point.
     *
     * @param {Boolean} isPrev
     * @param {function} pred (extra condition to stop at)
     * @param {Object} options
     * @param {Boolean} options.noSkipBlankText true to not skip blank text
     * @param {Boolean} options.noSkipSingleBRs true to not skip single BRs
     * @param {Boolean} options.noSkipExtremeBreakableSpace true to not skip leading/trailing breakable space
     * @param {Boolean} options.noSkipParent true to not skip to leaf nodes or offset 0
     * @param {Boolean} options.noSkipSibling true to not skip if on edge and sibling is skippable
     * @returns {BoundaryPoint}
     */
    skipNodes: function (isPrev, pred, options) {
        var startPoint = new BoundaryPoint(this.node, this.offset);
        if (arguments.length === 3 && !_.isFunction(arguments[2])) {
            // allow for passing options and no pred function
            options = _.clone(pred);
            pred = null;
        }
        options = options || {};
        return this[isPrev ? 'prevUntil' : 'nextUntil'](function (pt) {
            return !pt.isSkippable(isPrev, options) || pred && pred(pt);
        }) || this.replace(startPoint); // if the last point is skippable, return it
    },
    /**
     * Execute a given `handler` function on each point between this and the `endPoint` (both included).
     *
     * @param {BoundaryPoint} endPoint
     * @param {Function} handler
     * @param {Boolean} isSkipInnerOffset true to skip the node's inner offset
     */
    walkTo: function (endPoint, handler, isSkipInnerOffset) {
        var startPoint = new BoundaryPoint(this.node, this.offset);
        var pred = function (point) {
            return point.isSameAs(endPoint);
        };
        var isSkipInnerOffsetFunction = function (point) {
            return startPoint.node !== point.node &&
                endPoint.node !== point.node;
        };
        this.walkUntil(pred, handler, isSkipInnerOffset || isSkipInnerOffsetFunction);
    },
    /**
     * Execute a given `handler` function on each point between this and the predicate hit (both included).
     *
     * @param {Function (BoundaryPoint) => Boolean} pred
     * @param {Function (BoundaryPoint) => Void} handler
     * @param {Boolean|Function (BoundaryPoint) => Boolean} isSkipInnerOffset
     *      (function that returns) true to skip the node's inner offset
     */
    walkUntil: function (pred, handler, isSkipInnerOffset) {
        var point = new BoundaryPoint(this.node, this.offset);
        while (point && point.node) {
            handler(point);
            if (pred(point)) {
                break;
            }
            point.next(typeof isSkipInnerOffset === 'function' ? isSkipInnerOffset(point) : isSkipInnerOffset);
        }
    },
    /**
     * Return true if the point's node allows text nodes as direct children.
     */
    welcomesText: function () {
        return utils.welcomesText(this.node);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    
    /**
     * Helper function for methods to move the point until predicate hits
     *
     * @see nextUntil
     * @see nextUntilNode
     * @see prevUntil
     * @see prevUntilNode
     * @private
     * @param {Function (BoundaryPoint|Node) => Boolean} pred
     * @param {Boolean} isPrev true to move to previous point until
     * @param {Boolean} isNode true to apply the predicate function on the point's node
     * @returns {BoundaryPoint|null}
     */
    _moveUntilHelper: function (pred, isPrev, isNode) {
        while (this.node && this.offset >= 0 && !utils.isEditable(this.node)) {
            if (pred(isNode ? this.node : this)) {
                return this;
            }
            this[isPrev ? 'prev' : 'next']();
        }
        return null;
    },
};

return BoundaryPoint;
});
