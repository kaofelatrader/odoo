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
     * @param {Function (Node) => Boolean} pred
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
     * Returns true if the point is on the left/right edge of the first
     * previous/next point with the given tag name (skips insignificant nodes).
     *
     * @param {String} tagName
     * @param {String('left'|'right')} side
     * @returns {Boolean}
     */
    isEdgeOfTag: function (tagName, side) {
        var self = this;
        var method = side === 'left' ? 'isLeftEdge' : 'isRightEdge';
        var prevOrNext = side === 'left' ? 'prev' : 'next';
        var newPt;
        var first = true;
        var point = new BoundaryPoint(this.node, this.offset);
        while (point && point.node.tagName !== tagName) {
            newPt = point.skipNodes(prevOrNext, function (pt) {
                return pt.node.tagName === tagName && self[method](pt);
            });
            if (newPt.node.tagName === tagName || newPt.node.tagName === 'BR') {
                point = newPt;
                break;
            }
            if (newPt === point && (!first || utils.isText(point.node) && !point[method])) {
                break;
            }
            point = newPt[prevOrNext]();
            first = false;
        }
        if (!point) {
            return false;
        }
        var ancestor = utils.ancestor(point.node, function (n) {
            return n.tagName === tagName;
        });
        return !!(ancestor && point[method + 'Of'](ancestor));
    },
    /**
     * Return true if the given point is on an edge.
     *
     * @returns {Boolean}
     */
    isEdge: function () {
        return this.isLeftEdge() || this.isRightEdge();
    },
    /**
     * Return true if the point is on the left edge of a block node
     * (skips insignificant nodes).
     *
     * @returns {Boolean}
     */
    isLeftEdgeOfBlock: function () {
        var point = this.skipNodes('prev');
        return point.isLeftEdgeOf(utils.firstBlockAncestor(point.node));
    },
    /**
     * Return true if the point is on the left edge of the first
     * previous point with the given tag name (skips insignificant nodes).
     *
     * @param {String} tagName
     * @returns {Boolean}
     */
    isLeftEdgeOfTag: function (tagName) {
        return this.isEdgeOfTag(tagName, 'left');
    },
    /**
     * Return true if the given point is on a left edge.
     *
     * @returns {Boolean}
     */
    isLeftEdge: function () {
        return this.offset === 0;
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
        return this.isEdgeOfTag(tagName, 'right');
    },
    /**
     * Return true if the given point is on a right edge.
     *
     * @returns {Boolean}
     */
    isRightEdge: function () {
        return this.offset === utils.nodeLength(this.node);
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
     * @param {String} direction ('prev' or 'next')
     * @param {Object} options
     * @param {Boolean} options.noSkipBlankText true to not skip blank text
     * @param {Boolean} options.noSkipSingleBRs true to not skip single BRs
     * @param {Boolean} options.noSkipExtremeBreakableSpace true to not skip leading/trailing breakable space
     * @param {Boolean} options.noSkipParent true to not skip to leaf nodes or offset 0
     * @param {Boolean} options.noSkipSibling true to not skip if on edge and sibling is skippable
     * @returns {Boolean}
     */
    isSkippable: function (direction, options) {
        options = options || {};
        var isEdge = direction === 'prev' ? this.isLeftEdge() : this.isRightEdge();

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
            (direction === 'prev' && !isEdge && this.offset <= utils.countLeadingBreakableSpace(this.node) ||
                direction === 'next' && this.offset > utils.nodeLength(this.node) - utils.countTrailingBreakableSpace(this.node))
        ) {
            return true;
        }
        // skip to leaf node or edge
        var node = direction === 'prev' ? this.node.childNodes[0] : this.node.childNodes[this.node.childNodes.length - 1];
        var offset = direction === 'prev' ? 0 : utils.nodeLength(node);
        if (
            !options.noSkipParent &&
            !isEdge && this.node.childNodes.length &&
            new BoundaryPoint(node, offset).isSkippable(direction, options)
        ) {
            return true;
        }
        // skip if on edge and sibling is skippable
        var sibling = direction === 'prev' ? this.node.previousSibling : this.node.nextSibling;
        offset = direction === 'prev' ? 0 : utils.nodeLength(sibling);
        if (
            !options.noSkipSibling &&
            isEdge && sibling &&
            new BoundaryPoint(sibling, offset).isSkippable(direction, _.defaults({
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
        if (pointOrNode instanceof BoundaryPoint) {
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
     * @param {String} direction ('prev' or 'next')
     * @param {function} pred (extra condition to stop at)
     * @param {Object} options
     * @param {Boolean} options.noSkipBlankText true to not skip blank text
     * @param {Boolean} options.noSkipSingleBRs true to not skip single BRs
     * @param {Boolean} options.noSkipExtremeBreakableSpace true to not skip leading/trailing breakable space
     * @param {Boolean} options.noSkipParent true to not skip to leaf nodes or offset 0
     * @param {Boolean} options.noSkipSibling true to not skip if on edge and sibling is skippable
     * @returns {BoundaryPoint}
     */
    skipNodes: function (direction, pred, options) {
        if (arguments.length === 3 && !_.isFunction(arguments[2])) {
            // allow for passing options and no pred function
            options = _.clone(pred);
            pred = null;
        }
        options = options || {};
        return this[direction + 'Until'](function (pt) {
            return !pt.isSkippable(direction, options) || pred && pred(pt);
        });
    },
    /**
     * Execute a given `handler` function on each point between this and the `endPoint` (both included).
     *
     * @param {BoundaryPoint} endPoint
     * @param {Function} handler
     * @param {Boolean} isSkipInnerOffset true to skip the node's inner offset
     */
    walkTo: function (endPoint, handler, isSkipInnerOffset) {
        var pred = function (point) {
            return point.isSameAs(endPoint);
        };
        this.walkUntil(pred, handler, isSkipInnerOffset);
    },
    /**
     * Execute a given `handler` function on each point between this and the predicate hit (both included).
     *
     * @param {Function (BoundaryPoint) => Boolean} pred
     * @param {Function (BoundaryPoint) => Void} handler
     * @param {Boolean} isSkipInnerOffset true to skip the node's inner offset
     */
    walkUntil: function (pred, handler, isSkipInnerOffset) {
        var point = new BoundaryPoint(this.node, this.offset);
        while (point && point.node) {
            handler(point);
            if (pred(point)) {
                break;
            }
            var isSkipOffset = isSkipInnerOffset &&
                startPoint.node !== point.node &&
                endPoint.node !== point.node;
            point = point.next(isSkipOffset);
        }
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
        var startPoint = {
            node: this.node,
            offset: this.offset,
        };
        while (this.node && this.offset >= 0) {
            if (pred(isNode ? this.node : this)) {
                return this;
            }
            this[isPrev ? 'prev' : 'next']();
        }
        this.replace(startPoint.node, startPoint.offset); // Reset
        return null;
    },
};

return BoundaryPoint;
});
