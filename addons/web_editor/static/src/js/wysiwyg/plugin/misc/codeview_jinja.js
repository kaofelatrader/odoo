odoo.define('web_editor.wysiwyg.plugin.codeview_jinja', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');


var JinjaPlugin = AbstractPlugin.extend({
    dependencies: ['CodeView'],

    /**
     * @overwrite
     */
    setEditorValue: function (value) {
        if (this._hasJinja(value)) {
            this.dependencies.CodeView.active(value);
        }
        return value;
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
        var jinjaExp = /(^|\n)\s*%\send|%\sset/;
        var reHasJinja = this.utils.getRegex('jinja', '', jinjaExp);
        return reHasJinja.test(value);
    },
});

Manager.addPlugin('Jinja', JinjaPlugin);

return JinjaPlugin;

});
