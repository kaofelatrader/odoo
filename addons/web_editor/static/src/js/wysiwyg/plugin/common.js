odoo.define('web_editor.wysiwyg.plugin.common', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');


var CommonPlugin = AbstractPlugin.extend({
    /**
     * @constructor
     */
    init: function (parent, media, options) {
        this._super.apply(this, arguments);

        this._isVoidBlockList = [this._isVoidBlock.bind(this)];
        if (this.options.isVoidBlock) {
            this._isVoidBlockList.push(this.options.isVoidBlock);
        }

        this._isUnbreakableNodeList = [this._isUnbreakableNode.bind(this)];
        if (this.options.isUnbreakableNode) {
            this._isUnbreakableNodeList.push(this.options.isUnbreakableNode);
        }

        this._isEditableNodeList = [this._isEditableNode.bind(this)];
        if (this.options.isEditableNode) {
            this._isEditableNodeList.push(this.options.isEditableNode);
        }
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Add a method to the `_isVoidBlock` array.
     *
     * @see isVoidBlock
     * @see _isVoidBlock
     * @param {Function (Node)} fn
     */
    addVoidBlockCheck: function (fn) {
        this._isVoidBlockList.push(fn);
        this._isVoidBlockList = this.utils.uniq(this._isVoidBlockList);
    },
    addUnbreakableNodeCheck: function (fn) {
        this._isUnbreakableNodeList.push(fn);
        this._isUnbreakableNodeList = this.utils.uniq(this._isUnbreakableNodeList);
    },
    addEditableNodeCheck: function (fn) {
        this._isEditableNodeList.push(fn);
        this._isEditableNodeList = this.utils.uniq(this._isEditableNodeList);
    },
    /**
     * Return true if the node is a block media to treat like a block where
     * the cursor can not be placed inside like the void.
     * The conditions can be extended by plugins by adding a method with
     * `addVoidBlockCheck`. If any of the methods returns true, this will too.
     *
     * @see _isVoidBlock
     * @see addVoidBlockCheck
     * @param {Node} node
     * @returns {Boolean}
     */
    isVoidBlock: function (node) {
        for (var i = 0; i < this._isVoidBlockList.length; i++) {
            if (this._isVoidBlockList[i](node)) {
                return true;
            }
        }
        return false;
    },
    /**
     * Return true if the current node is unbreakable.
     * An unbreakable node can be removed or added but can't by split into
     * different nodes (for keypress and selection).
     * An unbreakable node can contain nodes that can be edited.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isUnbreakableNode: function (node) {
        for (var i = 0; i < this._isUnbreakableNodeList.length; i++) {
            if (this._isUnbreakableNodeList[i](node)) {
                return true;
            }
        }
        return false;
    },
    /**
     * Return true if the current node is editable (for keypress and selection).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isEditableNode: function (node) {
        for (var i = 0; i < this._isEditableNodeList.length; i++) {
            if (!this._isEditableNodeList[i](node)) {
                return false;
            }
        }
        return true;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _isVoidBlock: function (node) {
        return (!this.utils.isBR(node) && this.utils.isVoid(node)) ||
            node.contentEditable === 'false' ||
            node.classList && node.classList.contains('o_fake_editable');
    },
    _isUnbreakableNode: function (node) {
        node = node && (node.tagName ? node : node.parentNode);
        if (!node) {
            return true;
        }
        return ["TD", "TR", "TBODY", "TFOOT", "THEAD", "TABLE"].indexOf(node.tagName) !== -1 ||
                $(node).is(this.editable) ||
                !this.isEditableNode(node.parentNode) ||
                !this.isEditableNode(node);
    },
    _isEditableNode: function (node) {
        node = node && (node.tagName ? node : node.parentNode);
        if (!node) {
            return false;
        }
        return !$(node).is('table, thead, tbody, tfoot, tr');
    },
});

Manager.addPlugin('Common', CommonPlugin);

return CommonPlugin;

});
