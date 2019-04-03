odoo.define('web_editor.wysiwyg.plugin.codeview_jinja', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var jinjaExp = /(^|\n)\s*%\s?(end|endif|else|if|set)/;
var isJinjaLineExp = /^\n?\s*((%\s?(end|endif|else|(if|set) [^\n]+)?)|(\{%.*%\})|(\$\{[^}]+\}\s*%?))\s*\n?$/;

var JinjaPlugin = AbstractPlugin.extend({
    dependencies: ['CodeView', 'Arch'],

    /**
     * @overwrite
     */
    setEditorValue: function (value) {
        if (this._hasJinja(value)) {
            this.dependencies.CodeView.active(value);
        }
        return value;
    },
    start: function () {
        var self = this;
        var promise = this._super();
        this.dependencies.Arch.addStructureRule([null], [this._isArchJinja.bind(this)]);
        this.dependencies.Arch.addCustomRule(this._splitVirtualTextArchNode.bind(this), [this._hasArchJinja.bind(this)]);
        this.dependencies.Arch.addCustomRule(this._preventSpaceUpdate.bind(this), [this._hasArchJinja.bind(this)]);
        return promise;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _preventSpaceUpdate: function (tree, archNode) {
        archNode.isPre = function () {
            return true;
        };
        archNode.isBlock = function () {
            return true;
        };
    },
    _splitVirtualTextArchNode: function (tree, archNode) {
        if (this._isArchJinja(archNode)) {
            return;
        }
        var lines = archNode.nodeValue.split('\n');
        var fragment = tree.parse('\n' + lines.shift());
        lines.forEach(function (line) {
            fragment.append(tree.parse('\n' + line));
        });

        return fragment;
    },
    _isArchJinja: function (archNode) {
        return archNode.isText() && isJinjaLineExp.test(archNode.nodeValue);
    },
    _hasArchJinja: function (archNode) {
        return typeof archNode.isText() && this._hasJinja(archNode.nodeValue);
    },
    /**
     * Returns true if the value contains jinja logic
     *
     * @param {String} value
     * @returns {Boolean}
     */
    _hasJinja: function (value) {
        return jinjaExp.test(value);
    },
});

Manager.addPlugin('Jinja', JinjaPlugin);

return JinjaPlugin;

});
