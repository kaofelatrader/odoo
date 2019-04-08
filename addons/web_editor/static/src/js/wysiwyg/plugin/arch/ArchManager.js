odoo.define('wysiwyg.plugin.arch.ArchManager', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
var text = require('wysiwyg.plugin.arch.text');
var customNodes = require('wysiwyg.plugin.arch.customNodes');
var FragmentNode = require('wysiwyg.plugin.arch.fragment');
var RootNode = require('wysiwyg.plugin.arch.root');


function ArchManager (options) {
    this.options = options;
    this.editable = options.editable;
    this._archNodeList = {};
    this._nodeList = {};
    this._id = 1;
    this.root = new RootNode(this);
    this.root.id = 1;
    this.root.parent = null;
    this._archNodeList[1] = this.root;
    this._nodeList[1] = this.editable;

    this._startRangeID = null;
    this._startRangeOffset = null;
    this._endRangeID = null;
    this._endRangeOffset = null;
}
ArchManager.prototype = {
    getNode: function (archNodeId) {
        return this._archNodeList[archNodeId];
    },
    whoIsThisNode: function (element) {
        if (element.tagName === 'EDITABLE') {
            return this.root.id;
        }
        for (var k in this._nodeList) {
            if (this._nodeList[k] === element) {
                return this._archNodeList[k].id;
            }
        }
    },

    //--------------------------------------------------------------------------
    // Public: update
    //--------------------------------------------------------------------------

    reset: function () {
        this._archNodeList = {'1':  this.root};
        this._nodeList = {'1': this.editable};
        this._id = 1;
        this._startRangeID = null;
        this._startRangeOffset = null;
        this._endRangeID = null;
        this._endRangeOffset = null;
        this.root.childNodes = [];
        return this;
    },
    remove: function (element) {
        if (element) {
            var id = this.whoIsThisNode(element);
            return this.getNode(id).remove();
        }

        var range = this.getRange();
        var fromNode = this.getNode(range.start.id);
        // ==> split: range.start.offset

        var toNode = this.getNode(range.end.id, toOffset);
        // ==> split: range.end.offset

        fromNode.nextUntil(function (next) {
            this.remove();
            if (next === toNode) {
                next.remove();
                return true;
            }
        });

        // todo: rerange
    },
    /**
     * Insert a node in the Arch.
     *
     * @param {string|DOM|FragmentDOM} DOM
     * @param {DOM} [element]
     * @param {Number} [offset]
     * @returns {Number}
     */
    insert: function (DOM, element, offset) {
        var self = this;
        var id = element ? this.whoIsThisNode(element) : this.getRange().start.id;
        var archNode = id ? this.getNode(id) : this.root;
        var fragment;
        if (typeof DOM === 'string') {
            fragment = this.parse(DOM);
        } else if (this.whoIsThisNode(DOM)) {
            var archNode = this.getNode(this.whoIsThisNode(DOM));
            if (archNode !== this.root && !archNode.isFragment()) {
                fragment = new FragmentNode(this);
                fragment.append(archNode);
            } else {
                fragment = archNode;
            }
        } else {
            var fragment = new FragmentNode(this);
            if (DOM.nodeType !== DOM.DOCUMENT_FRAGMENT_NODE) {
                var dom = document.createDocumentFragment();
                dom.append(DOM);
                DOM = dom;
            }
            DOM.childNodes.forEach(function (node) {
                fragment.append(self._parseElement(node));
            });
        }
        return archNode.insert(fragment, offset || 0);
    },
    addLine: function () {
        this.remove();
        var range = this.getRange();
        this.getNode(range.start.id).addLine(range.start.offset);
    },
    removeLeft: function () {
        var range = this.getRange();
        if (range.isCollapsed()) {
            this.getNode(range.start.id).removeLeft(range.start.offset);
        } else {
            this.remove();
        }
    },
    removeRight: function () {
        var range = this.getRange();
        if (range.isCollapsed()) {
            this.getNode(range.start.id).removeRight(range.start.offset);
        } else {
            this.remove();
        }
    },

    //--------------------------------------------------------------------------
    // Public: range
    //--------------------------------------------------------------------------

    setRange: function (sc, so, ec, eo) {
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
    },
    getRange: function () {
        return {
            start: {
                id: this._startRangeID,
                offset: this._startRangeOffset,
            },
            end: {
                id: this._endRangeID,
                offset: this._endRangeOffset,
            },
            isCollapsed: function () {
                return this.start.id === this.end.id && this.start.offset === this.end.offset;
            },
        };
    },

    //--------------------------------------------------------------------------
    // Public: import
    //--------------------------------------------------------------------------

    /**
     * @param {string} xml
     * @returns {ArchNode}
     **/
    parse: function (html) {
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
    },
    /**
     * @param {JSON} json
     * @returns {ArchNode}
     **/
    import: function (json) {
        var self = this;
        var fragment = new FragmentNode(this);
        if (!json.childNodes || json.nodeValue || json.nodeName) {
            json = {
                childNodes: [json],
            };
        }
        json.childNodes.forEach(function (json) {
            fragment.append(self._importJSON(json));
        });
        return fragment;
    },

    //--------------------------------------------------------------------------
    // Public: export
    //--------------------------------------------------------------------------

    toString: function (options) {
        return this.root.toString(options || {});
    },
    toNode: function (options) {
        return this.root.toNode(options || {});
    },
    toJSON: function () {
        return this.root.toJSON();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _parseElement: function (element) {
        var self = this;
        var archNode;
        if (element.tagName) {
            var attributes = Object.values(element.attributes).map(function (attribute) {
                return [attribute.name, attribute.value];
            });
            archNode = this._constructNode(element.nodeName, attributes);
            element.childNodes.forEach(function (child) {
                archNode.append(self._parseElement(child));
            });
        } else {
            archNode = this._constructNode('TEXT', element.nodeValue);
        }
        return archNode;
    },
    _importJSON: function (json) {
        var self = this;
        var archNode;
        if (json.nodeName) {
            archNode = this._constructNode(json.nodeName, json.attributes);
            json.childNodes.forEach(function (json) {
                archNode.append(self._importJSON(json));
            });
        } else {
            archNode = this._constructNode('TEXT', json.nodeValue);
        }
        return archNode;
    },

    //--------------------------------------------------------------------------
    // Internal (called by ArchNode)
    //--------------------------------------------------------------------------

    _constructNode: function (nodeName, param) {
        if (nodeName !== 'TEXT') {
            var Constructor = customNodes[nodeName] || ArchNode;
            return new Constructor(this, nodeName, param);
        } else {
            return new text.VisibleTextNode(this, param);
        }
    },
    _createTextNode: function (archNode) {
        var el = this._nodeList[archNode.id];
        if (!el) {
            el = this._nodeList[archNode.id] = document.createTextNode('');
        }
        return el;
    },
    _createElement: function (archNode, tagName) {
        var el = this._nodeList[archNode.id];
        if (!el) {
            el = this._nodeList[archNode.id] = document.createElement(tagName);
        }
        return el;
    },
    _addArchNode: function (archNode) {
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
    },
    _generateVirtualNode: function (archNode, insertMethod, fn) {
        var virtualTextNode = new text.VirtualTextNode(this.tree);
        virtualTextNode.parent = archNode;
        insertMethod(virtualTextNode);
        if (!virtualTextNode.isEditable() || (fn && !fn.call(this, virtualTextNode))) {
            virtualTextNode.remove();
            return;
        }
        return virtualTextNode;
    },
    _removeArchNode: function (archNode) {
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
    },
};

return ArchManager;

});
