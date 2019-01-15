odoo.define('web_editor.wysiwyg.plugin.HelpDialog', function (require) {
'use strict';

var Plugins = require('web_editor.wysiwyg.plugins');
var Manager = require('web_editor.wysiwyg.plugin.manager');

/**
 * Allows to customize link content and style.
 */
var HelpDialog = Plugins.helpDialog.extend({
    /**
     * Restore the hidden close button.
     */
    showHelpDialog: function () {
        var self = this;
        return this._super().then(function () {
            self.$dialog.find('button.close span').attr('aria-hidden', 'false');
        });
    },
});

Manager.addPlugin('helpDialog', HelpDialog);

return {
    HelpDialog: HelpDialog,
};
});
