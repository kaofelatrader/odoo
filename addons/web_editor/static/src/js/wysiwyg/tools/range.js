odoo.define('wysiwyg.WrappedRange', function (require) {
'use strict';

var BoundaryPoint = require('wysiwyg.BoundaryPoint');
var Class = require('web.Class');
var utils = require('wysiwyg.utils');

var WrappedRange = Class.extend({
    /**
     * Note: the range is initialized on the given points.
     *  - If no end point is given:
     *      the range is collapsed on its start point
     *  - If no start offset is given:
     *      the range is selecting the whole start node
     *  - If no start point or start offset or range is given:
     *      get the current range from the selection in the DOM (native range).
     *
     * @param {Object} [range]
     * @param {Node} [range.sc]
     * @param {Number} range.so
     * @param {Node} [range.ec]
     * @param {Number} [range.eo]
     * @param {Node} [ownerDocument] the document containing the range
     * @param {Object} options
     * @param {Function (Node) => Boolean} options.isVoidBlock
     * @param {Function (Node) => Boolean} options.isEditableNode
     * @param {Function (Node) => Boolean} options.isUnbreakableNode
     * 
     */
    init: function (range, ownerDocument, options) {
        this.document = ownerDocument || range.sc.ownerDocument;
        this.$editable = $(this.document).find('editable');
        this.editable = this.$editable[0];
        this.options = options || {};
        if (!range || typeof range.so !== 'number') {
            if (range.sc) {
                this.getFromNode(range.sc);
            } else {
                this.getFromSelection();
            }
        } else {
            this.replace(range);
        }
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Collapse the current range on its end point
     * (or start point if isCollapseToStart is true).
     *
     * @param {Boolean} isCollapseToStart
     * @returns {WrappedRange}
     */
    collapse: function (isCollapseToStart) {
        if (isCollapseToStart) {
            return this.replace({
                sc: this.sc,
                so: this.so,
                ec: this.sc,
                eo: this.so,
            });
        }
        else {
            return this.replace({
                sc: this.ec,
                so: this.eo,
                ec: this.ec,
                eo: this.eo,
            });
        }
    },
    copy: function () {
        return new WrappedRange(this.getPoints(), this.document, this.options);
    },
    /**
     * Get the common ancestor of the start and end
     * points of the current range.
     *
     * @returns {Node}
     */
    commonAncestor: function () {
        return utils.commonAncestor(this.sc, this.ec);
    },
    /**
     * Delete the contents of the current range.
     *
     * @returns {WrappedRange}
     */
    deleteContents: function () {
        if (this.isCollapsed()) {
            return this;
        }
        this.splitText();
        var nodes = this.nodes(null, {
            fullyContains: true,
        });
        // find new cursor point
        var point = this.getStartPoint().prevUntil(function (point) {
            return nodes.indexOf(point.node) === -1;
        });
        var emptyParents = [];
        $.each(nodes, function (idx, node) {
            // find empty parents
            var parent = node.parentNode;
            if (point.node !== parent && utils.nodeLength(parent) === 1) {
                emptyParents.push(parent);
            }
            utils.remove(node, false);
        });
        // remove empty parents
        $.each(emptyParents, function (idx, node) {
            utils.remove(node, false);
        });
        return this.replace({
            sc: point.node,
            so: point.offset,
        }).normalize();
    },
    /**
     * Get the end point of the current range.
     *
     * @returns {Object} {node, offset}
     */
    getEndPoint: function () {
        return new BoundaryPoint(this.ec, this.eo);
    },
    /**
     * Move the current range to the given node
     * (from its start to its end unless it's a void node).
     *
     * @param {Node} node
     * @returns {WrappedRange}
     */
    getFromNode: function (node) {
        var range = {
            sc: node,
            so: 0,
            ec: node,
            eo: utils.nodeLength(node),
        };
        // browsers can't target a picture or void node
        if (utils.isVoid(range.sc)) {
            range.so = utils.listPrev(range.sc).length - 1;
            range.sc = range.sc.parentNode;
        }
        if (utils.isBR(range.ec)) {
            range.eo = utils.listPrev(range.ec).length - 1;
            range.ec = range.ec.parentNode;
        }
        else if (utils.isVoid(range.ec)) {
            range.eo = utils.listPrev(range.ec).length;
            range.ec = range.ec.parentNode;
        }
        return this.replace(range);
    },
    /**
     * Move the current range to the current selection in the DOM
     * (the native range).
     *
     * @returns {WrappedRange}
     */
    getFromSelection: function () {
        var selection = this.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }
        var nativeRange = selection.getRangeAt(0);
        return this.replace({
            sc: nativeRange.startContainer,
            so: nativeRange.startOffset,
            ec: nativeRange.endContainer,
            eo: nativeRange.endOffset,
        });
    },
    /**
     * Get the points of the current range.
     *
     * @returns {Object} {sc, so, ec, eo}
     */
    getPoints: function () {
        return {
            sc: this.sc,
            so: this.so,
            ec: this.ec,
            eo: this.eo,
        };
    },
    /**
     * Get the current selection from the DOM.
     *
     * @returns {Selection}
     */
    getSelection: function () {
        return this.document.getSelection();
    },
    /**
     * Returns a list of all selected nodes in the range.
     *
     * @returns {Node []}
     */
    getSelectedNodes: function (pred) {
        var startPoint = this.getStartPoint().enter();
        var endPoint = this.getEndPoint().enter();
        var nodes = [];
        startPoint.walkTo(endPoint, function (point) {
            // TODO: move isIcon stuff to media somehow
            if (((!pred || pred(point.node)) || utils.isVisibleText(point.node)) &&
                (point.node !== endPoint.node || endPoint.offset)) {
                nodes.push(point.node);
            }
        });
        // if fontawesome -> TODO: move to media somehow
        if (this.isCollapsed()) {
            nodes.push(startPoint.node);
        }
        return utils.uniq(nodes);
    },
    /**
     * Get the text contents of the current selection
     * from the DOM.
     *
     * @returns {String}
     */
    getSelectedText: function () {
        return this.getSelection().toString();
    },
    /**
     * Returns a list of all selected text nodes in the range.
     * If a predicate function is included, only nodes meeting its
     * conditions will be returned.
     *
     * @param {(Node) => Boolean} [pred]
     * @returns {Node []}
     */
    getSelectedTextNodes: function (pred) {
        var self = this;
        var selectedText = _.filter(this.getSelectedNodes(), function (node) {
            if (utils.isEditable(node)) {
                return false;
            }
            node = utils.firstLeafUntil(node, pred.bind(self));
            return pred(node) || utils.isText(node);
        });
        return utils.uniq(selectedText);
    },
    /**
     * Get the start point of the current range.
     *
     * @returns {Object} {node, offset}
     */
    getStartPoint: function () {
        return new BoundaryPoint(this.sc, this.so);
    },
    /**
     * Return true if the current range is collapsed
     * (its start and end offsets/nodes are the same).
     *
     * @returns {Boolean}
     */
    isCollapsed: function () {
        return this.sc === this.ec && this.so === this.eo;
    },
    /**
     * Return true if the current range is on an anchor node.
     *
     * @returns {Boolean}
     */
    isOnAnchor: function () {
        return this.makeIsOn(utils.isAnchor);
    },
    /**
     * Return true if the current range is on a cell node.
     *
     * @returns {Boolean}
     */
    isOnCell: function () {
        return this.makeIsOn(utils.isCell);
    },
    /**
     * Return true if the current range is on a data node.
     *
     * @returns {Boolean}
     */
    isOnData: function () {
        return this.makeIsOn(utils.isData);
    },
    /**
     * Return true if the current range is on an editable.
     *
     * @returns {Boolean}
     */
    isOnEditable: function () {
        return this.makeIsOn(utils.isEditable);
    },
    /**
     * Return true if the current range is on a list node.
     *
     * @returns {Boolean}
     */
    isOnList: function () {
        return this.makeIsOn(utils.isList);
    },
    /**
     * Return true if the current range matches
     * the given prediction function.
     *
     * @param {Function(Node)} pred
     * @returns {Boolean}
     */
    makeIsOn: function (pred) {
        pred = pred.bind(this);
        var ancestor = utils.ancestor(this.sc, pred);
        return !!ancestor && (ancestor === utils.ancestor(this.ec, pred));
    },
    /**
     * Move the range to visible points if necessary.
     *
     * @returns {WrappedRange}
     */
    normalize: function () {
        var range = this.getPoints();
        var endPoint = this._getVisiblePoint(this.getEndPoint(), false);
        var startPoint = this.isCollapsed() ? endPoint : this._getVisiblePoint(this.getStartPoint(), true);
        var rangeN = {
            sc: startPoint.node,
            so: startPoint.offset,
            ec: endPoint.node,
            eo: endPoint.offset,
        };

        var point = new BoundaryPoint(rangeN.sc, rangeN.so);
        if (point.node.tagName === "BR") {
            point = point.next();
        }
        if (point.node.tagName && point.node.childNodes[point.offset]) {
            point = point.next();
        }
        if (point.node.tagName === "BR") {
            point = point.next();
        }
        if (point.node !== this.sc || point.offset !== this.so) {
            range = {
                sc: point.node,
                so: point.offset,
                ec: point.node,
                eo: point.offset,
            };
        }
        return this.replace(range);
    },
    /**
     * Move the range to the given points.
     * It's possible to not pass two complete points:
     * - If only sc (technically, if no so) or if argument[0] is a Node:
     *  the range is a selection of the whole start container
     * - If only sc and so:
     *  the range is collapsed on its start point
     * - If only sc, so and eo (technically, if no so and no eo):
     *  the range is a selection on the start container at given offsets
     *
     * @param {Object|WrappedRange|Node} range
     * @param {Node} [range.sc]
     * @param {Number} [range.so]
     * @param {Node} [range.ec]
     * @param {Number} [range.eo]
     * @returns {WrappedRange}
     */
    replace: function (range) {
        if (!range.so && range.so !== 0) {
            var node = range.sc || range; // allow passing just a node
            range = this.getFromNode(node);
        }
        this.sc = range.sc;
        this.so = range.so;
        if (!range.eo && range.eo !== 0) {
            return this.collapse(true);
        }
        this.ec = range.ec || range.sc;
        this.eo = range.eo;
        return this;
    },
    /**
     * @param {Function(Node) -> Boolean} [isEditableNode] returns true if the node is editable
     */
    standardizeRangeOnEdge: function (isEditableNode) {
        var self = this;
        var invisible = document.createTextNode(utils.char('zeroWidth'));

        if (utils.isInvisibleText(this.sc) && this.sc.nextSibling) {
            var firstLeafOfNext = utils.firstLeafUntil(this.sc.nextSibling, isEditableNode.bind(self));
            this.replace({
                sc: firstLeafOfNext,
                so: 0,
            });
        }

        // Create empty text node to have a range into the node
        if (this.sc.tagName && !utils.isVoid(this.sc) && !utils.hasOnlyBR(this.sc) && !this.sc.childNodes[this.so]) {
            if (this.sc.innerHTML === utils.char('zeroWidth')) {
                $(this.sc).empty();
            }
            $(this.sc).append(invisible);
            this.replace({
                sc: invisible,
                so: 0,
            });
        }

        // On left edge of non-empty element: move before
        var siblings = this.sc.parentNode && this.sc.parentNode.childNodes;
        var isInEmptyElem = !siblings || !siblings.length || _.all(siblings, function (node) {
            return utils.isBlankNode(node, self.options.isVoidBlock);
        });
        if (
            !this.so && !isInEmptyElem &&
            !(this.sc.previousSibling && this.sc.previousSibling.tagName === "BR") &&
            (!isEditableNode || !isEditableNode(this.sc))
        ) {
            var point = this.getStartPoint();
            var newPoint = point.prevUntil(function (pt) {
                return pt.node !== self.sc && utils.isText(pt.node) && !utils.isBlankText(pt.node);
            });
            if (!newPoint || utils.firstBlockAncestor(newPoint.node) !== utils.firstBlockAncestor(point.node)) {
                this.replace({
                    sc: point.node,
                    so: point.offset,
                });
            } else {
                this.replace({
                    sc: newPoint.node,
                    so: newPoint.offset,
                });
            }
        }
    },
    /**
     * Get the native Range object corresponding to the
     * current range.
     *
     * @returns {Range}
     */
    toNativeRange: function () {
        var nativeRange = this.sc.ownerDocument.createRange();
        nativeRange.setStart(this.sc, this.so);
        nativeRange.setEnd(this.ec, this.eo);
        return nativeRange;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Helper function to `normalize`: get the closest visible point.
     *
     * @param {BoundaryPoint} point
     * @param {Boolean} isLeftToRight true to move from left to right
     * @returns {Object} {node, offset}
     */
    _getVisiblePoint: function (point, isLeftToRight) {
        if ((point.isVisible() && !point.isEdge()) ||
            (point.isVisible() && point.isRightEdge() && !isLeftToRight) ||
            (point.isVisible() && point.isLeftEdge() && isLeftToRight) ||
            (point.isVisible() && utils.isBlock(point.node) && utils.isEmpty(point.node))) {
            return point;
        }
        // point on block's edge
        var block = utils.ancestor(point.node, utils.isBlock);
        var edgePointMethod = isLeftToRight ? 'isRightEdgeOf' : 'isLeftEdgeOf';
        var sibPointMethod = isLeftToRight ? 'next' : 'prev';
        if (point[edgePointMethod](block) || utils.isVoid(point[sibPointMethod].node)) {
            // returns point already on visible point
            if (point.isVisible()) {
                return point;
            }
            // reverse direction
            isLeftToRight = !isLeftToRight;
        }
        var nextPoint;
        if (isLeftToRight) {
            nextPoint = point.next().nextUntil(function (pt) {
                return pt.isVisible();
            });
        } else {
            nextPoint = point.prev().prevUntil(function (pt) {
                return pt.isVisible();
            });
        }
        return nextPoint || point;
    },
});

return WrappedRange;
});