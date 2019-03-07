odoo.define('wysiwyg.plugin.ui.toolbar', function (require) {
'use strict';

var PopoverPlugin = require('wysiwyg.plugin.ui.popover');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $ = require('web_editor.jquery');
var _ = require('web_editor._');

var ToolbarPlugin = PopoverPlugin.extend({

    editableDomEvents: {
        'keydown': '_onKeyPress',
        'keyup': '_onKeyPress',
    },

    init: function (parent, editor, options) {
        var dependencies = this.dependencies.slice();
        this._super.apply(this, arguments);
        this.options.toolbar.forEach(function (item) {
            if (dependencies.indexOf(item) === -1) {
                dependencies.push(item);
            }
        });
        this.dependencies = dependencies;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    setValue: function () {
        return null;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _createPopover: function () {
        var self = this;
        var toolbarWrap =  this.document.createElement('toolbar');
        this.options.toolbar.forEach(function (pluginName) {
            var render = self._renderButtons(pluginName);
            toolbarWrap.appendChild(render.element);
        });
        var buttons = [].slice.call(toolbarWrap.getElementsByTagName('button'));
        this.popovers = [{
            element: toolbarWrap,
            buttons: buttons,
            display: true,
        }];
    },
    _updatePopovers: function () {
        return;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onFocusNode: function (focusNode) {
        this._updatePopoverButtons(focusNode);
    },
});

Manager.addPlugin('Toolbar', ToolbarPlugin);

return ToolbarPlugin;
});
