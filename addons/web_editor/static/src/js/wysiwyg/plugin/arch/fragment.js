odoo.define('wysiwyg.plugin.arch.fragment', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
var text = require('wysiwyg.plugin.arch.text');

var FragmentNode = ArchNode.extend({
    init: function (tree) {
        this.tree = tree;
        this.nodeName = 'FRAGMENT';
        this.childNodes = [];
    },
    toNode: function (options) {
        options = options || {};
        if (options.architecturalSpace) {
            this._architecturalSpaceNodePropagation();
        }
        return this._toNode(options);
    },
    applyRules: function () {
        this._applyRulesPropagation();
    },
    _toNode: function (options) {
        var fragment = document.createDocumentFragment();
        this.childNodes.forEach(function (archNode) {
            fragment.appendChild(archNode._toNode(options));
        });
        return fragment;
    },
});

//////////////////////////////////////////////////////////////

var RootNode = FragmentNode.extend({
    init: function (tree) {
        this.tree = tree;
        this.nodeName = 'EDITABLE';
        this.childNodes = [];
    },
    index: function () {
        return null;
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
        return this._generateVirtualNode(insertMethod, fn);
    },
    _generateVirtualNode: function (insertMethod, fn) {
        var virtualTextNode = new text.VirtualTextNode(this.tree);
        virtualTextNode.parent = this;
        insertMethod(virtualTextNode);
        if (!this.tree.options.isEditableNode(virtualTextNode) || (fn && !fn.call(this, virtualTextNode))) {
            virtualTextNode.remove();
            return;
        }
        return virtualTextNode;
    },
});

return {
    FragmentNode: FragmentNode,
    RootNode: RootNode,
};

});
