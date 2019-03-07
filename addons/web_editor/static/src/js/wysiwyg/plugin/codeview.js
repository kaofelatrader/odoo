odoo.define('web_editor.wysiwyg.plugin.codeview', function (require) {
'use strict';

var core = require('web.core');
var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var _t = core._t;


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
        this.deactivate();
    },

    /**
     * Activate the code view
     */
    activate: function () {
        var self = this;
        this.trigger_up('getValue', {callback: function (html) {
            self.codeview.innerHTML = html;
        }});
        this._activate();
    },
    /**
     * @override
     */
    deactivate: function () {
        this.codeview.style.display = 'none';
        this.isActive = false;
        this.editable.style.display = '';
        this._blur();
        this.trigger_up('setValue', {value: this.codeview.innerHTML});
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
    _enabled: function () {
        return true;
    },
    _focus: function () {
        this.editable.blur();
        this.codeview.focus();
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
        if (this.utils.hasJinja(value)) {
            this.codeview.innerHTML = value;
            if (!this._active()) {
                this._activate();
            }
        }
    },
});

Manager.addPlugin('CodeView', CodeViewPlugin);

return CodeViewPlugin;

});
