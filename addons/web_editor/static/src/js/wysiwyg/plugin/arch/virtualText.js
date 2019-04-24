odoo.define('wysiwyg.plugin.arch.virtualText', function (require) {
'use strict';

var TextNode = require('wysiwyg.plugin.arch.text');
function True () { return true; };
function False () { return false; };


return TextNode.extend({
    char: '\uFEFF',
    init: function (params) {
        this.params = params;
        this.nodeName = 'TEXT-VIRTUAL';
        this.nodeValue = this.char;
        this.params.change(this, this.length());
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    insert: function (node, offset) {
        var prev = this.previousSibling();
        if (prev) {
            prev.insert(node, prev.length());
        } else {
            this.parent.insert(node, this.index());
        }
        this.remove();
    },
    /**
     * @override
     */
    isBlankNode: True,
    /**
     * @override
     */
    isBlankText: True,
    /**
     * @override
     */
    isEmpty: True,
    /**
     * @override
     */
    isVirtual: True,
    /**
     * @override
     */
    split: False,

    //--------------------------------------------------------------------------
    // Public: export
    //--------------------------------------------------------------------------

    toJSON: function (options) {
        if (!options || !options.keepVirtual) {
            return null;
        }
        return this._super(options);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyRulesArchNode: function () {
        if (this.parent && (this.parent.isList() || this.parent.isRoot())) {
            return this._mutation('br');
        }

        var para = this.ancestor(this._isPara);
        if (!para) {
            return this.remove();
        }

        if (para.isEmpty()) {
            return this._mutation('br');
        }
    },
    _applyRulesCheckParents: function () {},
    _mutation: function (nodeName, param) {
        var archNode = this.params.create(nodeName, param);
        archNode.id = this.id;
        this.before(archNode);
        this.remove();
    },
});

});
