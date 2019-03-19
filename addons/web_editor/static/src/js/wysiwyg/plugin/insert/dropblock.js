odoo.define('web_editor.wysiwyg.plugin.dropblock', function (require) {
'use strict';

var core = require('web.core');
var weWidgets = require('wysiwyg.widgets');
var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var _t = core._t;

//--------------------------------------------------------------------------
// Size button
//--------------------------------------------------------------------------

var DropBlock = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_dropblock.xml'],
    buttons: {
        template: 'wysiwyg.buttons.dropblock',
        active: '_isActive',
        enabled: '_enabled',
    },

    /**
     * @override
     */
    init: function (parent, params) {
        this._super.apply(this, arguments);
        this._blockContainer = document.createElement('dropblock');
        this._blocks = this._blockContainer.querySelectorAll('block');
        params.insertBeforeEditable(this._blockContainer);
    },
    start: function () {
        this._createBlocks();
        this._bindEvents();
        return this._super();
    },
    destroy: function () {
        this._destroyEvents();
        this._super();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Toggle the code view
     */
    toggle: function () {
        this.isOpen = !this.isOpen;
        this._blockContainer.style.display = this.isOpen ? 'block' : 'none';
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     *
     * @private
     */
    _bindEvents: function () {
        
    },
    /**
     *
     * @returns {DOM}
     */
    _createBlocks: function () {
        var html = this.options.renderTemplate('DropBlock', 'wysiwyg.dropblock.defaultblocks');
        this._blockContainer.innerHTML = html;
    },
    _destroyEvents: function () {
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
     * Return true if the container is open
     *
     * @returns {Boolean}
     */
    _isActive: function () {
        return this.isOpen;
    },
});

Manager.addPlugin('DropBlock', DropBlock);

});
