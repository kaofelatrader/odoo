odoo.define('wysiwyg.plugin.arch.customNodes', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
var TextNode = require('wysiwyg.plugin.arch.text');
var VirtualText = require('wysiwyg.plugin.arch.virtualText');

function True () { return true; };
function False () { return false; };

ArchNode.include = function (argument) {
    throw new Error("Can not use include on ArchNode");
};
TextNode.include = function (argument) {
    throw new Error("Can not use include on TextNode");
};

var customNodes = {
    ArchNode: ArchNode,
    TEXT: TextNode,
    'TEXT-VIRTUAL': VirtualText,
};

customNodes.br = ArchNode.extend({
    addLine: function () {
        this.parent.addLine(this.index() + 1);
    },
    insert: function (archNode, offset) {
        if (archNode.isBR()) {
            this.params.change(archNode, archNode.length());
            this.after(archNode);
            return;
        }
        var prev = this.previousSibling();
        if (archNode.isText() && !archNode.isVirtual() &&
            (!prev || prev.isEmpty() && (!prev.isText() || prev.isVirtual()))) {
            this.params.change(archNode, archNode.length());
            this.before(archNode);
            this.remove();
            return;
        }
        this.parent.insert(archNode, this.index() + 1);
    },
    isBR: True,
    split: function () {
        return;
    },
});

// Note: this custom node can have any nodeName but
//       contains the class "fa"
// => see ArchPlugin._createArchNode
customNodes.FONTAWESOME = ArchNode.extend({
    isIcon: True,
    isInline: True,
    isMedia: True,
    isVoid: True,
    split: function () {
        return;
    },
});

return customNodes;

});
