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
};

customNodes.br = ArchNode.extend({
    insert: function (archNode, offset) {
        if (archNode.isBr()) {
            var ancestor = this.ancestor(this.isBlock);
            var archNode = this.isRightEdgeOf(ancestor) ? new VirtualTextNode(this.tree) : archNode;
            this.after(archNode);
        }
        return this._super.apply(this, arguments);
    },
    addLine: function () {
        this.parent.addLine(this.index() + 1);
    },
    split: function () {
        return;
    },
    isBr: True,
});


return customNodes;

});
