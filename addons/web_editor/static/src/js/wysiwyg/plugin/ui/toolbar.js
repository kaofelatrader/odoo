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

    blurEditor: function () {
        var toolbar = this.popovers[0];
        toolbar.element.querySelectorAll('button[name]').forEach(function (button) {
            button.classList.add('disabled');
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _createPopover: function (insertCallback) {
        var toolbar = document.createElement('toolbar');
        insertCallback(toolbar);
        this.popovers = [{
            pluginNames: this.options.toolbar,
            element: toolbar,
            display: true,
        }];
    },
    _createPopoverCheckMethod: function () {
        return;
    },
    _setOptionalDependencies: function () {
        var dependencies = this.dependencies.slice();
        this.options.toolbar.forEach(function (item) {
            if (dependencies.indexOf(item) === -1) {
                dependencies.push(item);
            }
        });
        this.dependencies = dependencies;
    },
    _updatePopovers: function () {
        return;
    },
    _hidePopovers: function () {
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
