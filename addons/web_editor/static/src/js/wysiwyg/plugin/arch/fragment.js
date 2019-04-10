odoo.define('wysiwyg.plugin.arch.fragment', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
function True () { return true; };
function False () { return false; };


var FragmentNode = ArchNode.extend({
    init: function (root) {
        this.params = root;
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
