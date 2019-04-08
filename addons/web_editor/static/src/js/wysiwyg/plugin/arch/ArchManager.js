odoo.define('wysiwyg.plugin.arch.ArchManager', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
var text = require('wysiwyg.plugin.arch.text');
var customNodes = require('wysiwyg.plugin.arch.customNodes');
var fragment = require('wysiwyg.plugin.arch.fragment');


function ArchManager (options) {
    this.options = options;
    this._archNodeList = {};
    this._nodeList = {};
    this._id = 1;
    this.root = new fragment.RootNode(this);
    this.root.id = 1;
    this.FragmentNode = FragmentNode;

    this._startRangeID = null;
    this._startRangeOffset = null;
    this._endRangeID = null;
    this._endRangeOffset = null;
}
ArchManager.prototype.getNode = function (archNodeId) {
    return this._archNodeList[archNodeId];
};
ArchManager.prototype.whoIsThisNode = function (element) {
    for (var k in this._nodeList) {
        if (this._nodeList[k] === element) {
            return this._archNodeList[k].id;
        }
    }
    throw new Error('This dom node is not present in the arch');
};
ArchManager.prototype._createTextNode = function (archNode, text) {
    var el = this._nodeList[archNode.id];
    if (el) {
        el.textContent = text;
    } else {
        el = this._nodeList[archNode.id] = document.createTextNode(text);
    }
    return el;
};
ArchManager.prototype._createElement = function (archNode, tagName) {
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
ArchManager.prototype._addArchNode = function (archNode) {
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
ArchManager.prototype._removeArchNode = function (archNode) {
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

ArchManager.prototype.append = function (archNode) {
    if (typeof archNode === 'string') {
        archNode = this.parse(archNode);
    }
    archNode.applyRules();
    this.root.append(archNode);
    return this;
};
ArchManager.prototype.insertAfter = function (archNode, archNodeId) {
    if (typeof archNode === 'string') {
        archNode = this.parse(archNode);
    }
    archNode.applyRules();
    this.root.insertAfter(archNode, this.getNode(archNodeId));
    return this;
};
ArchManager.prototype.insertBefore = function (archNode, archNodeId) {
    if (typeof archNode === 'string') {
        archNode = this.parse(archNode);
    }
    archNode.applyRules();
    this.root.insertBefore(archNode, this.getNode(archNodeId));
    return this;
};
ArchManager.prototype.prepend = function (archNode) {
    if (typeof archNode === 'string') {
        archNode = this.parse(archNode);
    }
    archNode.applyRules();
    this.root.prepend(archNode);
    return this;
};
ArchManager.prototype.empty = function () {
    this.root.childNodes.slice().forEach(function (archNode) {
        archNode.remove();
    });
    return this;
};

// range

ArchManager.prototype.setRange = function (sc, so, ec, eo) {
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
ArchManager.prototype.getRange = function () {
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
ArchManager.prototype.parse = function (html) {
    var self = this;
    var fragment = new fragment.FragmentNode(this);

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
ArchManager.prototype._parseElement = function (element) {
    var self = this;
    var archNode;
    if (element.tagName) {
        var attributes = Object.values(element.attributes).map(function (attribute) {
            return [attribute.name, attribute.value];
        });
        archNode = this.constructNode(element.nodeName, attributes);
        element.childNodes.forEach(function (child) {
            archNode.append(self._parseElement(child));
        });
    } else {
        archNode = this.constructNode('TEXT', element.nodeValue);
    }
    return archNode;
};
ArchManager.prototype.constructNode = function (nodeName, param) {
    if (nodeName !== 'TEXT') {
        var Constructor = customNodes[nodeName] || ArchNode;
        return new Constructor(this, nodeName, param);
    } else {
        return new text.VisibleTextNode(this, param);
    }
};

/**
 * @param {JSON} json
 * @returns {ArchNode}
 **/
ArchManager.prototype.import = function (json) {
};

// export

ArchManager.prototype.toString = function (options) {
    return this.root.toString(options || {});
};
ArchManager.prototype.toNode = function (options) {
    return this.root.toNode(options || {});
};
ArchManager.prototype.toJSON = function () {
    return this.root.toJSON();
};

return ArchManager;

});
