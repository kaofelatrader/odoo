odoo.define('web_editor.wysiwyg.odoo', function (require) {
'use strict';

var Wysiwyg = require('web_editor.wysiwyg');
var core = require('web.core');

var QWeb = core.qweb;

Wysiwyg.include({
    _editorOptions: function () {
        var options = this._super();
        options.getColors = this._getColors.bind(this);
        return options;
    },
    _getColors: function () {
        var self = this;
        var def = $.when();
        if (!('web_editor.colorpicker' in QWeb.templates)) {
            var def = this._rpc({
                model: 'ir.ui.view',
                method: 'read_template',
                args: ['web_editor.colorpicker'],
            }).then(function (template) {
                QWeb.add_template(template);
            });
        }

        var groupColors = [];
        var $clpicker = $(QWeb.render('web_editor.colorpicker'));
        $clpicker.children('.o_colorpicker_section').each(function () {
            groupColors.push({title: $(this).attr('data-display')});
            var colors = [];
            $(this.children).each(function () {
                if ($(this).hasClass('clearfix')) {
                    groupColors.push(colors);
                    colors = [];
                } else {
                    colors.push($(this).attr('data-color'));
                }
            });
            groupColors.push(colors);
        });

        groupColors.push({title: null});
        groupColors.push.apply(groupColors, JSON.parse(JSON.stringify(this.options.colors)));

        return $.when(groupColors);
    },

    // => loadXML ? (web_editor.wysiwyg.plugin.manager)
});


});
