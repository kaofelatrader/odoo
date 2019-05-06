odoo.define('wysiwyg.plugin.arch.node', function (require) {
'use strict';

var Class = require('web.Class');

var regMultiSpace = /\s\s+/;

function ClassName (classNames) {
    this.value = classNames.replace(regMultiSpace, ' ').split(' ');
}
ClassName.prototype = {
    add: function (classNames) {
        classNames.replace(regMultiSpace, ' ').split(' ').forEach(function (className) {
            var index = this.value.indexOf(className);
            if (index === -1) {
                this.value.push(className);
            }
        });
    },
    contains: function (className) {
        return this.value.indexOf(className) !== -1;
    },
    isEqual: function (obj, options) {
        if (!obj) {
            return !this.value.length;
        }
        var self = this;
        var isEqual = true;
        this.value.concat(obj.value).forEach(function (className) {
            if (!isEqual || options && options.blackListClassNames && options.blackListClassNames.indexOf(className) !== -1) {
                return;
            }
            if (self.value.indexOf(className) === -1 || obj.value.indexOf(className) === -1) {
                isEqual = false;
            }
        });
        return isEqual;
    },
    remove: function (classNames) {
        classNames.replace(regMultiSpace, ' ').split(' ').forEach(function (className) {
            var index = this.value.indexOf(className);
            if (index !== -1) {
                this.value.splice(index, 1);
            }
        });
    },
    toString: function () {
        return this.value.sort().join(' ');
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
    });
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
    clear: function () {
        var self = this;
        this.__order__.forEach(function (name) {
            delete self[name];
        });
        this.__order__ = [];
    },
    isEqual: function (obj, options) {
        if (!obj) {
            return !this.__order__.length;
        }
        var self = this;
        var isEqual = true;
        var list = Object.keys(this);
        Object.keys(obj).forEach(function (name) {
            if (list.indexOf(name) === -1) {
                list.push(name);
            }
        });
        list.forEach(function (name) {
            if (!name.indexOf('_') || !isEqual || options && options.blackList && options.blackList.indexOf(name) !== -1) {
                return;
            }
            if (name === 'class') {
                isEqual = self[name].isEqual(obj[name], options);
            } else if (self[name] instanceof Array && obj[name] instanceof Array) {
                isEqual = self[name].every(function (item, index) {
                    return obj[name][index] && item === obj[name][index];
                });
            } else if (self[name] !== obj[name]) {
                isEqual = false;
            }
        });
        return isEqual;
    },
    forEach: function (fn) {
        this.__order__.forEach(fn.bind(this));
    },
    remove: function (name) {
        var index = this.__order__.indexOf(name);
        if (index !== -1) {
            this.__order__.splice(index, 1);
        }
        delete this[name];
    },
    toJSON: function () {
        var self = this;
        var attributes = [];
        this.__order__.forEach(function (name) {
            var value = self[name].toString();
            if (value.length) {
                attributes.push([name, value]);
            }
        });
        return attributes;
    },
    toString: function () {
        var self = this;
        var string = '';
        this.__order__.forEach(function (name) {
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

return Class.extend({
    init: function (params, nodeName, attributes) {
        this.params = params;
        this.nodeName = nodeName.toLowerCase();
        this.attributes = new Attributes(attributes);
        if (!this.attributes.class) {
            this.attributes.add('class', '');
        }
        this.className = this.attributes.class;
        this.childNodes = [];

        this.params.change(this, this.length());
    },

    //--------------------------------------------------------------------------
    // Public: Export
    //--------------------------------------------------------------------------

    toJSON: function (options) {
        var data = {};
        if (this.id) {
            data.id = this.id;
        }

        if (this.childNodes) {
            var childNodes = [];
            this.childNodes.forEach(function (archNode) {
                var json = archNode.toJSON(options);
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
        }

        if (this.isVirtual()) {
            data.isVirtual = true;
            if (!options || !options.keepVirtual) {
                return data;
            }
        }

        if (this.nodeName) {
            data.nodeName = this.nodeName;
        }
        if (this.nodeValue) {
            data.nodeValue = this.nodeValue;
        }
        if (this.attributes) {
            var attributes = this.attributes.toJSON();
            if (attributes.length) {
                data.attributes = attributes;
            }
        }

        return data;
    },
    toString: function (options) {
        options = options || {};
        var string = '';

        if (!this.isVirtual() || options.keepVirtual) {
            string += '<' + this.nodeName;
            var attributes = this.attributes.toString(options);
            if (attributes.length) {
                string += ' ';
                string += attributes;
            }
            if (options.showIDs) {
                string += ' archID="' + this.id + '"';
            }
            if (this.isVoid() && !this.childNodes.length) {
                string += '/';
            }
            string += '>';
        }
        var i = 0;
        while (i < this.childNodes.length) {
            string += this.childNodes[i].toString(options);
            i++;
        }
        if ((!this.isVirtual() || options.keepVirtual) && (!this.isVoid() || this.childNodes.length)) {
            string += '</' + this.nodeName + '>';
        }
        return string;
    },

    //--------------------------------------------------------------------------
    // Public: Update (to check if private ?)
    //--------------------------------------------------------------------------

    /**
     * Insert a(n) (list of) archNode(s) after the current archNode
     *
     * @param {ArchNode|ArchNode []} archNode
     */
    after: function (archNode) {
        if (Array.isArray(archNode)) {
            return archNode.slice().forEach(this.after.bind(this));
        }
        return this.parent.insertAfter(archNode, this);
    },
    /**
     * Insert a(n) (list of) archNode(s) before the current archNode
     *
     * @param {ArchNode|ArchNode []} archNode
     */
    before: function (archNode) {
        if (Array.isArray(archNode)) {
            return archNode.slice().forEach(this.before.bind(this));
        }
        return this.parent.insertBefore(archNode, this);
    },
    /**
     * Insert a(n) (list of) archNode(s) at the end of the current archNode's children
     *
     * @param {ArchNode|ArchNode []} archNode
     */
    append: function (archNode) {
        if (Array.isArray(archNode)) {
            return archNode.slice().forEach(this.append.bind(this));
        }
        return this._changeParent(archNode, this.childNodes.length);
    },
    deleteEdge: function (isLeft) {
        var node = this;
        var edges = [];
        while (node && !node.isRoot()) {
            edges.push(node);
            if (!node.parent || !node[isLeft ? 'isLeftEdgeOf' : 'isRightEdgeOf'](node.parent)) {
                break;
            }
            node = node.parent;
        }
        edges.reverse().slice().forEach(function (node) {
            var next = node[isLeft ? 'previousSibling' : 'nextSibling']();
            if (!next) {
                return;
            }
            if (node._isMergeableWith(next)) {
                node.childNodes.slice().forEach(function (node) {
                    next[isLeft ? 'append' : 'prepend'](node);
                });
                node.remove();
            }
        });
    },
    _isMergeableWith: function (node) {
        var haveSameNodeNames = this.nodeName === node.nodeName;
        var haveSameAttributes = this.attributes.isEqual(node.attributes);
        var haveSameClasses = this.className.isEqual(node.className);
        return haveSameNodeNames && haveSameAttributes && haveSameClasses;
    },
    insertAfter: function (archNode, ref) {
        return this._changeParent(archNode, ref.index() + 1);
    },
    insertBefore: function (archNode, ref) {
        return this._changeParent(archNode, ref.index());
    },
    mergeWithNext: function (options) {
        var self = this;
        var next = this.nextSibling();
        if (!next) {
            return;
        }
        if (this.nodeName !== next.nodeName || this.attributes && !this.attributes.isEqual(next.attributes, options)) {
            return;
        }
        while (next.childNodes && next.childNodes.length) {
            self.append(next.childNodes[0]);
        }
        next.remove();
        return true;
    },
    /**
     * Insert a(n) (list of) archNode(s) at the beginning of the current archNode's children
     *
     * @param {ArchNode|ArchNode []} archNode
     */
    prepend: function (archNode) {
        if (Array.isArray(archNode)) {
            return archNode.slice().forEach(this.prepend.bind(this));
        }
        return this._changeParent(archNode, 0);
    },
    empty: function () {
        if (!this.isEditable()) {
            console.warn("cannot empty a non editable node");
            return;
        }
        this.childNodes.slice().forEach(function (archNode) {
            archNode.remove();
        });
        this.params.change(this, 0);
    },
    remove: function () {
        if (this.parent) {
            if (!this.parent.isEditable()) {
                console.warn("cannot remove a node in a non editable node");
                return;
            }
            var offset = this.index();
            this.parent.childNodes.splice(offset, 1);
            this.params.change(this.parent, offset);
        }
        this.params.remove(this);
        this.parent = null;
        this.__removed = true;
    },
    removeLeft: function (offset) {
        if (!this.childNodes.length) {
            return this.remove();
        }
        return this.childNodes[offset - 1].removeLeft(this.childNodes[offset - 1].length());
    },
    removeRight: function (offset) {
        if (!this.childNodes.length) {
            return this.remove();
        }
        return this.childNodes[offset].removeRight(0);
    },
    split: function (offset) {
        if (this.isUnbreakable()) {
            console.warn("cannot split an unbreakable node");
            return;
        }
        if (!this.isEditable()) {
            console.warn("cannot split a non editable node");
            return;
        }

        var Constructor = this.constructor;
        var archNode = new Constructor(this.params, this.nodeName, this.attributes ? this.attributes.toJSON() : []);
        this.params.change(archNode, 0);

        if (this.childNodes) {
            var childNodes = this.childNodes.slice(offset);
            while (childNodes.length) {
                archNode.prepend(childNodes.pop());            
            }
        }

        this.after(archNode);
        return archNode;
    },
    splitUntil: function (ancestor, offset) {
        if (this === ancestor || this.isUnbreakable()) {
            return this;
        }
        var right = this.split(offset);
        return right.parent.splitUntil(ancestor, right.index());
    },

    //--------------------------------------------------------------------------
    // Public: Update
    //--------------------------------------------------------------------------

    insert: function (archNode, offset) {
        if (!this.isEditable()) {
            console.warn("can not split a not editable node");
            return;
        }
        if (this.isVoid()) {
            this.parent.insert(archNode, this.index());
            return;
        }
        this.params.change(archNode, archNode.length());
        var ref = this.childNodes[offset];
        if (ref) {
            this.insertBefore(archNode, ref);
        } else {
            this.append(archNode);
        }
    },
    addLine: function (offset) {
        if (!this.ancestor(this._isPara)) {
            return;
        }

        if (!this.isEditable()) {
            console.warn("can not split a not editable node");
            return;
        }

        var child = this.childNodes[offset];
        var isChildRightEdgeVirtual = child && child.isRightEdge() && child.isVirtual();
        if (isChildRightEdgeVirtual && !this.isUnbreakable() && (this.isFormatNode() || this._isPara())) {
            var virtual = this.childNodes[offset];
            this.after(virtual);
            if (this.isEmpty()) {
                this.append(this.params.create());
            }
            return virtual.parent.addLine(virtual.index());
        }
        var next = this.split(offset);
        if (!next) {
            this.insert(this.params.create('br'), offset);
            return ;
        }

        return this.parent.addLine(next.index());
    },

    //--------------------------------------------------------------------------
    // Public: Browse
    //--------------------------------------------------------------------------

    childNodesIDs: function () {
        var ids = [];
        if (this.childNodes) {
            this.childNodes.forEach(function (node) {
                ids.push(node.id);
            });
        }
        return ids;
    },
    firstChild: function () {
        return this.childNodes && this.childNodes.length ? this.childNodes[0] : null;
    },
    index: function (options) {
        return this.parent.childNodes.indexOf(this);
    },
    lastChild: function () {
        return this.childNodes && this.childNodes.length ? this.childNodes[this.childNodes.length - 1] : null;
    },
    nextSibling: function (fn) {
        var next = this.parent.childNodes[this.index() + 1];
        return next && next._nextSibling(fn);
    },
    previousSibling: function (fn) {
        var prev = this.parent.childNodes[this.index() - 1];
        return prev && prev._previousSibling(fn);
    },
    /**
     * Return a list of child nodes that are not architectural space.
     */
    visibleChildren: function () {
        if (!this.childNodes) {
            return;
        }
        var visibleChildren = [];
        this.childNodes.forEach(function (child) {
            if (!child.isArchitecturalSpace()) {
                visibleChildren.push(child);
            }
        });
        return visibleChildren;
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
    commonAncestor: function (otherArchNode) {
        var ancestors = this.listAncestor();
        for (var n = otherArchNode; n; n = n.parent) {
            if (ancestors.indexOf(n) > -1) {
                return n;
            }
        }
        return null; // difference document area
    },
    listAncestor: function (pred) {
        var ancestors = [];
        this.ancestor(function (el) {
            if (!el.isContentEditable()) {
                ancestors.push(el);
            }
            return pred ? pred(el) : false;
        });
        return ancestors;
    },
    next: function () {
        return this._prevNextUntil(false);
    },
    /**
     * @param {function} fn called on this and get the next point as param
     *          return true if the next node is available
     * @returns {ArchNode}
     **/
    nextUntil: function (fn) {
        return this._prevNextUntil(false, fn);
    },
    prev: function () {
        return this._prevNextUntil(true);
    },
    prevUntil: function (fn) {
        return this._prevNextUntil(true, fn);
    },
    length: function () {
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

    _changeParent: function (archNode, index) {
        if (this.isVoid()) {
            throw new Error("You can't add a node into a void node");
        }

        if (!this.childNodes) {
            throw new Error("You can't add a child into this node");
        }

        if (!this.isEditable()) { // id is setted only if the node is contains in the root
            console.warn("cannot add a node into a non editable node");
            return;
        }
        if (archNode.parent && !archNode.parent.isEditable()) {
            console.warn("cannot remove a node from a non editable node");
            return;
        }

        if (this.ancestor(function (node) { return node === archNode;})) {
            console.warn("cannot add a node into itself");
            return;
        }

        if (archNode.isFragment()) {
            var ids = [];
            archNode.childNodes.slice().forEach(function (archNode) {
                ids = ids.concat(self._changeParent(archNode, index++));
            });
            archNode.remove();
            return ids;
        }

        if (archNode.parent) {
            var i = archNode.parent.childNodes.indexOf(archNode);
            this.params.change(archNode.parent, i);
            archNode.parent.childNodes.splice(i, 1);
        }

        archNode.parent = this;
        this.childNodes.splice(index, 0, archNode);
        if (archNode.__removed) {
            this.params.change(archNode, 0);
            archNode.__removed = false;
        }

        this.params.add(archNode);

        this.params.change(this, index);
    },
    _nextSibling: function (fn) {
        if (this.isEditable() && (!fn || fn(this))) {
            return this;
        } else {
            return this.nextSibling(fn);
        }
    },
    _previousSibling: function (fn) {
        if (this.isEditable() && (!fn || fn(this))) {
            return this;
        } else {
            return this.previousSibling(fn);
        }
    },
    /**
     * Return the next or previous node until predicate hit or end of tree,
     * following a pre-order tree traversal.
     * This ignores architectural space and prevents getting out of an unbreakable node.
     * If no suitable previous/next node is found, a virtual text node will be inserted and
     * returned. If the insertion is not allowed, the last found legal node is returned.
     * If no predicate function is provided, just give the previous/next node.
     *
     * @param {boolean} isPrev true to get the previous node, false for the next node
     * @param {function (ArchNode)} [pred] called on this and takes the previous/next node as argument
     *          return true if the requested node was found
     * @returns {ArchNode}
     **/
    _prevNextUntil: function (isPrev, pred) {
        var next = this._walk(isPrev);
        if (!next || next.isUnbreakable()) {
            if (this.isEditable() && !this.isRoot()) {
                var virtualText = this.params.create();
                this[isPrev ? 'before' : 'after'](virtualText);
                return virtualText;
            }
            return this;
        }
        if (next.isArchitecturalSpace()) {
            return next._prevNextUntil(isPrev, pred);
        }
        if (!pred || pred.call(this, next)) {
            return next;
        }
        return next._prevNextUntil(isPrev, pred);
    },
    /**
     * Return the next or previous node (if any), following a pre-order tree traversal.
     * Return null if no node was found.
     * If a function is provided, apply it to the node that was found, if any.
     *
     * @param {Boolean} isPrev true to get the previous node, false for the next node
     * @param {Function (ArchNode)} [fn] called on this and takes the previous/next node as argument
     */
    _walk: function (isPrev, fn) {
        var next = this[isPrev ? '_walkPrev' : '_walkNext']();
        if (next && fn) {
            fn.call(this, next);
        }
        return next;
    },
    /**
     * Return the next node (if any), following a pre-order tree traversal.
     * Return null if no node was found.
     *
     * @returns {ArchNode|null}
     */
    _walkNext: function () {
        if (this.childNodes && this.childNodes.length) {
            return this.firstChild();
        }
        var next = this;
        while (next.parent) {
            var parent = next.parent;
            var index = next.index();
            if (parent && parent.childNodes.length > index + 1) {
                return parent.childNodes[index + 1];
            }
            next = parent;
        }
        return null;
    },
    /**
     * Return the previous node (if any), following a pre-order tree traversal.
     * Return null if no node was found.
     *
     * @returns {ArchNode|null}
     */
    _walkPrev: function () {
        var prev = this;
        if (prev.parent) {
            var parent = prev.parent;
            var index = prev.index();
            if (parent && index - 1 >= 0) {
                prev = parent.childNodes[index - 1];
                while (prev.childNodes && prev.childNodes.length) {
                    prev = prev.lastChild();
                }
                return prev;
            }
            return parent;
        }
        return null;
    },
});

});
