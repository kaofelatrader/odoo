odoo.define('web_editor.wysiwyg.plugin.help', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var core = require('web.core');
var Dialog = require('web.Dialog');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var _t = core._t;
var QWeb = core.qweb;


var HelpPlugin = AbstractPlugin.extend({
    xmlDependencies: ['/web_editor/static/src/xml/wysiwyg_help.xml'],
    dependencies: [],

    buttons: {
        template: 'wysiwyg.buttons.help',
        active: '_active',
        enabled: '_enabled',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    init: function () {
        this._super.apply(this, arguments);
        var isMac = navigator.appVersion.indexOf('Mac') > -1;
        var keymap = this.options.keyMap[isMac ? 'mac' : 'pc'];
        var $content = $(QWeb.render('wysiwyg.help_dialog', {
            keymap: this.utils.dictToArray(keymap, 'shortcut', 'description'),
        }));
        this.helpDialog = new Dialog(this, {
            title: _t('Help'),
            size: 'medium',
            $content: $content,
        });
    },
    /**
     * Open the help dialog and listen to its saved/closed events.
     */
    showHelpDialog: function (value, range) {
        this.helpDialog.open();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be active
     */
    _active: function (buttonName, focusNode) {
        return false;
    },
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled: function (buttonName, focusNode) {
        return true;
    },
});

Manager.addPlugin('Help', HelpPlugin);

return HelpPlugin;
});
