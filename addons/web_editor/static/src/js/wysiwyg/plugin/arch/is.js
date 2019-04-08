odoo.define('wysiwyg.plugin.arch_tree', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');

ArchNode.include({

    /**
     * Return true if the given node is an anchor element (A, BUTTON, .btn).
     *
     * @returns {Boolean}
     */
    isAnchor: function () {
        return (
                this.nodeName === 'a' ||
                this.nodeName === 'button' ||
                this.className.contains('btn')
            ) &&
            !this.className.contains('fa') &&
            !this.className.contains('o_image');
    },
    /**
     * Returns true if the node is a text node containing nothing
     *
     * @returns {Boolean}
     */
    isBlankText: function () {
        return this instanceof ArchitecturalSpaceNode || this instanceof VirtualTextNode;
    },
    /**
     * Returns true if the node is blank.
     * In this context, a blank node is understood as
     * a node expecting text contents (or with children expecting text contents)
     * but without any.
     * If a predicate function is included, the node is NOT blank if it matches it.
     *
     * @param {Function (Node) => Boolean} [isNotBlank]
     * @returns {Boolean}
     */
    isBlankNode: function (isNotBlank) {
        if (this.isVoid() || isNotBlank && isNotBlank(node)) {
            return false;
        }
        if (this.isBlankText()) {
            return true;
        }
        if (this instanceof TextNode) {
            return false;
        }
        var isBlankNode = true;
        for (var k = 0; k < this.childNodes.length; k++) {
            if (!this.childNodes[k].isBlankNode(isNotBlank)) {
                isBlankNode = false;
                break;
            }
        }
        return isBlankNode;
    },
    /**
     * Return true if the given node is a block.
     *
     * @returns {Boolean}
     */
    isBlock: function () {
        return !this.isInline();
    },
    /**
     * Return true if the given node is a line break element (BR).
     *
     * @returns {Boolean}
     */
    isBR: function () {
        return this.nodeName === 'br'
    },
    /**
     * Return true if the given node is a table cell element (TD, TH).
     *
     * @returns {Boolean}
     */
    isCell: function () {
        return ['td', 'th'].indexOf(this.nodeName) !== -1;
    },
    /**
     * Return true if the given node is a data element (DATA).
     *
     * @returns {Boolean}
     */
    isData: function () {
        return this.nodeName === 'data';
    },
    /**
     * Return true if `node` is a descendent of `ancestor` (or is `ancestor` itself).
     *
     * @param {ArchNode} ancestor
     * @returns {Boolean}
     */
    isDescendentOf: function (ancestor) {
        var node = this;
        while (node) {
            if (node === ancestor) {
                return true;
            }
            node = node.parent;
        }
        return false;
    },
    /**
     * Return true if the given node is the editable node.
     *
     * @returns {Boolean}
     */
    isEditable: function () {
        return this.nodeName === 'EDITABLE';
    },
    /**
     * Return true if the given node's type is element (1).
     *
     * @returns {Boolean}
     */
    isElement: function () {
        return !(this instanceof TextNode) &&
            !(this instanceof FragmentNode) &&
            !(this instanceof RootNode);
    },
    /**
     * Return true if the given node is empty.
     *
     * @returns {Boolean}
     */
    isEmpty: function () {
        if (this instanceof TextNode) {
            return !(this instanceof VisibleTextNode);
        }
        if (this.childNodes.length === 0) {
            return true;
        }
        if (this.childNodes.length === 1 && (this.childNodes[0].isBR() || this.childNodes[0] instanceof VirtualTextNode || this.childNodes[0] instanceof ArchitecturalSpaceNode)) {
            return true;
        }
        return false;
    },
    /**
     * Returns true if the node is a "format" node.
     * In this context, a "format" node is understood as
     * an editable block or an editable element expecting text
     * (eg.: p, h1, span).
     *
     * @param {String []} [styleTags]
     * @returns {Boolean}
     */
    isFormatNode: function (styleTags) {
        styleTags = styleTags || this.options.defaultStyleTags;
        console.warn('defaultStyleTags ?');
        return styleTags.indexOf(this.nodeName) !== -1;
    },
    /**
     * Return true if the given node is an image element (IMG).
     *
     * @returns {Boolean}
     */
    isImg: function () {
        return this.nodeName === 'img';
    },
    /**
     * Returns true if the node is within a table.
     *
     * @returns {Boolean}
     */
    isInTable: function () {
        return !!this.ancestor(this._isTable);
    },
    /**
     * Return true if the given node is contained within a node of given tag name.
     *
     * @param {Boolean} tag eg: 'B', 'I', 'U'
     * @returns {Boolean}
     */
    isInTag: function (tag) {
        return !!this.ancestor(function (n) {
            return n.nodeName === tag;
        });
    },
    /**
     * Return true if the given node is an inline element.
     *
     * @returns {Boolean}
     */
    isInline: function () {
        return this instanceof TextNode || this.tree.options.formatTags.indexOf(this.nodeName) !== -1;
         // &&
         //    !this.isCell() && 
         //    !this.isEditable() &&
         //    !this.isList() &&
         //    !this.isPre() &&
         //    !this._isHr() &&
         //    !this._isPara() &&
         //    !this._isTable() &&
         //    !this._isBlockquote() &&
         //    !this.isData();
    },
    /**
     * Return true if the given node is contained within a list element.
     *
     * @returns {Boolean}
     */
    isInList: function () {
        return !!this.ancestor(this.isList);
    },
    /**
     * Return true if the given node is on a left edge (ignoring invisible text).
     *
     * @returns {Boolean}
     */
    isLeftEdge: function () {
        var previousSibling = this.parent.childNodes.slice(0, this.index());
        while (previousSibling.length && previousSibling[0] instanceof ArchitecturalSpaceNode) {
            previousSibling.pop();
        }
        return !previousSibling.length;
    },
    /**
     * Return true if the given node is the left-most node of given ancestor.
     *
     * @param {Node} ancestor
     * @returns {Boolean}
     */
    isLeftEdgeOf: function (ancestor) {
        while (node && node !== ancestor) {
            if (!node.isLeftEdge()) {
                return false;
            }
            node = node.parentNode;
        }
        return true;
    },
    /**
     * Return true if the given node is a list item element (LI).
     *
     * @returns {Boolean}
     */
    isLi: function () {
        return this.nodeName === 'li';
    },
    /**
     * Return true if the given node is a (un-)ordered list element (UL, OL).
     *
     * @returns {Boolean}
     */
    isList: function () {
        return ['ul', 'ol'].indexOf(this.nodeName) !== -1;
    },
    /**
     * Returns true if the node is a block.
     *
     * @returns {Boolean}
     */
    isNodeBlockType: function () {
        if (this.isText()) {
            return false;
        }
        console.warn('todo');
        var display = window.getComputedStyle(node).display;
        // All inline elements have the word 'inline' in their display value, except 'contents'
        return display.indexOf('inline') === -1 && display !== 'contents';
    },
    /**
     * Return true if the given node is a preformatted text element (PRE).
     *
     * @returns {Boolean}
     */
    isPre: function () {
        return this.nodeName === 'pre';
    },
    /**
     * Return true if the given node is on a right edge (ignoring invisible text).
     *
     * @returns {Boolean}
     */
    isRightEdge: function () {
        var nextSibling = this.parent.childNodes.slice(this.index() + 1);
        while (nextSibling.length && nextSibling[0] instanceof ArchitecturalSpaceNode) {
            nextSibling.pop();
        }
        return !nextSibling.length;
    },
    /**
     * Return true if the given node is the right-most node of given ancestor.
     *
     * @param {Node} ancestor
     * @returns {Boolean}
     */
    isRightEdgeOf: function (ancestor) {
        while (node && node !== ancestor) {
            if (!node.isRightEdge()) {
                return false;
            }
            node = node.parentNode;
        }
        return true;
    },
    /**
     * Return true if the given node is a span element (SPAN).
     *
     * @returns {Boolean}
     */
    isSpan: function () {
        return this.nodeName === 'span';
    },
    /**
     * Return true if the given node's type is text (3).
     *
     * @returns {Boolean}
     */
    isText: function () {
        return false;
    },
    /**
     *
     * @returns {Boolean}
     */
    isVirtual: function () {
        return this._isVirtual;
    },
    /**
     * Returns true if the node is a text node with visible text.
     *
     * @returns {Boolean}
     */
    isVisibleText: function () {
        return false;
    },
    /**
     * Return true if the given node is a void element (BR, COL, EMBED, HR, IMG, INPUT, ...).
     *
     * @see http://www.w3.org/html/wg/drafts/html/master/syntax.html#void-elements
     * @returns {Boolean}
     */
    isVoid: function () {
        return ['br', 'img', 'hr', 'iframe', 'button', 'input'].indexOf(this.nodeName) !== -1;
    },
    /**
     * Return true if the given node is a block quote element (BLOCKQUOTE).
     *
     * @returns {Boolean}
     */
    _isBlockquote: function () {
        return this.nodeName === 'blockquote';
    },
    /**
     * Return true if the given node is a horizontal rule element (HR).
     *
     * @private
     * @returns {Boolean}
     */
    _isHr: function () {
        return this.nodeName === 'hr';
    },
    /**
     * Return true if the given node is a paragraph element (DIV, P, LI, H[1-7]).
     *
     * @private
     * @returns {Boolean}
     */
    _isPara: function () {
        if (this.isEditable()) {
            return false;
        }
        // Chrome(v31.0), FF(v25.0.1) use DIV for paragraph
        return ['div', 'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'].indexOf(this.nodeName) !== -1;
    },
    /**
     * Return true if the given node is a table element (TABLE).
     *
     * @private
     * @returns {Boolean}
     */
    _isTable: function () {
        return this.nodeName === 'table';
    },
    /**
     * Return true if the given node is a text area element (TEXTAREA).
     *
     * @private
     * @returns {Boolean}
     */
    _isTextarea: function () {
        return this.nodeName === 'textarea';
    },
    isVoidBlock: function () {
        return (!this.isBR() && this.isVoid()) || this.options.isVoidBlock(this);
    },
    isUnbreakable: function () {
        return ["td", "tr", "tbody", "tfoot", "thead", "table"].indexOf(this.nodeName) !== -1 ||
            this.isEditable() ||
            this.tree.options.isUnbreakable(this);
    },
    isEditable: function () {
        return this.tree.options.isEditableNode(this);
    },
});

});
