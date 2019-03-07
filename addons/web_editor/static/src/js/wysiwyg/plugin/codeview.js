odoo.define('web_editor.wysiwyg.plugin.codeview', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');


var CodeViewPlugin = AbstractPlugin.extend({
    xmlDependencies: ['/web_editor/static/src/xml/wysiwyg_codeview.xml'],
    dependencies: ['Range'],

    pluginEvents: {
        'setValue': '_onSetValue',
    },

    nameAttr: 'codeview',

    buttons: {
        template: 'wysiwyg.buttons.codeview',
        active: '_active',
        enabled: '_enabled',
    },

    disableRange: true,

    /**
     * @override
     */
    start: function () {
        this._insertCodable();
        this._deactivate();
    },

    /**
     * Activate the code view
     */
    activate: function () {
        var self = this;
        this.trigger_up('get_value', {
            callback: function (html) {
                self.codeview.value = html;
            },
        });
        this._activate();
    },
    /**
     * @override
     */
    deactivate: function () {
        this._deactivate();
        this.trigger_up('set_value', {
            value: this.codeview.value,
        });
    },
    /**
     * @override
     */
    destroy: function () {
        this.isBeingDestroyed = true;
        this._super();
    },
    save: function () {
        return;
    },
    /**
     * Toggle the code view
     */
    toggle: function () {
        return this._active() ? this.deactivate() : this.activate();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _activate: function () {
        this.isActive = true;
        this.codeview.style.display = '';
        this.editable.style.display = 'none';
        this._focus();
    },
    _active: function () {
        return this.isActive;
    },
    _blur: function() {
        this.codeview.blur();
        this.editable.focus();
    },
    _deactivate: function () {
        this.isActive = false;
        this.codeview.style.display = 'none';
        this.editable.style.display = '';
        this._blur();
    },
    _enabled: function () {
        return true;
    },
    _focus: function () {
        this.editable.blur();
        this.codeview.focus();
    },
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
    _insertCodable: function () {
        this.codeview = this.document.createElement('textarea');
        this.codeview.name = this.nameAttr;
        this.editor.insertBefore(this.codeview, this.editable);
        this.isActive = true;
    },

    /**
     * Set the value of the codeview.
     *
     * @param {String} value
     */
    _onSetValue: function (value) {
        if (this._hasJinja(value)) {
            this.codeview.value = value;
            if (!this._active()) {
                this._activate();
            }
        }
    },
});

Manager.addPlugin('CodeView', CodeViewPlugin);

return CodeViewPlugin;

});
