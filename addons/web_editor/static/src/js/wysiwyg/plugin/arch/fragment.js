odoo.define('wysiwyg.plugin.arch.fragment', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
function True () { return true; };
function False () { return false; };


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
    isElement: False,
    isFragment: True,
    isVirtual: True,
});

return FragmentNode;

});
