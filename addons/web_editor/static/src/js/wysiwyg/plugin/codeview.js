odoo.define('web_editor.wysiwyg.plugin.codeview', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');


var CodeViewPlugin = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_codeview.xml'],
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
     * @override
     */
    destroy: function () {
        this.isBeingDestroyed = true;
        this._super();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Toggle the code view
     */
    toggle: function () {
        var self = this;
        if (this._active()) {
            this._deactivate();
            this.trigger_up('set_value', {
                value: this.codeview.value.trim(),
            });
        } else {
            this.trigger_up('get_value', {
                callback: function (html) {
                    self._setCodeViewValue(html);
                },
            });
            this._activate();
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
    },
    /**
     * Return true if the codeview is active
     *
     * @returns {Boolean}
     */
    _active: function () {
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
    /**
     * Insert the codable view into the DOM
     */
    _insertCodable: function () {
        this.codeview = this.document.createElement('textarea');
        this.codeview.name = this.nameAttr;
        this.codeview.oninput = this._resize.bind(this);
        this.editor.insertBefore(this.codeview, this.editable);
        this.isActive = true;
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

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Force activation of the code view if the editable has Jinja code
     *
     * @param {String} value
     */
    _onSetValue: function (value) {
        if (this._hasJinja(value)) {
            this._setCodeViewValue(value);
            if (!this._active()) {
                this._activate();
            }
        }
    },
});

Manager.addPlugin('CodeView', CodeViewPlugin);

return CodeViewPlugin;

});
