odoo.define('wysiwyg.plugin.arch.root', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');


var RootNode = ArchNode.extend({
    init: function (tree) {
        this.tree = tree;
        this.nodeName = 'EDITABLE';
        this.childNodes = [];
    },
    index: function () {
        return null;
    },
    insert: function (fragment, offset) {
        if (offset || offset === 0) {
            return this._changeParent(fragment, offset + 1);
        }
        this.append(fragment);
        this.applyRules();
    },
    isContentEditable: function () {
        return true;
    },
    isVirtual: function () {
        return true;
    },
    toNode: function (options) {
        options = options || {};
        if (options.architecturalSpace) {
            this._architecturalSpaceNodePropagation();
        }

        var node = this.tree._createElement(this, this.nodeName);
        this._redrawChildren(node, options);
        return node;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _prevNextUntil: function (direction, fn, __closestUnbreakable, __goUp) {
        if (!__closestUnbreakable) {
            __closestUnbreakable = this;
            var next = this._super.apply(this, arguments);
            if (next) {
                return next;
            }
        }

        var insertMethod = this[direction === 'next' ? 'append' : 'prepend'].bind(this);
        return this.tree._generateVirtualNode(this, insertMethod, fn);
    },
});

return RootNode;

});
