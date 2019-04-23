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
    remove: function (classNames) {
        classNames.replace(regMultiSpace, ' ').split(' ').forEach(function (className) {
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
    toString: function (options) {
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
    // Public: Update (to check if private ?)
    //--------------------------------------------------------------------------

    /**
     * Insert a(n) (list of) archNode(s) after the current archNode
     *
     * @param {ArchNode|ArchNode []} archNode
     */
    after: function (archNode) {
        if (Array.isArray(archNode)) {
            return archNode.reverse().forEach(this.after.bind(this));
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
            return archNode.reverse().forEach(this.before.bind(this));
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
            return archNode.reverse().forEach(this.append.bind(this));
        }
        return this._changeParent(archNode, this.childNodes.length);
    },
    deleteEdge: function (isLeft) {
        var next = this[isLeft ? 'previousSibling' : 'nextSibling']();
        if (!next) {
            return;
        }
        if (this.nodeName === next.nodeName) {
            this.childNodes.forEach(function (node) {
                next[isLeft ? 'append' : 'prepend'](node);
            });
            this.remove();
        }
    },
    insertAfter: function (archNode, ref) {
        return this._changeParent(archNode, ref.index() + 1);
    },
    insertBefore: function (archNode, ref) {
        return this._changeParent(archNode, ref.index());
    },
    mergeWithNext: function () {
        var self = this;
        var next = this.nextSibling();
        if (!next) {
            return;
        }
        while (next.childNodes && next.childNodes.length) {
            self.append(next.childNodes[0]);
        }
        next.remove();
    },
    /**
     * Insert a(n) (list of) archNode(s) at the beginning of the current archNode's children
     *
     * @param {ArchNode|ArchNode []} archNode
     */
    prepend: function (archNode) {
        if (Array.isArray(archNode)) {
            return archNode.reverse().forEach(this.prepend.bind(this));
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
        this.empty();
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

    firstChild: function () {
        return this.childNodes && this.childNodes.length ? this.childNodes[0] : null;
    },
    index: function () {
        return this.parent.childNodes.indexOf(this);
    },
    lastChild: function () {
        return this.childNodes && this.childNodes.length ? this.childNodes[this.childNodes.length - 1] : null;
    },
    nextSibling: function (fn) {
        if (this.isContentEditable()) {
            return;
        }
        for (var k = this.index() + 1; k < this.parent.childNodes.length; k++) {
            if (!fn || fn(this.parent.childNodes[k])) {
                return this.parent.childNodes[k];
            }
        }
    },
    previousSibling: function (fn) {
        if (this.isContentEditable()) {
            return;
        }
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
        if (this.__removed) {
            this.params.change(archNode, 0);
            this.__removed = false;
        }

        this.params.add(archNode);

        this.params.change(this, index);
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
     * @param {boolean} isPrev true to get the previous node, false for the next node
     * @param {function} [fn] called on this and get the next point as param
     *          return true if the next node is available
     * @param {boolean} __closestUnbreakable: internal flag
     * @param {boolean} __goUp: internal flag
     * @returns {ArchNode}
     **/
    _prevNextUntil: function (isPrev, fn, __closestUnbreakable, __goUp) {
        if (!__closestUnbreakable) {
            __closestUnbreakable = this.ancestor(this.isUnbreakable);
        }
        var next;
        if (!__goUp && !this.isUnbreakable()) {
            var deeper = isPrev ? this.lastChild() : this.firstChild();
            if (deeper !== this) {
                next = deeper;
            }
        }
        __goUp = false;
        if (!next) {
            var index = this.index();
            index += isPrev ? -1 : 1;
            next = this.parent.childNodes[index];
        }
        if (!next) {
            __goUp = true;
            next = this.parent[isPrev ? 'previousSibling' : 'nextSibling']();
            if (next) {
                next = next[isPrev ? 'lastChild' : 'firstChild']();
            }
        }
        if (!next || !__closestUnbreakable.contains(next)) {
            var insertMethod = __closestUnbreakable[this.lastChild() ? 'prepend' : 'append'].bind(__closestUnbreakable);
            var virtualTextNode = this.params.create();
            insertMethod(virtualTextNode);
            if (!virtualTextNode.isEditable() || (fn && !fn.call(this, virtualTextNode))) {
                virtualTextNode.remove();
                return;
            }
            return virtualTextNode;
        }
        if (fn && !fn.call(this, next)) {
            return next._prevNextUntil(isPrev, fn, __closestUnbreakable, __goUp);
        }
        return next;
    },
});

});
