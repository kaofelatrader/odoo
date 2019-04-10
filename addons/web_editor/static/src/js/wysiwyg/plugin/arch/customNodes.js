odoo.define('wysiwyg.plugin.arch.customNodes', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
var text = require('wysiwyg.plugin.arch.text');

function True () { return true; };
function False () { return false; };

ArchNode.include = function (argument) {
    throw new Error("Can not use include on ArchNode");
};
text.TextNode.include = function (argument) {
    throw new Error("Can not use include on TextNode");
};

var customNodes = {
    ArchNode: ArchNode,
    TEXT: text.TextNode,
    VirtualTextNode: text.VirtualTextNode,
};

customNodes.br = ArchNode.extend({
    addLine: function () {
        this.parent.addLine(this.index() + 1);
    },
    insert: function (archNode, offset) {
        if (archNode.isBR()) {
            var ancestor = this.ancestor(this.isBlock);
            var archNode = this.isRightEdgeOf(ancestor) ? new customNodes.VirtualTextNode(this.params) : archNode;
            this.after(archNode);
        }
        return this._super.apply(this, arguments);
    },
    isBr: True,
    split: function () {
        return;
    },
});


return customNodes;

});
