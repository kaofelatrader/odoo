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
            var ancestor = this.ancestor(this.isBlock);
            var archNode = this !== ancestor && this.isRightEdgeOf(ancestor) ? new customNodes['TEXT-VIRTUAL'](this.params) : archNode;
            this.params.change(archNode, archNode.length());
            this.after(archNode);
            return;
        }
        if (archNode.isText() && !archNode.isVirtual() && (!this.parent || this.parent.length() <= 1)) {
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


return customNodes;

});
