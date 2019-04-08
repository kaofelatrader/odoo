odoo.define('web_editor.wysiwyg.plugin.codeview_jinja', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var customNodes = require('wysiwyg.plugin.arch.customNodes');

customNodes.JINJA = customNodes.TEXT.extend({
    isPre: function () {
        return true;
    },
    isBlock: function () {
        return true;
    },
});


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
        this.dependencies.Arch.addCustomRule(this._splitTextArchNode.bind(this), [this._hasArchJinja.bind(this)]);
        return promise;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _splitTextArchNode: function (json) {
        if (json.nodeName === 'JINJA') {
            return json;
        }
        return {
            childNodes: archNode.nodeValue.split('\n').map(function (line) {
                return {
                    nodeName: isJinjaLineExp.test(archNode.nodeValue) ? 'JINJA' : 'TEXT',
                    nodeValue: '\n' + line,
                };
            }),
        };
    },
    _isArchJinja: function (json) {
        return json.nodeValue && isJinjaLineExp.test(json.nodeValue);
    },
    _hasArchJinja: function (json) {
        return json.nodeValue && this._hasJinja(json.nodeValue);
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
