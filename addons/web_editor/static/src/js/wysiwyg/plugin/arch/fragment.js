odoo.define('wysiwyg.plugin.arch.fragment', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');

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
    /**
     * @override
     */
    isElement: function () {
        return false;
    },
    isFragment: function () {
        return true;
    },
    isVirtual: function () {
        return true;
    },
    _toNode: function (options) {
        var fragment = document.createDocumentFragment();
        this.childNodes.forEach(function (archNode) {
            fragment.appendChild(archNode._toNode(options));
        });
        return fragment;
    },
});

return FragmentNode;

});
