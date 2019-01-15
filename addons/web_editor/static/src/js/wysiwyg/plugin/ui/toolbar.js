odoo.define('wysiwyg.plugin.ui.toolbar', function (require) {
'use strict';

var PopoverPlugin = require('wysiwyg.plugin.ui.popover');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $; // disabled jQuery

var ToolbarPlugin = PopoverPlugin.extend({

    editableDomEvents: {
        'keydown': '_onKeyPress',
        'keyup': '_onKeyPress',
    },

    init: function (parent, editor, options) {
        var dependencies = this.dependencies.concat();
        this._super.apply(this, arguments);
        this.dependencies = _.uniq(dependencies.concat(this.options.toolbar));
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
        _.each(this.options.toolbar, function (pluginName) {
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
