odoo.define('wysiwyg.plugin.arch_tree', function (require) {
'use strict';

var $ = require('web_editor.jquery');
var _ = require('web_editor._');

function ArchNode (tree, id, nodeName, attributes, nodeValue) {
    this.tree = tree;
    this.id = id;
    this.nodeName = nodeName;
    this.attributes = attributes || {};
    this.childNodes = [];
    this.nodeValue = nodeValue || '';
    this.startRange = null;
    this.endRange = null;
}

// Update arch

ArchNode.prototype.append = function (archNode) {
    archNode.parent = this;
    this.childNodes.push(archNode);
};
ArchNode.prototype.insertAfter = function (archNode, archNodeId) {
    archNode.parent = this;
    var archNodeRef = this.tree.getArchNode(archNodeId);
    var index = this.childNodes.indexOf(archNodeRef);
    this.childNodes.splice(index + 1, 0, archNode);
};
ArchNode.prototype.insertBefore = function (archNode, archNodeId) {
    archNode.parent = this;
    var archNodeRef = this.tree.getArchNode(archNodeId);
    var index = this.childNodes.indexOf(archNodeRef);
    this.childNodes.splice(index, 0, archNode);
};
ArchNode.prototype.prepend = function (archNode) {
    archNode.parent = this;
    this.childNodes.unshift(archNode);
};


ArchNode.prototype.render = function () {
};
ArchNode.prototype.toJSON = function () {
    return {
        id: this.id,
        nodeName: this.nodeName,
        nodeValue: this.nodeValue,
        attributes: this.attributes,
        childNodes: this.childNodes.map(function (archNode) {
            return archNode.toJSON();
        }),
    };
};

//////////////////////////////////////////////////////////////

function ArchTree () {
    this.id = 0;
    this.root = new ArchNode(this, ++this.id, null, {}, '');
}
ArchTree.prototype.getArchNode = function (archNodeId) {
};
ArchTree.prototype.newArchNode = function (nodeName, attributes, nodeValue) {
    new ArchNode(this, ++this.id, nodeName, attributes, nodeValue);
    return this.id;
};


ArchTree.prototype.append = function (archNode) {
    this.root.append(archNode);
};
ArchTree.prototype.insertAfter = function (archNode, archNodeId) {
    this.root.insertAfter(archNode, archNodeId);
};
ArchTree.prototype.insertBefore = function (archNode, archNodeId) {
    this.root.insertBefore(archNode, archNodeId);
};
ArchTree.prototype.prepend = function (archNode) {
    this.root.prepend(archNode);
};

ArchTree.prototype.render = function (archNodeId) {
    var archNode = archNodeId ? this.getArchNode(archNodeId) : this.root;
    return archNode.render();
};
ArchTree.prototype.toJSON = function (archNodeId) {
    var archNode = archNodeId ? this.getArchNode(archNodeId) : this.root;
    return archNode.toJSON();
};


});
