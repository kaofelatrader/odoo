odoo.define('web_editor.wysiwyg.plugin.dropblockSelector', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var dropblockSelector = AbstractPlugin.extend({
    dependencies: ['DropBlock', 'Selector'],

    /**
     *
     * @override
     *
     * @param {Object} params.dropblockSelector
     * @param {string} params.dropblockSelector.selector
     * @param {string} params.dropblockSelector.dropIn
     * @param {string} params.dropblockSelector.dropNear
     **/
    init: function (parent, params) {
        this._super.apply(this, arguments);
        if (this.options.dropblockSelector) {
            this._makeFunctionFromStringSelection(this.options.dropblockSelector);
        } else {
            console.error("'DropblockSelector' plugin should use 'dropblockSelector' options");
        }
    },
});

Manager.addPlugin('dropblockSelector', dropblockSelector);



});
