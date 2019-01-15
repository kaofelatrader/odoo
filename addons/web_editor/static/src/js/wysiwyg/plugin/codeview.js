odoo.define('web_editor.wysiwyg.plugin.codeview', function (require) {
'use strict';

var core = require('web.core');
var Plugins = require('web_editor.wysiwyg.plugins');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var _t = core._t;


var CodeviewPlugin = Plugins.codeview.extend({

    setValue: function () {
        // if (this.utils.hasJinja(value)) {
        //     this._summernote.invoke('codeview.forceActivate');
        // }
        console.warn('todo');
    },

    /**
     * @override
     */
    activate: function () {
        this._super();
        if (this.$codable.height() === 0) {
            this.$codable.height(180);
        }
        this.context.invoke('editor.hidePopover');
        this.context.invoke('editor.clearTarget'); // todo: replace by disable editable + event
    },
    /**
     * @override
     */
    deactivate: function () {
        if (
            utils.hasJinja(this.context.invoke('code')) &&
            !this.isBeingDestroyed
        ) {
            var message = _t("Your code contains JINJA conditions.\nRemove them to return to WYSIWYG HTML edition.");
            this.do_warn(_t("Cannot edit HTML"), message);
            this.$codable.focus();
            return;
        }
        this._super();
        this.$editable.css('height', '');

        // todo: enable editable + event
    },
    /**
     * @override
     */
    destroy: function () {
        this.isBeingDestroyed = true;
        this._super();
    },
    /**
     * Force activation of the code view.
     */
    forceActivate: function () {
        if (!this.isActivated()) {
            this.activate();
        }
    },
});

Manager.addPlugin('codeview', CodeviewPlugin);

return CodeviewPlugin;

});
