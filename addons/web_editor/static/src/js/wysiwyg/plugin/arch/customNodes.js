odoo.define('wysiwyg.plugin.arch.customNodes', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');

var customNodes = {};

customNodes.br = ArchNode.extend({
    insert: function (offset, fragment) {
        if (fragment.childNodes.length === 1 && fragment.firstChild().nodeName === 'br') {
            var ancestor = this.ancestor(this.isBlock);
            var node = this.isRightEdgeOf(ancestor) ? new VirtualTextNode(this.tree) : new archNodeByNodeName.br(this.tree);
            this.parent.insertAfter(node, this);
            return node.id;
        }
        return this._super.apply(this, arguments);
    },
});

return customNodes;

});
