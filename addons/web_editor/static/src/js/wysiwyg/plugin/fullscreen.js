odoo.define('web_editor.wysiwyg.plugin.fullscreen', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');


var FullScreenPlugin = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_fullscreen.xml'],
    dependencies: [],

    className: 'fullscreen',

    buttons: {
        template: 'wysiwyg.buttons.fullscreen',
        active: '_active',
        enabled: '_enabled',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    toggle: function () {
        this.editor.classList.toggle(this.className);
        return this._active() ? this._deactivate() : this._activate();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Activate fullscreen
     */
    _activate: function () {
        this._resize(this.window.innerHeight);
        this.editor.style.height = this.window.innerHeight + 'px';
        this.isActive = true;
    },
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be active
     */
    _active: function (buttonName, focusNode) {
        return this.isActive;
    },
    /**
     * Deactivate fullscreen
     */
    _deactivate: function () {
        this.editor.style.height = '';
        this.isActive = false;
    },
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled: function (buttonName, focusNode) {
        return true;
    },
    /**
     * Resize the editor to the given size in px or reset the size if none given.
     *
     * @private
     * @param {Number|String} [size]
     */
    _resize: function (size) {
        this.editor.style.height = size ? size + 'px' : '';
    },
});

Manager.addPlugin('FullScreen', FullScreenPlugin);

return FullScreenPlugin;
});
