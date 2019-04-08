odoo.define('wysiwyg.plugin.arch_tree', function (require) {
'use strict';

var $ = require('web_editor.jquery');
var _ = require('web_editor._');
var Class = require('web.Class');

function ClassName (classNames) {
    this.value = classNames.replace(/\s\s+/, ' ').split(' ');
}
ClassName.prototype = {
    add: function (classNames) {
        classNames.replace(/\s\s+/, ' ').split(' ').forEach(function (className) {
            var index = this.value.indexOf(className);
            if (index === -1) {
                this.value.push(className);
            }
        });
    },
    contains: function (className) {
        return this.value.indexOf(className) !== -1;
    },
    remove: function (classNames) {
        classNames.replace(/\s\s+/, ' ').split(' ').forEach(function (className) {
            var index = this.value.indexOf(className);
            if (index !== -1) {
                this.value.splice(index, 1);
            }
        });
    },
    toString: function () {
        return this.value.join(' ');
    },
    get length () {
        return this.toString().length;
    },
};


//////////////////////////////////////////////////////////////

function Attributes (attributes) {
    var self = this;
    this.__order__ = [];
    attributes.forEach(function (attribute) {
        self.add(attribute[0], attribute[1])
    })
}
Attributes.prototype = {
    add: function (name, value) {
        if (this.__order__.indexOf(name) === -1) {
            this.__order__.push(name);
        }
        if (name === 'class') {
            value = new ClassName(value + '');
        }
        this[name] = value;
    },
    forEach: function (fn) {
        this.__order__.forEach(fn.bind(this));
    },
    remove: function (classNames) {
        var index = this.__order__.indexOf(name);
        if (index !== -1) {
            this.__order__.splice(index, 1);
        }
        delete this[name];
    },
    toJSON: function (argument) {
        var self = this;
        var attributes = [];
        this.__order__.forEach(function (name) {
            if (name === 'data-archnode-id') {
                return;
            }
            var value = self[name].toString();
            if (value.length) {
                attributes.push([name, value]);
            }
        });
        return attributes;
    },
    toString: function (options) {
        var self = this;
        var string = '';
        this.__order__.forEach(function (name) {
            if (name === 'data-archnode-id' && (!options || !options.displayId)) {
                return;
            }
            var value = self[name].toString();
            if (!value.length) {
                return;
            }
            if (string.length) {
                string += ' ';
            }
            string += name + '="' + value.replace('"', '\\"') + '"';
        });
        return string;
    },
};

//////////////////////////////////////////////////////////////

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
     * Return true if the given node is a text node that is not visible.
     *
     * @returns {Boolean}
     */
    isInvisibleText: function () {
        return this instanceof TextNode && !(this instanceof VisibleTextNode);
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
     *
     * @returns {Boolean}
     */
    isVirtual: function () {
        return this instanceof VirtualTextNode || this instanceof FragmentNode || this._isVirtual;
    },
    /**
     * Returns true if the node is a text node with visible text.
     *
     * @returns {Boolean}
     */
    isVisibleText: function () {
        return this instanceof VisibleTextNode;
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
    isVoidBlock: function () {
        return this.isVoid();
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

//////////////////////////////////////////////////////////////

var ArchNode = Class.extend(isNode, {
    init: function (tree, nodeName, attributes) {
        this.tree = tree;
        this.nodeName = nodeName.toLowerCase();
        this.attributes = new Attributes(attributes);
        if (!this.attributes.class) {
            this.attributes.add('class', '');
        }
        this.className = this.attributes.class;
        this.childNodes = [];
    },

    //--------------------------------------------------------------------------
    // Public: Export
    //--------------------------------------------------------------------------

    /**
     * @returns {Document-fragment}
     **/
    toNode: function (options) {
        options = options || {};
        if (options.architecturalSpace) {
            this._architecturalSpaceNodePropagation();
        }
        var fragment = document.createDocumentFragment();
        fragment.appendChild(this._toNode(options));
        return fragment;
    },
    toJSON: function () {
        var data = {};
        var childNodes = [];
        this.childNodes.forEach(function (archNode) {
            var json = archNode.toJSON();
            if (json) {
                if (json.nodeName || json.nodeValue) {
                    childNodes.push(json);
                } else if (json.childNodes) {
                    childNodes = childNodes.concat(json.childNodes);
                }
            }
        });

        if (childNodes.length) {
            data.childNodes = childNodes;
        }

        if (this.isVirtual()) {
            return data;
        }

        if (this.id) {
            data.id = this.id;
        }
        if (this.nodeName) {
            data.nodeName = this.nodeName;
        }
        if (this.nodeValue) {
            data.nodeValue = this.nodeValue;
        }
        var attributes = this.attributes.toJSON();
        if (attributes.length) {
            data.attributes = attributes;
        }

        return data;
    },
    toString: function (options) {
        var string = '';
        var isVirtual = this.isVirtual() && !options.keepVirtual;

        if (!isVirtual) {
            string += '<' + this.nodeName;
            var attributes = this.attributes.toString(options);
            if (attributes.length) {
                string += ' ';
                string += attributes;
            }
            if (this.isVoid() && !this.childNodes.length) {
                string += '/';
            }
            string += '>';

            if (options.architecturalSpace) {
                options = Object.assign({}, options, {
                    architecturalLevel: (options.architecturalLevel || 0) + 1,
                });
            }
        }
        this.childNodes.forEach(function (archNode) {
            string += archNode.toString(options);
        });
        if (!isVirtual && (!this.isVoid() || this.childNodes.length)) {
            string += '</' + this.nodeName + '>';
        }
        return string;
    },

    //--------------------------------------------------------------------------
    // Public: Update
    //--------------------------------------------------------------------------

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
    empty: function () {
        if (!this.options.isEditableNode(this)) {
            console.warn("can not empty a non editable node");
            return;
        }
        this.childNodes.slice().forEach(function (archNode) {
            archNode.remove();
        });
    },
    remove: function () {
        if (!this.options.isEditableNode(this.parent)) {
            console.warn("can not remove a node in a non editable node");
            return;
        }
        if (this.parent) {
            this.parent.childNodes.splice(this.index(), 1);
        }
        this.tree._removeArchNode(this);
        this.__removed = true;
        this.empty();
    },
    applyRules: function () {
        this._applyRulesCustom();
        if (!this.__removed) {
            this._applyRulesArchNode();
        }
        if (!this.__removed) {
            this._applyRulesOrder();
        }
        if (!this.__removed) {
            this._applyRulesCheckParents();
        }
        if (!this.__removed) {
            this._applyRulesPropagation();
        }
    },

    //--------------------------------------------------------------------------
    // Public: Browse
    //--------------------------------------------------------------------------

    firstChild: function () {
        return this.childNodes && this.childNodes.length ? this.childNodes[0] : this;
    },
    index: function () {
        return this.parent.childNodes.indexOf(this);
    },
    lastChild: function () {
        return this.childNodes && this.childNodes.length ? this.childNodes[this.childNodes.length - 1] : this;
    },
    nextSibling: function (fn) {
        for (var k = this.index() + 1; k < this.parent.childNodes.length; k++) {
            if (!fn || fn(this.parent.childNodes[k])) {
                return this.parent.childNodes[k];
            }
        }
    },
    previousSibling: function (fn) {
        for (var k = this.index() - 1; k >= 0; k--) {
            if (!fn || fn(this.parent.childNodes[k])) {
                return this.parent.childNodes[k];
            }
        }
    },
    ancestor: function (fn) {
        var parent = this;
        while (parent && !fn.call(parent, parent)) {
            parent = parent.parent;
        }
        return parent;
    },
    contains: function (archNode) {
        var parent = archNode.parent;
        while (parent && parent !== this) {
            parent = parent.parent;
        }
        return !!parent;
    },
    /**
     * @param {function} fn called on this and get the next point as param
     *          return true if the next node is available
     * @returns {ArchNode}
     **/
    nextUntil: function (fn) {
        return this._prevNextUntil('next', fn);
    },
    prevUntil: function (fn) {
        return this._prevNextUntil('prev', fn);
    },
    length: function (argument) {
        return this.childNodes.length;
    },
    path: function (ancestor) {
        var path = [];
        var node = this;
        while (node.parent && node.parent !== ancestor) {
            path.unshift(node.index());
            node = node.parent;
        }
        return path;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyRulesArchNode: function () {
    },
    _applyRulesOrder: function () {
    },
    _applyRulesCustom: function () {
        var rules = this._applyRulesFilterRules(this.tree.options.customRules);
        var ruleMethod;
        while (ruleMethod = rules.pop()) {
            var fragment = ruleMethod.call(this, this.tree, this);
            if (fragment) {
                var childNodes = fragment.childNodes.slice();
                this.parent.insertBefore(fragment, this);
                this.remove();
                childNodes.forEach(function (archNode) {
                    archNode.applyRules();
                });
                break;
            }
        }
    },
    _applyRulesGenerateParent: function (nodeName) {
        if (nodeName === 'EDITABLE') {
            return;
        }
        var newParent = new ArchNode(this.tree, nodeName, []);
        newParent.__applyRulesCheckParentsFlag = true;
        this.parent.insertBefore(newParent, this);
        newParent.append(this);
        newParent.applyRules();
    },
    _applyRulesCheckParents: function () {
        var rules = this.tree.options.parentedRules;
        var parentedRule = this._applyRulesFilterRules(rules);
        if (!(!parentedRule.length || parentedRule.indexOf(null) !== -1)) {

            // We seek to minimize the number of parents to create
            var parentName = this.parent.nodeName === 'FRAGMENT' ? 'EDITABLE' : this.parent.nodeName;
            var allreadyParents = [parentName];
            var availableCandidates = [parentName];
            var nextAvailables = [];
            // add children who match everthing for check next level
            for (var i = 0; i < rules.length; i++) {
                if (rules[i][0].indexOf(null) === -1) {
                    continue;
                }
                rules[i][1].forEach(function (value) {
                    if (allreadyParents.indexOf(value) === -1) {
                        allreadyParents.push(value);
                        nextAvailables.push(value)
                    }
                });
            }

            while (availableCandidates.length) {
                for (var k = 0; k < availableCandidates.length; k++) {

                    // check if a parent can match at this level
                    var candidate = availableCandidates[k];
                    if (parentedRule.indexOf(candidate) !== -1) {
                        if (parentName === candidate) {
                            return;
                        }
                        return this._applyRulesGenerateParent(candidate);
                    }

                    // add children for check next level
                    for (var i = 0; i < rules.length; i++) {
                        if (rules[i][0].indexOf(candidate) === -1) {
                            continue;
                        }
                        rules[i][1].forEach(function (value) {
                            if (allreadyParents.indexOf(value) === -1) {
                                allreadyParents.push(value);
                                nextAvailables.push(value)
                            }
                        });
                    }
                }
                availableCandidates = nextAvailables;
                nextAvailables = [];
            }

            if (parentedRule.indexOf(parentName) === -1 && parentedRule.indexOf('EDITABLE') === -1) {
                this._applyRulesGenerateParent(parentedRule[0]);
            }
        }
    },
    _applyRulesPropagation: function () {
        var childNodes = this.childNodes.slice();
        childNodes.forEach(function (archNode) {
            archNode.applyRules();
        });
        var newParents = [];
        this.childNodes.forEach(function (archNode) {
            if (childNodes.indexOf(archNode) === -1 && archNode.__applyRulesCheckParentsFlag) {
                archNode.__applyRulesCheckParentsFlag = false;
                newParents.push(archNode);
            }
        });
        this._applyRulesMergeExcessStructure(newParents);
    },
    _applyRulesFilterRules: function (rules) {
        var selectedRules = [];
        for (var k = 0; k < rules.length; k++) {
            var children = rules[k][1];
            for (var i = 0; i < children.length; i++) {
                var check = children[i];
                if ((typeof check === 'function' && check.call(this, this)) || this.nodeName === check) {
                    selectedRules = selectedRules.concat(rules[k][0]);
                    break;
                }
            }
        }
        return selectedRules;
    },
    _applyRulesMergeExcessStructure: function (newParents) {
        for (var k = 0; k < newParents.length; k++) {
            var item = newParents[k];
            var prev = item.previousSibling(function (n) {
                return !(n instanceof VirtualTextNode) && !(n instanceof ArchitecturalSpaceNode);
            });
            if (prev && prev.nodeName === item.nodeName && newParents.indexOf(prev) !== -1 && item.attributes.toString() === prev.attributes.toString()) {
                item.childNodes.slice().forEach(function (node) {
                    prev.append(node);
                });
                item.remove();
                continue;
            }

            var next = item.previousSibling(function (n) {
                return !(n instanceof VirtualTextNode) && !(n instanceof ArchitecturalSpaceNode);
            });
            if (next && next.nodeName === item.nodeName && newParents.indexOf(next) !== -1 && item.attributes.toString() === next.attributes.toString()) {
                item.childNodes.slice().forEach(function (node) {
                    next.append(node);
                });
                item.remove();
                continue;
            }
        }
    },
    _architecturalSpaceNodePropagation: function () {
        if (this.__removed || this instanceof ArchitecturalSpaceNode) {
            return;
        }
        if (this.parent) {
            this._addArchitecturalSpaceNode();
        }
        if (!(this instanceof TextNode) && !this.ancestor(this.isPre)) {
            this.childNodes.slice().forEach(function (archNode) {
                archNode._architecturalSpaceNodePropagation();
            });
        }
    },
    _addArchitecturalSpaceNode: function () {
        var prev = this.previousSibling();
        if (prev instanceof ArchitecturalSpaceNode && this.isText() && this.nodeValue[0] === '\n') {
            console.log(prev.previousSibling());
            prev.remove();
        }

        if (!this.isBlock() && !this.parent.isBlock()) {
            return;
        }

        if (!(prev instanceof ArchitecturalSpaceNode) && (!this.isText() || this.nodeValue[0] !== '\n')) {
            this.parent.insertBefore(new ArchitecturalSpaceNode(this.tree), this);
        }

        if (this.isBlock() && !this.isPre() && !this.isText() && !this.isVoid() && this.childNodes.length) {
            this.append(new ArchitecturalSpaceNode(this.tree), this);
        }
    },
    _changeParent: function (archNode, index) {
        if (this.isVoid()) {
            throw new Error("You can't add a node in a void");
        }

        if (!this.options.isEditableNode(this)) {
            console.warn("can not add a node in a non editable node");
            return;
        }
        if (archNode.parent && !this.options.isEditableNode(archNode.parent)) {
            console.warn("can not remove a node in a non editable node");
            return;
        }

        if (archNode instanceof FragmentNode) {
            var self = this;
            archNode.childNodes.slice().forEach(function (archNode) {
                self._changeParent(archNode, index++);
            });
            archNode.remove();
            return;
        }

        if (archNode.parent) {
            archNode.parent.childNodes.splice(archNode.parent.childNodes.indexOf(archNode), 1);
        }
        archNode.parent = this;
        this.childNodes.splice(index, 0, archNode);
        this.__removed = false;
        this.tree._addArchNode(archNode);
    },
    _generateVirtualNode: function (insertMethod, fn) {
        var VirtualTextNode = new VirtualTextNode(this.tree);
        VirtualTextNode.parent = this;
        insertMethod(VirtualTextNode);
        if (!this.options.isEditableNode(VirtualTextNode) || (fn && !fn.call(this, VirtualTextNode))) {
            VirtualTextNode.remove();
            return;
        }
        return VirtualTextNode;
    },
    /**
     * Next or previous node, following the leaf
     * - go to the first child (or last) if exist (an the node in not unbreakable)
     * - go to next sibbling
     * - when the are no next sibbling, go to the parent
     * - go to then next node
     * - go to the first child...
     *
     * if begin in an unbreakable, stop before go out this unbreakable and before stop
     * try to insert a virtual node and check it.
     *
     * @param {function} fn called on this and get the next point as param
     *          return true if the next node is available
     * @param {boolean} __closestUnbreakable: internal flag
     * @param {boolean} __goUp: internal flag
     * @returns {ArchNode}
     **/
    _prevNextUntil: function (direction, fn, __closestUnbreakable, __goUp) {
        if (!__closestUnbreakable) {
            __closestUnbreakable = this.ancestor(this.options.isUnbreakable);
        }
        var next;
        if (!__goUp && !this.options.isUnbreakable(this)) {
            var deeper = direction === 'next' ? this.firstChild() : this.lastChild();
            if (deeper !== this) {
                next = deeper;
            }
        }
        __goUp = false;
        if (!next) {
            next = this.parent.childNodes[this.index() + (direction === 'next' ? 1 : -1)];
        }
        if (!next) {
            __goUp = true;
            next = this.parent;
        }
        if (!__closestUnbreakable.contains(next)) {
            var insertMethod = __closestUnbreakable[direction === 'next' ? 'append' : 'prepend'].bind(__closestUnbreakable);
            return this._generateVirtualNode(insertMethod, fn);
        }
        if (fn && !fn.call(this, next)) {
            return next._prevNextUntil(direction, fn, __closestUnbreakable, __goUp);
        }
        return next;
    },
    _toNode: function (options) {
        if (this.isVirtual() && !options.keepVirtual) {
            return document.createDocumentFragment();
        }

        var node = this.tree._createElement(this, this.nodeName);
        this.attributes.forEach(function (name) {
            if (name === 'data-archnode-id' && !options.displayId) {
                return;
            }
            var value = this[name].toString()
            if (value.length) {
                node.setAttribute(name, value);
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
        return node;
    },
});

//////////////////////////////////////////////////////////////

var TextNode = ArchNode.extend({
    init: function (tree, nodeValue) {
        this.tree = tree;
        this.nodeName = 'TEXT';
        this.nodeValue = nodeValue;
    },
    empty: function () {
        this.nodeValue = '';
    },
    toString: function (options) {
        if (this.isVirtual() && !options.keepVirtual) {
            return '';
        }
        return this.nodeValue || '';
    },
    length: function (argument) {
        return this.nodeValue.length;
    },
    _applyRulesPropagation: function () {},
    _addArchitecturalSpaceNodePropagation: function () {},
    _toNode: function (options) {
        if (this.isVirtual() && !options.keepVirtual) {
            return document.createDocumentFragment();
        }
        return this.tree._createTextNode(this, this.toString(options));
    },
});

//////////////////////////////////////////////////////////////

var VisibleTextNode = TextNode.extend({
    toJSON: function () {
        var data = {
            nodeValue: this.nodeValue,
        };
        if (this.id) {
            data.id = this.id;
        }
        return data;
    },
});

//////////////////////////////////////////////////////////////

var VirtualTextNode = TextNode.extend({
    char: '\uFEFF',
    init: function () {
        this._super.apply(this, arguments);
        this.nodeValue = this.nodeValue.length ? this.nodeValue : this.char;
    },
    toJSON: function () {
        return null;
    },
    _applyRulesArchNode: function () {
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
                if (!prev && !this.isLeftEdge(ancestor)) {
                    before = ' ';
                } else if (prev && prev.isInline() && (!(prev instanceof TextNode) || prev.isVisibleText())) {
                    before = ' ';
                }
            }
            if (after.length || !text.length) {
                after = '';
                var next = this.nextSibling();
                if (!next && !this.isRightEdge(ancestor)) {
                    after = ' ';
                } else if (next && next.isInline() && (!(next instanceof TextNode) || next.isVisibleText())) {
                    after = ' ';
                }
            }

            if (!text.length) {
                text = before.length && after.length ? ' ' : '';
            } else {
                text = before + text + after;
            }
        }

        if (text.length && text !== this.char) {
            var visibleText = new VisibleTextNode(this.tree, text);
            this.parent.insertBefore(visibleText, this);
            visibleText.applyRules();
        }

        this.remove();
    },
    _applyRulesCheckParents: function () {},
    _addArchitecturalSpaceNode: function () {},
});

//////////////////////////////////////////////////////////////

var ArchitecturalSpaceNode = TextNode.extend({
    init: function (tree, nodeValue) {
        this._super.apply(this, arguments);
        this.nodeName = 'TEXT-ARCH';
    },
    toJSON: function () {
        return null;
    },
    toString: function (options) {
        if (this.isVirtual() && !options.keepVirtual) {
            return '';
        }
        var space = '';
        if (options.architecturalSpace) {
            space = '\n';
            var level = (options.architecturalLevel || 0) - (this.nextSibling() ? 0 : 1);
            if (level > 0) {
                space += (new Array(level * options.architecturalSpace + 1).join(' '));
            }
        }
        return space;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyRulesCheckParents: function () {},
    _addArchitecturalSpaceNode: function () {},
});

//////////////////////////////////////////////////////////////

var FragmentNode = ArchNode.extend({
    init: function (tree) {
        this.tree = tree;
        this.nodeName = 'FRAGMENT';
        this.childNodes = [];
    },
    toNode: function (options) {
        options = options || {};
        if (options.architecturalSpace) {
            this._architecturalSpaceNodePropagation();
        }
        return this._toNode(options);
    },
    applyRules: function () {
        this._applyRulesPropagation();
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
    init: function (tree) {
        this.tree = tree;
        this.nodeName = 'EDITABLE';
        this.childNodes = [];
    },
    index: function () {
        return null;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _prevNextUntil: function (direction, fn, __closestUnbreakable, __goUp) {
        if (!__closestUnbreakable) {
            __closestUnbreakable = this;
            var next = this._super.apply(this, arguments);
            if (next) {
                return next;
            }
        }

        var insertMethod = this[direction === 'next' ? 'append' : 'prepend'].bind(this);
        return this._generateVirtualNode(insertMethod, fn);
    },
});

//////////////////////////////////////////////////////////////

/*function ArchTree (options) {
    this.options = options;
    this._archNodeList = {};
    this._nodeList = [];
    this._nodeListArchNodeID = [];
    this._id = 1;
    this.root = new RootNode(this);
    this.root.id = 1;
    this.FragmentNode = FragmentNode;
}
ArchTree.prototype.getNode = function (archNodeId) {
    return this._archNodeList[archNodeId];
};
ArchTree.prototype.whoIsThisNode = function (element) {
    var index = this._nodeList.indexOf(element);
    if (index !== -1) {
        return this._archNodeList[this._nodeListArchNodeID[index]];
    }
    throw new Error('must implement method to search the archNode');
};
ArchTree.prototype._linkNode = function (archNode, element, options) {
    if (options.linkNode && !archNode.__removed && archNode.id && archNode.parent && archNode.parent.id && this._nodeList.indexOf(archNode.id) === -1) {
        this._nodeList.push(element);
        this._nodeListArchNodeID.push(element);
    }
};
ArchTree.prototype._addArchNode = function (archNode) {
    var self = this;
    if (!archNode.__removed && !archNode.id && archNode.parent && archNode.parent.id) {
        archNode.id = ++this._id;
        this._archNodeList[archNode.id] = archNode;
        if (archNode.attributes) {
            archNode.attributes.add('data-archnode-id', archNode.id);
        }

        if (archNode.childNodes) {
            archNode.childNodes.forEach(function (archNode) {
                self._addArchNode(archNode);
            });
        }
    }
};
ArchTree.prototype._removeArchNode = function (archNode) {
    var self = this;
    if (this._archNodeList[archNode.id]) {
        delete this._archNodeList[archNode.id];

        var index = this._nodeListArchNodeID.indexOf(archNode.id);
        while (index !== -1) {
            this._nodeList.splice(index, 1);
            this._nodeListArchNodeID.splice(index, 1);
            index = this._nodeListArchNodeID.indexOf(archNode.id);
        }

        if (archNode.childNodes) {
            archNode.childNodes.forEach(function (archNode) {
                self._removeArchNode(archNode);
            });
        }
    }
};
*/
function ArchTree (options) {
    this.options = options;
    this._archNodeList = {};
    this._nodeList = {};
    this._id = 1;
    this.root = new RootNode(this);
    this.root.id = 1;
    this.FragmentNode = FragmentNode;

    this._startRangeID = null;
    this._startRangeOffset = null;
    this._endRangeID = null;
    this._endRangeOffset = null;
}
ArchTree.prototype.getNode = function (archNodeId) {
    return this._archNodeList[archNodeId];
};
ArchTree.prototype.whoIsThisNode = function (element) {
    for (var k in this._nodeList) {
        if (this._nodeList[k] === element) {
            return this._archNodeList[k].id;
        }
    }
    throw new Error('This dom node is not present in the arch');
};
ArchTree.prototype._createTextNode = function (archNode, text) {
    var el = this._nodeList[archNode.id];
    if (el) {
        el.textContent = text;
    } else {
        el = this._nodeList[archNode.id] = document.createTextNode(text);
    }
    return el;
};
ArchTree.prototype._createElement = function (archNode, tagName) {
    var el = this._nodeList[archNode.id];
    if (el) {
        Object.values(el.attributes).forEach(function (attribute) {
            el.removeAttribute(attribute.name);
        });
        el.innerHTML = '';
    } else {
        el = this._nodeList[archNode.id] = document.createElement(tagName);
    }
    el.textContent = '';
    return el;
};
ArchTree.prototype._addArchNode = function (archNode) {
    var self = this;
    if (!archNode.__removed && !archNode.id && archNode.parent && archNode.parent.id) {
        archNode.id = ++this._id;
        this._archNodeList[archNode.id] = archNode;
        if (archNode.attributes) {
            archNode.attributes.add('data-archnode-id', archNode.id);
        }

        if (archNode.childNodes) {
            archNode.childNodes.forEach(function (archNode) {
                self._addArchNode(archNode);
            });
        }
    }
};
ArchTree.prototype._removeArchNode = function (archNode) {
    var self = this;
    if (this._archNodeList[archNode.id]) {
        delete this._archNodeList[archNode.id];
        delete this._nodeList[archNode.id];

        if (archNode.childNodes) {
            archNode.childNodes.forEach(function (archNode) {
                self._removeArchNode(archNode);
            });
        }
    }
};

// Update arch

ArchTree.prototype.append = function (archNode) {
    if (typeof archNode === 'string') {
        archNode = this.parse(archNode);
    }
    archNode.applyRules();
    this.root.append(archNode);
    return this;
};
ArchTree.prototype.insertAfter = function (archNode, archNodeId) {
    if (typeof archNode === 'string') {
        archNode = this.parse(archNode);
    }
    archNode.applyRules();
    this.root.insertAfter(archNode, this.getNode(archNodeId));
    return this;
};
ArchTree.prototype.insertBefore = function (archNode, archNodeId) {
    if (typeof archNode === 'string') {
        archNode = this.parse(archNode);
    }
    archNode.applyRules();
    this.root.insertBefore(archNode, this.getNode(archNodeId));
    return this;
};
ArchTree.prototype.prepend = function (archNode) {
    if (typeof archNode === 'string') {
        archNode = this.parse(archNode);
    }
    archNode.applyRules();
    this.root.prepend(archNode);
    return this;
};
ArchTree.prototype.empty = function () {
    this.root.childNodes.slice().forEach(function (archNode) {
        archNode.remove();
    });
    return this;
};

// range

ArchTree.prototype.setRange = function (sc, so, ec, eo) {
    this._startRangeID = this.whoIsThisNode(sc);
    var start = this.getNode(this._startRangeID);
    this._startRangeOffset = so;

    var endRangeID = this.whoIsThisNode(ec);
    var end = this.getNode(endRangeID);
    var node = start;
    start.nextUntil(function (next) {
        node = next;
        return next.id === endRangeID;
    });
    this._endRangeID = node.id;
    if (node.id === endRangeID) {
        this._endRangeOffset = eo;
    } else if (!node.contains(end)) {
        while (node) {
            var firstChild = node.firstChild();
            if (!firstChild === node) {
                break;
            }
        }
        this._endRangeOffset = node.length();
    }
};
ArchTree.prototype.getRange = function () {
    return {
        start: {
            id: this._startRangeID,
            offset: this._startRangeOffset,
        },
        end: {
            id: this._endRangeID,
            offset: this._endRangeOffset,
        },
    };
};

// import

/**
 * @param {string} xml
 * @returns {ArchNode}
 **/
ArchTree.prototype.parse = function (html) {
    var self = this;
    var fragment = new FragmentNode(this);

    var xml = html.replace(/<((br|img|iframe)[^>/]*)>/g, '<\$1/>');
    var fragmentDOM = document.createDocumentFragment();
    var parser = new DOMParser();
    var element = parser.parseFromString("<root>" + xml + "</root>","text/xml");

    if (element.querySelector('parsererror')) {
        console.error(element);
        return;
    }

    var root = element.querySelector('root');

    root.childNodes.forEach(function (element) {
        fragment.append(self._parseElement(element));
    });
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
        archNode = new VirtualTextNode(this, element.nodeValue);
    }
    return archNode;
};
/**
 * @param {JSON} json
 * @returns {ArchNode}
 **/
ArchTree.prototype.import = function (json) {
};

// export

ArchTree.prototype.toString = function (options) {
    return this.root.toString(options || {});
};
ArchTree.prototype.toNode = function (options) {
    return this.root.toNode(options || {});
};
ArchTree.prototype.toJSON = function () {
    return this.root.toJSON();
};

return ArchTree;

});
