odoo.define('wysiwyg.plugin.arch.ArchManager', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
var text = require('wysiwyg.plugin.arch.text');
var customNodes = require('wysiwyg.plugin.arch.customNodes');
var FragmentNode = require('wysiwyg.plugin.arch.fragment');
var RootNode = require('wysiwyg.plugin.arch.root');


function ArchManager (options) {
    this.options = options;
    this._archNodeList = {};
    this._id = 1;
    this.root = new RootNode(this);
    this.root.id = 1;
    this.root.parent = null;
    this._archNodeList[1] = this.root;

    this._changes = [];

    this._startRangeID = null;
    this._startRangeOffset = null;
    this._endRangeID = null;
    this._endRangeOffset = null;
}
ArchManager.prototype = {
    getNode: function (archNodeId) {
        return this._archNodeList[archNodeId];
    },

    //--------------------------------------------------------------------------
    // Public: update
    //--------------------------------------------------------------------------

    reset: function (value) {
        this._archNodeList = {'1':  this.root};
        this._id = 1;
        this._startRangeID = null;
        this._startRangeOffset = null;
        this._endRangeID = null;
        this._endRangeOffset = null;
        this.root.childNodes = [];

        if (value) {
            this.insert(value, 1, 0);
        }
    },
    remove: function (id) {
        this._changes = [];

        if (id) {
            this.getNode(id).remove();
            return this._changes;
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

        return this._changes;
    },
    /**
     * Insert a node in the Arch.
     *
     * @param {string|DOM|FragmentDOM} DOM
     * @param {DOM} [element]
     * @param {Number} [offset]
     * @returns {Number}
     */
    insert: function (DOM, id, offset) {
        var self = this;

        var archNode = id ? this.getNode(id) : this.root;
        var fragment;
        if (typeof DOM === 'string') {
            fragment = this.parse(DOM);
        } else if (typeof DOM === 'number') {
            archNode = this.getNode(DOM);
            if (archNode !== this.root && !archNode.isFragment()) {
                fragment = new FragmentNode(this);
                fragment.append(archNode);
            } else {
                fragment = archNode;
            }
        } else {
            fragment = new FragmentNode(this);
            if (DOM.nodeType !== DOM.DOCUMENT_FRAGMENT_NODE) {
                var dom = document.createDocumentFragment();
                dom.append(DOM);
                DOM = dom;
            }
            DOM.childNodes.forEach(function (node) {
                fragment.append(self._parseElement(node));
            });
        }

        this._changes = [];

        offset = offset || 0;
        var childNodes =  fragment.childNodes.slice();
        childNodes.reverse();
        childNodes.forEach(function (child, index) {
            archNode.insert(child, offset);
        });

        return this._getChanges();
    },
    addLine: function (range) {
        this._changes = [];

        //this.remove();
        this.getNode(range.scID).addLine(range.so);

        return this._getChanges();
    },
    removeLeft: function (range) {
        if (range.isCollapsed()) {
            this.getNode(range.scID).removeLeft(range.so);
        } else {
            this.remove();
        }
    },
    removeRight: function (range) {
        if (range.isCollapsed()) {
            this.getNode(range.scID).removeRight(range.so);
        } else {
            this.remove();
        }
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

        var reVoidNodes = new RegExp('<((' + this.options.voidTags.join('|') + ')[^>/]*)>', 'g');
        var xml = html.replace(reVoidNodes, '<\$1/>');
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
    export: function (id, options) {
        var node;
        if (id) {
            node = this.getNode(id);
        } else {
            node = this.root;
        }
        return node ? node.toJSON(options) : {};
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
    toJSON: function (options) {
        return this.root.toJSON(options);
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
        if (!nodeName) {
            return new text.VirtualTextNode(this);
        } else if (nodeName !== 'TEXT') {
            var Constructor = customNodes[nodeName] || ArchNode;
            return new Constructor(this, nodeName, param || []);
        } else {
            return new text.VisibleTextNode(this, param);
        }
    },
    _addArchNode: function (archNode) {
        var self = this;
        if (!archNode.__removed && !archNode.id && archNode.parent && archNode.parent.id) {
            archNode.id = ++this._id;
            this._archNodeList[archNode.id] = archNode;
            if (archNode.childNodes) {
                archNode.childNodes.forEach(function (archNode) {
                    self._addArchNode(archNode);
                });
            }
        }
    },
    _getChanges: function () {
        var self = this;

        this._changes.forEach(function (c) {
            c.archNode.applyRules();
        });

        var changes = [];
        this._changes.forEach(function (c) {
            if (!c.archNode.id || !self.getNode(c.archNode.id)) {
                return;
            }
            var toAdd = true;
            changes.forEach(function (change) {
                if (change.id === c.archNode.id) {
                    toAdd = false;
                    change.offset = c.offset;
                }
            });
            if (toAdd) {
                changes.push({
                    id: c.archNode.id,
                    offset: c.offset,
                });
            }
        });

        return changes;
    },
    _markChange: function (archNode, offset) {
        this._changes.push({
            archNode: archNode,
            offset: offset,
        });
    },
    _removeArchNode: function (archNode) {
        var self = this;
        if (this._archNodeList[archNode.id]) {
            delete this._archNodeList[archNode.id];

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
