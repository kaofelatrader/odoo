odoo.define('web_editor.wysiwyg.plugin.codeview', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');


var CodeViewPlugin = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_codeview.xml'],
    dependencies: ['Range'],

    buttons: {
        template: 'wysiwyg.buttons.codeview',
        active: '_isActive',
        enabled: '_enabled',
    },

    disableRange: true,

    /**
     * @override
     */
    init: function (parent, params) {
        this._super.apply(this, arguments);
        this.codeview = this._createCodable();
        params.insertAfterContainer(this.codeview);
    },
    /**
     * @override
     */
    start: function () {
        this._deactivate();
        return this._super();
    },
    /**
     * @override
     */
    destroy: function () {
        this.isBeingDestroyed = true;
        this._super();
    },
    focusEditor: function () {
        if (this._isActive()) {
            this._resize();
        }
    },
    /**
     * @overwrite
     */
    getEditorValue: function (value) {
        if (this._isActive()) {
            return this.codeview.value.trim();
        }
        return value;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    active: function (value) {
        var self = this;
        if (!this._isActive()) {
            if (value) {
                this._setCodeViewValue(value);
            } else {
                this.trigger_up('get_value', {
                    callback: function (value) {
                        self._setCodeViewValue(value);
                    },
                });
            }
            this._activate();
        }
    },
    deactivate: function (value) {
        if (this._isActive()) {
            this._deactivate();
            this.trigger_up('set_value', {
                value: value || this.codeview.value.trim(),
            });
        }
    },
    /**
     * Toggle the code view
     */
    toggle: function () {
        if (this._isActive()) {
            this.deactivate();
        } else {
            this.active()
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Activate the code view and deactivate the wysiwyg view
     */
    _activate: function () {
        this.isActive = true;
        this.codeview.style.display = '';
        this.editable.style.display = 'none';
        this._resize();
        this._focus();
        this.trigger('active');
    },
    /**
     * create the codable view
     */
    _createCodable: function () {
        var codeview = document.createElement('textarea');
        codeview.name = 'codeview';
        codeview.oninput = this._resize.bind(this);
        codeview.style.display = 'none';
        return codeview;
    },
    /**
     * Return true if the codeview is active
     *
     * @returns {Boolean}
     */
    _isActive: function () {
        return this.isActive;
    },
    /**
     * Blur the code view and focus the wysiwyg view
     */
    _blur: function() {
        this.codeview.blur();
        this.editable.focus();
    },
    /**
     * Deactivate the code view and activate the wysiwyg view
     */
    _deactivate: function () {
        this.isActive = false;
        this.codeview.style.display = 'none';
        this.editable.style.display = '';
        this._blur();
        this.trigger('deactivate');
    },
    /**
     * Return true if the codeview is active
     *
     * @returns {Boolean}
     */
    _enabled: function () {
        return true;
    },
    /**
     * Focus the code view and blur the wysiwyg view
     */
    _focus: function () {
        this.editable.blur();
        this.codeview.focus();
    },
    /**
     * Resize the code view textarea to fit its contents
     */
    _resize: function () {
        this.codeview.style.height = '';
        this.codeview.style.height = this.codeview.scrollHeight + "px";
    },
    /**
     * Set the value of the code view
     *
     * @param {String} value
     */
    _setCodeViewValue: function (value) {
        this.codeview.value = value.trim();
    },
});

Manager.addPlugin('CodeView', CodeViewPlugin);

return CodeViewPlugin;

});
