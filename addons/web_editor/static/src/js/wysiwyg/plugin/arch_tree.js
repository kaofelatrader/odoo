odoo.define('wysiwyg.plugin.arch_tree', function (require) {
'use strict';

var $ = require('web_editor.jquery');
var _ = require('web_editor._');
var Class = require('web.Class');

var isNode = {

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
        return this instanceof ArchitecturalSpaceNode || this instanceof VirtualNode;
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
        var self = this;
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
    isData: function (node) {
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
        return this.nodeName === 'editable';
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
            return this instanceof VirtualNode;
        }
        if (this.childNodes.length === 0) {
            return true;
        }
        if (this.childNodes.length === 1 && (this.childNodes[0].isBR() || this.childNodes[0] instanceof VirtualNode || this.childNodes[0] instanceof ArchitecturalSpaceNode)) {
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
     * Return true if the given node is a text node that is not visible.
     *
     * @returns {Boolean}
     */
    isInvisibleText: function () {
        return this.isText() && !this.isVisibleText();
    },
    /**
     * Return true if the given node is on a left edge (ignoring invisible text).
     *
     * @returns {Boolean}
     */
    isLeftEdge: function () {
        var previousSibling = this.parent.childNodes.slice(0, this.index());
        while (previousSibling.length && previousSibling[0].isInvisibleText()) {
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
        while (nextSibling.length && nextSibling[0].isInvisibleText()) {
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
        return this instanceof TextNode;
    },
    /**
     * Returns true if the node is a text node with visible text.
     *
     * @returns {Boolean}
     */
    isVisibleText: function () {
        return this instanceof TextNode && !(this instanceof VirtualNode) && !(this instanceof ArchitecturalSpaceNode);
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
};

function ClassName (classNames) {
    this.value = classNames.replace(/\s\s+/, ' ').split(' ');
}
ClassName.prototype.contains = function (className) {
    return this.value.indexOf(className) !== -1;
};
ClassName.prototype.remove = function (classNames) {
    classNames.replace(/\s\s+/, ' ').split(' ').forEach(function (className) {
        var index = this.value.indexOf(className);
        if (index !== -1) {
            this.value.splice(index, 1);
        }
    });
};
ClassName.prototype.add = function (classNames) {
    classNames.replace(/\s\s+/, ' ').split(' ').forEach(function (className) {
        var index = this.value.indexOf(className);
        if (index === -1) {
            this.value.push(className);
        }
    });
};
ClassName.prototype.render = function () {
    return this.value.join(' ');
};

//////////////////////////////////////////////////////////////

var ArchNode = Class.extend(isNode, {
    init: function (tree, nodeName, attributes) {
        var self = this;
        this.tree = tree;
        this.nodeName = nodeName.toLowerCase();
        this.attributes = attributes;
        attributes.forEach(function (attribute) {
            if (attribute[0] === "class") {
                self.className = attribute[1] = new ClassName(attribute[1]);
            }
        });
        if (!this.className) {
            this.className = new ClassName('');
            attributes.push(['class', this.className]);
        }
        this.childNodes = [];
        this.startRange = null;
        this.endRange = null;
    },

    // Update arch

    append: function (archNode) {
        this._changeParent(archNode, this.childNodes.length);
    },
    insertAfter: function (archNode, ref) {
        this._changeParent(archNode, ref.index() + 1);
    },
    insertBefore: function (archNode, ref) {
        this._changeParent(archNode, ref.index());
    },
    prepend: function (archNode) {
        this._changeParent(archNode, 0);
    },
    remove: function () {
        this.parent.childNodes.splice(this.index(), 1);
        if (this.id) {
            this.tree._removeArchNode(this);
        }
        if (this.childNodes) {
            this.childNodes.forEach(function (archNode) {
                archNode.remove();
            });
        }
        this.id = null;
    },

    // browse

    index: function () {
        return this.parent.childNodes.indexOf(this);
    },
    /**
     * @param {function} fn called on this and get the next point as param
     *          return true if the next node is available
     * @returns {ArchNode}
     **/
    next: function (fn) {
        return this._prevNext('next', fn);
    },
    nextSibling: function (fn) {
        for (var k = this.index() + 1; k < this.parent.childNodes.length; k++) {
            if (!fn || fn(this.parent.childNodes[k])) {
                return this.parent.childNodes[k];
            }
        }
    },
    prev: function (fn) {
        return this._prevNext('prev', fn);
    },
    previousSibling: function (fn) {
        for (var k = this.index() - 1; k >= 0; k--) {
            if (!fn || fn(this.parent.childNodes[k])) {
                return this.parent.childNodes[k];
            }
        }
    },
    ancestor: function (fn) {
        var parent = this.parent;
        while (parent && !fn.call(parent, parent)) {
            parent = parent.parent;
        }
        return parent;
    },

    // export

    /**
     * @returns {Document-fragment}
     **/
    toNode: function (options) {
        options = options || {};
        var fragment = document.createDocumentFragment();
        fragment.appendChild(this._toNode(options));
        return fragment;
    },
    toJSON: function () {
        return {
            id: this.id,
            nodeName: this.nodeName,
            attributes: this.attributes.slice(),
            childNodes: this.childNodes.map(function (archNode) {
                return archNode.toJSON();
            }),
        };
    },
    toText: function (options) {
        var d = document.createElement('div');
        d.appendChild(this.toNode(options));
        return d.innerHTML;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyStructureRules: function () {
        var newParents = [];
        var parentedRule = [];
        var structureRules = this.tree.options.structure;
        for (var k = 0; k < structureRules.length; k++) {
            var children = structureRules[k][1];
            for (var i = 0; i < children.length; i++) {
                var check = children[i];
                if (    (typeof check === 'function' && check(this)) || 
                        (check === 'TEXT' && this instanceof TextNode) ||
                        this.nodeName === check) {
                    parentedRule = parentedRule.concat(structureRules[k][0]);
                    break;
                }
            }
        }

        if (!(!parentedRule.length || parentedRule.indexOf('editable') !== -1 || parentedRule.indexOf(null) !== -1 || parentedRule.indexOf(this.parent.nodeName) !== -1)) {
            // create parent
            var newParent = new ArchNode(this.tree, parentedRule[0], []);
            this.parent.insertBefore(newParent, this);
            newParent.append(this);
            newParents.push(newParent);
            newParents = newParents.concat(newParent._applyStructureRules());
        }

        if (this.childNodes) {
            this.childNodes.slice().forEach(function (archNode) {
                newParents = newParents.concat(archNode._applyStructureRules());
            });
        }
        return newParents;
    },
    _addArchitecturalSpaceNode: function () {
        if (this.isPre()) {
            return;
        }
        if (this.parent && (this.isBlock() || this.parent.isBlock())) {
            if (!(this.previousSibling() instanceof ArchitecturalSpaceNode)) {
                this.parent.insertBefore(new ArchitecturalSpaceNode(this.tree), this);
            }
            if (!(this.nextSibling() instanceof ArchitecturalSpaceNode)) {
                this.parent.insertAfter(new ArchitecturalSpaceNode(this.tree), this);
            }
        }

        if (!(this instanceof TextNode)) {
            this.childNodes.slice().forEach(function (archNode) {
                archNode._addArchitecturalSpaceNode();
            });
        }
    },
    _changeParent: function (archNode, index) {
        if (archNode instanceof VirtualNode) {
            var self = this;
            archNode.childNodes.forEach(function (archNode) {
                self._changeParent(archNode, index);
            });
            archNode.remove();
            return;
        }

        archNode._addInTree();

        if (archNode.parent) {
            archNode.parent.childNodes.splice(archNode.parent.childNodes.indexOf(archNode), 1);
        }
        archNode.parent = this;
        this.childNodes.splice(index, 0, archNode);
    },
    _addInTree: function () {
        if (!this.id && this.parent && this.parent.id) {
            this.tree._addArchNode(this);
            this.childNodes.forEach(function (archNode) {
                archNode._addInTree();
            });
        }
    },
    /**
     * @param {function} fn called on this and get the next point as param
     *          return true if the next node is available
     * @param {boolean} __inShearch: internal flag
     * @returns {ArchNode}
     **/
    _prevNext: function (direction, fn, __inShearch) {
        var next = this.parent.childNodes[this.index() + (direction === 'next' ? 1 : -1)];
        if (!next) {
            return this.parent._prevNext(direction, fn, true);
        }
        if (!this.options.isEditableNode(next) || (fn && !fn.call(this, next))) {
            return next._prevNext(direction, fn, true);
        }
        return next;
    },
    _toNode: function (options) {
        var node = document.createElement(this.nodeName);
        this.attributes.forEach(function (attribute) {
            var value = typeof attribute[1] === 'string' ? attribute[1] : attribute[1].render();
            if (value !== '') {
                node.setAttribute(attribute[0], value);
            }
        });
        if (options.architecturalSpace) {
            options = Object.assign({}, options, {
                architecturalLevel: (options.architecturalLevel || 0) + 1,
            });
        }
        this.childNodes.forEach(function (archNode) {
            node.appendChild(archNode._toNode(options));
        });
        this.tree._linkElement(this, node);
        return node;
    },
});

//////////////////////////////////////////////////////////////

var TextNode = ArchNode.extend({
    init: function (tree, nodeValue) {
        this.tree = tree;
        this.nodeValue = nodeValue;
        this.startRange = null;
        this.endRange = null;
    },
    toJSON: function () {
        return {
            id: this.id,
            nodeValue: this.nodeValue,
        };
    },
    _applyStructureRules: function () {
        if (this.ancestor(this.isPre)) {
            return this._super();
        }

        var before = this.nodeValue.match(/^([\s\n\r\t]*)/)[0];
        var after = before.length < this.nodeValue.length ? this.nodeValue.match(/([\s\n\r\t]*)$/)[0] : '';
        var text = this.nodeValue.slice(before.length, this.nodeValue.length - after.length);

        text = text.replace(/\s+/g, ' ');

        if (before.length || text.length) {
            var ancestor = this.ancestor(this.isBlock);

            if (before.length) {
                before = '';
                var prev = this.previousSibling();
                if (!prev) {
                    if (!this.isLeftEdge(ancestor)) {
                        before = ' ';
                    }
                } else if (prev.isInline() && (!(prev instanceof TextNode) || prev.isVisibleText())) {
                    before = ' ';
                }
            }
            if (after.length) {
                after = '';
                var next = this.nextSibling();
                if (!next) {
                    if (!this.isRightEdge(ancestor)) {
                        after = ' ';
                    }
                } else if (next.isInline() && (!(next instanceof TextNode) || next.isVisibleText())) {
                    after = ' ';
                }
            }

            if (!text.length) {
                text = before.length && after.length ? ' ' : '';
            } else {
                text = before + text + after;
            }
        }


        if (text.length) {
            this.nodeValue = text;
            // if this is an text node with content (not just an architechural node)
            return this._super();
        } else {
            this.remove();
        }

        return [];
    },
    _toNode: function (options) {
        var node = document.createTextNode(this.nodeValue);
        this.tree._linkElement(this, node);
        return node;
    },
});

//////////////////////////////////////////////////////////////

var VirtualNode = TextNode.extend({
    init: function () {
        this._super.apply(this, arguments);
        this.nodeValue = '\uFEFF';
    },
    toJSON: function () {
        return {
            id: this.id,
        };
    },
    _addArchitecturalSpaceNode: function () {
    },
    _applyStructureRules: function () {
        return [];
    },
});

//////////////////////////////////////////////////////////////

var ArchitecturalSpaceNode = TextNode.extend({
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyStructureRules: function () {
        return [];
    },
    _addArchitecturalSpaceNode: function () {
    },
    _toNode: function (options) {
        var space = '';
        if (options.architecturalSpace) {
            space = '\n';
            var level = (options.architecturalLevel || 0) - (this.nextSibling() ? 0 : 1);
            if (level > 0) {
                space += (new Array(level * options.architecturalSpace + 1).join(' '));
            }
        }
        var node = document.createTextNode(space);
        this.tree._linkElement(this, node);
        return node;
    },
});

//////////////////////////////////////////////////////////////

var FragmentNode = ArchNode.extend({
    init: function (tree) {
        this.tree = tree;
        this.childNodes = [];
    },
    toNode: function (options) {
        options = options || {};
        return this._toNode(options);
    },
    _toNode: function (options) {
        var fragment = document.createDocumentFragment();
        this.childNodes.forEach(function (archNode) {
            fragment.appendChild(archNode._toNode(options));
        });
        return fragment;
    },
});

//////////////////////////////////////////////////////////////

var RootNode = FragmentNode.extend({
    index: function () {
        return null;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyStructureRules: function () {
        return [];
    },
    _prevNext: function (direction, fn, __inShearch) {
        if (!__inShearch && this.childNodes[0]) {
            var next;
            if (direction === 'next') {
                next = this.childNodes[0];
            } else if (direction === 'prev') {
                next = this.childNodes[this.childNodes.length - 1];
            }
            if (!this.options.isEditableNode(next) || (fn && !fn.call(this, next))) {
                return next._prevNext(direction, fn, true);
            }
            return next;
        }

        var virtualNode = new VirtualNode(this.tree);
        virtualNode.parent = this;
        this[direction === 'next' ? 'append' : 'prepend'](virtualNode);
        if (!this.options.isEditableNode(virtualNode) || (fn && !fn.call(this, virtualNode))) {
            virtualNode.remove();
            return;
        }
        return virtualNode;
    },
});

//////////////////////////////////////////////////////////////

function ArchTree (options) {
    this.options = options;
    this._nodeList = {};
    this._nodeElementList = {};
    this._id = 1;
    this.root = new RootNode(this);
    this._addArchNode(this.root, null, []);
}
ArchTree.prototype.getArchNode = function (archNodeId) {
    return this._nodeList[archNodeId];
};
ArchTree.prototype.whoIsThisNode = function (element) {
    for (var k in this._nodeElementList) {
        if (this._nodeElementList[k] === element) {
            return this._nodeList[k];
        }
    }
    throw new Error('must implement method to search the archNode');
};
ArchTree.prototype._linkElement = function (archNode, element) {
    this._nodeElementList[archNode.id] = element;
};
ArchTree.prototype._addArchNode = function (archNode) {
    archNode.id = ++this._id;
    this._nodeList[archNode.id] = archNode;
};
ArchTree.prototype._removeArchNode = function (archNode) {
    delete this.nodeValue[archNode.id];
    delete this._nodeElementList[archNode.id];
};

// Update arch

ArchTree.prototype.append = function (archNode) {
    this.root.append(archNode);
};
ArchTree.prototype.insertAfter = function (archNode, archNodeId) {
    this.root.insertAfter(archNode, this.getArchNode(archNodeId));
};
ArchTree.prototype.insertBefore = function (archNode, archNodeId) {
    this.root.insertBefore(archNode, this.getArchNode(archNodeId));
};
ArchTree.prototype.prepend = function (archNode) {
    this.root.prepend(archNode);
};

// import

/**
 * @param {string} xml
 * @returns {ArchNode}
 **/
ArchTree.prototype.parse = function (xml) {
    var self = this;
    var fragment = new FragmentNode(this);

    var fragmentDOM = document.createDocumentFragment();
    var parser = new DOMParser()
    var element = parser.parseFromString("<root>" + xml + "</root>","text/html");

    if (element.querySelector('parsererror')) {
        console.error(element);
        return;
    }

    var root = element.querySelector('root');

    root.childNodes.forEach(function (element) {
        fragment.append(self._parseElement(element));
    });
    this._applyStructure(fragment);
    this._applyOrdered(fragment);

    return fragment;
};
ArchTree.prototype._parseElement = function (element) {
    var self = this;
    var archNode;
    if (element.tagName) {
        var attributes = Object.values(element.attributes).map(function (attribute) {
            return [attribute.name, attribute.value];
        });
        archNode = new ArchNode(this, element.nodeName, attributes);
        element.childNodes.forEach(function (child) {
            archNode.append(self._parseElement(child));
        });
    } else {
        archNode = new TextNode(this, element.nodeValue);
    }
    return archNode;
};
ArchTree.prototype._applyStructure = function (archNode) {
    var item;
    var newParents = archNode._applyStructureRules();

    for (var k = 0; k < newParents.length; k++) {
        var item = newParents[k];
        var prev = item.previousSibling(function (n) {
            return !(n instanceof VirtualNode) && !(n instanceof ArchitecturalSpaceNode);
        });
        if (prev && prev.nodeName === item.nodeName && newParents.indexOf(prev) !== -1) {
            item.childNodes.forEach(function (node) {
                prev.append(node);
            });
            item.remove();
            continue;
        }

        var next = item.previousSibling(function (n) {
            return !(n instanceof VirtualNode) && !(n instanceof ArchitecturalSpaceNode);
        });
        if (next && next.nodeName === item.nodeName && newParents.indexOf(next) !== -1) {
            item.childNodes.forEach(function (node) {
                next.append(node);
            });
            item.remove();
            continue;
        }
    }

    archNode._addArchitecturalSpaceNode();
};
ArchTree.prototype._applyOrdered = function (archNode) {

};
/**
 * @param {JSON} json
 * @returns {ArchNode}
 **/
ArchTree.prototype.import = function (json) {
};

// export

ArchTree.prototype.getRange = function () {
    var start = this.root;
    while (start.childNodes[start.startRange]) {
        start = start.childNodes[start.startRange];
    }
    var end = this.root;
    while (end.childNodes[end.endRange]) {
        end = end.childNodes[end.endRange];
    }
    return {
        startId: start.id,
        startOffset: start.startRange,
        endId: end.id,
        endOffset: end.endRange,
    };
};
ArchTree.prototype.render = function (archNodeId) {
    var archNode = archNodeId ? this.getArchNode(archNodeId) : this.root;
    return archNode.render();
};
ArchTree.prototype.export = function (archNodeId) {
    var archNode = archNodeId ? this.getArchNode(archNodeId) : this.root;
    return JSON.stringify(archNode);
};

return ArchTree;

});
