odoo.define('web_editor.wysiwyg.odoo', function (require) {
'use strict';

var Wysiwyg = require('web_editor.wysiwyg');
var ajax = require('web.ajax');
var core = require('web.core');

var QWeb = core.qweb;
var _t = core._t;

Wysiwyg.include({
    _editorOptions: function () {
        var options = this._super();
        options.getColors = this._getColors.bind(this);
        options.loadTemplates = function (xmlPaths) {
            var promises = [];
            var xmlPath;
            while ((xmlPath = xmlPaths.shift())) {
                promises.push(ajax.loadXML(xmlPath, QWeb));
            }
            return $.when.apply($, promises);
        };
        options.renderTemplate = function (pluginName, template, values) {
            var xml = QWeb.render(template, values);
            var fragment = document.createElement('fragment');
            fragment.innerHTML = xml;
            this.translateTemplateNodes(pluginName, fragment);
            return fragment.innerHTML;
        };
        options.translate = function (pluginName, string) {
            string = string.replace(/\s\s+/g, ' ');
            return _t(string);
        };

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
