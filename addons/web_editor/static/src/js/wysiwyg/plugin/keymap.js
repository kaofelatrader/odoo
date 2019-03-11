odoo.define('web_editor.wysiwyg.plugin.keyMap', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

/**
 * Allows to customize link content and style.
 */
var keyMapPlugin = AbstractPlugin.extend({

    pluginEvents: {
        'translate': '_onTranslate',
    },

    /**
     * Restore the hidden close button.
     */
    showHelpDialog: function () {
        var self = this;
        return this._super().then(function () {
            self.$dialog.find('button.close span').attr('aria-hidden', 'false');
        });
    },

    _onTranslate: function (pluginName, node, attributeName, value, before, callback) {
        if (attributeName !== 'title' || !this.dependencies[pluginName]) {
            return callback(value + '=> [test]');
        }
        var methodName = node.getAttribute('data-method');
        var isPc = true;
        var keyMap = this.options.keyMap[isPc ? 'pc' : 'mac'];

        callback(value + ' [XXX]');
    }
});

Manager.addPlugin('KeyMap', keyMapPlugin);

return keyMapPlugin;
});

/*
    help: {
        insertParagraph: _t('Insert Paragraph'),
        undo: _t('Undoes the last command'),
        redo: _t('Redoes the last command'),
        tab: _t('Tab'),
        untab: _t('Outdent (when at the start of a line)'),
        bold: _t('Set a bold style'),
        italic: _t('Set a italic style'),
        underline: _t('Set a underline style'),
        strikethrough: _t('Set a strikethrough style'),
        removeFormat: _t('Clean a style'),
        justifyLeft: _t('Set left align'),
        justifyCenter: _t('Set center align'),
        justifyRight: _t('Set right align'),
        justifyFull: _t('Set full align'),
        insertUnorderedList: _t('Toggle unordered list'),
        insertOrderedList: _t('Toggle ordered list'),
        outdent: _t('Outdent current paragraph'),
        indent: _t('Indent current paragraph'),
        formatPara: _t('Change current block\'s format as a paragraph(P tag)'),
        formatH1: _t('Change current block\'s format as H1'),
        formatH2: _t('Change current block\'s format as H2'),
        formatH3: _t('Change current block\'s format as H3'),
        formatH4: _t('Change current block\'s format as H4'),
        formatH5: _t('Change current block\'s format as H5'),
        formatH6: _t('Change current block\'s format as H6'),
        insertHorizontalRule: _t('Insert horizontal rule'),
        'linkDialog.show': _t('Show Link Dialog')
    },
*/