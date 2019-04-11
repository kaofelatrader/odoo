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
            this.params.change(archNode, archNode.length());
            this.after(archNode);
            return;
        }
        if (archNode.isText()) {
            this.params.change(archNode, archNode.length());
            this.before(archNode);
            this.remove();
            return;
        }
        this.parent.insert(archNode, this.index() + 1);
    },
    isBr: True,
    split: function () {
        return;
    },
});


return customNodes;

});
