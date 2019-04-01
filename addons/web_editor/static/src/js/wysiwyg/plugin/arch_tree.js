odoo.define('wysiwyg.plugin.arch_tree', function (require) {
'use strict';

var $ = require('web_editor.jquery');
var _ = require('web_editor._');
var Class = require('web.Class');

var ArchNode = Class.extend({
    init: function (tree, nodeName, attributes) {
        this.tree = tree;
        this.nodeName = nodeName.toLowerCase();
        this.attributes = attributes;
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
        this.id = null;
        this.parent.childNodes.splice(this.index(), 1);
        this.tree._removeArchNode(this);
        this.childNodes.forEach(function (archNode) {
            archNode.remove();
        });
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
    prev: function (fn) {
        return this._prevNext('prev', fn);
    },

    // export

    /**
     * @returns {Document-fragment}
     **/
    toNode: function (options) {
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

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

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
        var node = this.nodeName ? document.createElement(this.nodeName) : document.createTextNode(this.nodeValue);
        this.attributes.forEach(function (attribute) {
            node.setAttribute(attribute[0], attribute[1]);
        });
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

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _toNode: function (options) {
        var node = document.createTextNode(this.nodeValue);
        this.tree._linkElement(this, node);
        return node;
    },
});

//////////////////////////////////////////////////////////////

var ArchitecturalSpaceNode = TextNode.extend({
    toJSON: function () {
        return {
            id: this.id,
        };
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _toNode: function (options) {
        var keepArchitecturalSpaces = options && options.keepArchitecturalSpaces;
        var node = document.createTextNode(keepArchitecturalSpaces ? this.nodeValue : '');
        this.tree._linkElement(this, node);
        return node;
    },
});

//////////////////////////////////////////////////////////////

var FragmentNode = ArchNode.extend({
    init: function () {
        this.tree = tree;
        this.childNodes = [];
    },
    toNode: function (options) {
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
    this._addArchNode(this.root);
}
ArchTree.prototype.getArchNode = function (archNodeId) {
    return this.nodeList[archNodeId];
};
ArchTree.prototype.whoIsThisNode = function (element) {
    for (var k in this._nodeElementList) {
        if (this._nodeElementList[k] === element) {
            return this.nodeList[k];
        }
    }
    throw new Error('must implement method to search the archNode');
};
ArchTree.prototype._linkElement = function (archNode, element) {
    this.nodeElementList[archNode.id] = element;
};
ArchTree.prototype._addArchNode = function (archNode) {
    archNode.id = ++this._id;
    this.nodeList[archNode.id] = archNode;
};
ArchTree.prototype._removeArchNode = function (archNodeId) {
    delete this.nodeValue[archNode.id];
    delete this.nodeElementList[archNode.id];
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
    var root = parser.parseFromString("<root>" + text + "</root>","text/xml").querySelector('root');
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
    if (element.nodeName) {
        var attributes = Object.values(a).map(function (attribute) {
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
    var deepest = [];
    var stack = archNode.childNodes.slice();
    var item;
    while (item = stack.pop()) {
        if (!item.childNodes || !item.childNodes.length) {
            deepest.push(item);
        } else {
            stack = stack.concat(item.childNodes);
        }
    }

    var structureRules = this.options.structure;
    while (item = deepest.pop()) {
        var parentedRule = [];
        for (var k = 0; k < structureRules.length; k++) {
            var children = structureRules[k][1];
            for (var i = 0; i < children.length; i++) {
                var check = children[i];
                if (    (typeof check === 'function' && check(item)) || 
                        (check === 'TEXT' && item instanceof TextNode) ||
                        item.nodeName === check) {
                    parentedRule = parentedRule.concat(structureRules[k][0]);
                    break;
                }
            }
        }
        
        if (parentedRule.indexOf(item.parent.nodeName) !== -1) {
            continue;
        }

        // create parent

        var newParent = new ArchNode(this, parentedRule[0], {});
        item.parent.insertBefore(newParent, item);
        newParent.append(item);
        stack.push(newParent);
    }
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
