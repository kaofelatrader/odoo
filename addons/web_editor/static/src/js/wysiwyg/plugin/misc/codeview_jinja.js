odoo.define('web_editor.wysiwyg.plugin.codeview_jinja', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var jinjaExp = /(^|\n)\s*%\send|%\sset/;

var JinjaPlugin = AbstractPlugin.extend({
    dependencies: ['CodeView', 'ArchPlugin'],

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
        this.dependencies.ArchPlugin.addStructureRule([null], [function isJinja (archNode) {
            return typeof archNode.nodeValue === 'string' && jinjaExp.test(archNode.nodeValue);
        }]);
        return promise;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Returns true if the value contains jinja logic
     *
     * @param {String} value
     * @returns {Boolean}
     */
    _hasJinja: function (value) {
        var reHasJinja = this.utils.getRegex('jinja', '', jinjaExp);
        return reHasJinja.test(value);
    },
});

Manager.addPlugin('Jinja', JinjaPlugin);

return JinjaPlugin;

});
