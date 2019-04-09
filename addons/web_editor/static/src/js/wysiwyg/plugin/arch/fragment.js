odoo.define('wysiwyg.plugin.arch.fragment', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');

var FragmentNode = ArchNode.extend({
    init: function (tree) {
        this.tree = tree;
        this.nodeName = 'FRAGMENT';
        this.childNodes = [];
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
});

return FragmentNode;

});
