odoo.define('web_editor.wysiwyg.plugin.keyMap', function (require) {
'use strict';

var Dialog = require('web.Dialog');

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var defaultOptions = require('wysiwyg.options');

/**
 * Allows to customize link content and style.
 */
var keyMapPlugin = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_help.xml'],
    dependencies: ['Range'],

    buttons: {
        template: 'wysiwyg.buttons.help',
        active: '_active',
        enabled: '_enabled',
    },

    editableDomEvents: {
        keydown: '_onKeydown',
    },

    pluginEvents: {
        'translate': '_onTranslate',
    },

    codeFromName: {
        'BACKSPACE': 8,
        'TAB': 9,
        'ENTER': 13,
        'SPACE': 32,
        'DELETE': 46,
        // Arrow
        'LEFT': 37,
        'UP': 38,
        'RIGHT': 39,
        'DOWN': 40,
        // Number: 0-9
        'NUM0': 48,
        'NUM1': 49,
        'NUM2': 50,
        'NUM3': 51,
        'NUM4': 52,
        'NUM5': 53,
        'NUM6': 54,
        'NUM7': 55,
        'NUM8': 56,
        // Alphabet: a-z
        'B': 66,
        'E': 69,
        'I': 73,
        'J': 74,
        'K': 75,
        'L': 76,
        'R': 82,
        'S': 83,
        'U': 85,
        'V': 86,
        'Y': 89,
        'Z': 90,
        'SLASH': 191,
        'LEFTBRACKET': 219,
        'BACKSLASH': 220,
        'RIGHTBRACKET': 221
    },

    init: function (parent, editor, options) {
        var self = this;
        this._super.apply(this, arguments);

        this.nameFromCode = {};
        Object.keys(this.codeFromName).forEach(function (key) {
            self.nameFromCode[self.codeFromName[key]] = key;
        })

        var keyMap = Object.assign(JSON.parse(JSON.stringify(defaultOptions.keyMap)), this.options.keyMap);
        keyMap = keyMap[this.options.env.isMac ? 'mac' : 'pc'];

        this.keyMap = {};
        var dependencies = this.dependencies.slice();
        Object.keys(keyMap).forEach(function (shortcut) {
            var pluginMethod = keyMap[shortcut].split('.');
            var pluginName = pluginMethod[0];
            var method = pluginMethod[1].split(':');
            self.keyMap[shortcut] = {
                shortcut: shortcut,
                pluginName: pluginName,
                methodName: method[0],
                value: method[1],
                description: 'rrrr',
            };
            if (dependencies.indexOf(pluginName) === -1) {
                dependencies.push(pluginName);
            }
        });
        this.dependencies = dependencies;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Restore the hidden close button.
     */
    showHelpDialog: function () {
        var self = this;
        return new Promise(function (resolve) {
            var html = self.options.renderTemplate('KeyMap', 'wysiwyg.help_dialog', self);
            var helpDialog = new Dialog(self, {
                title: self.options.translate('KeyMap', 'Help'),
                size: 'medium',
                $content: $(html),
            });
            helpDialog.on('closed', self, function () {
                resolve({noChange: true});
            });
            helpDialog.open();
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be active
     */
    _active: function (buttonName, focusNode) {
        return false;
    },
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled: function (buttonName, focusNode) {
        return true;
    },
    _eventToShortcut: function (ev) {
        var keys = [];
        if (ev.metaKey) {
            keys.push('CMD');
        }
        if (ev.ctrlKey && !ev.altKey) {
            keys.push('CTRL');
        }
        if (ev.shiftKey) {
            keys.push('SHIFT');
        }
        var keyName = this.nameFromCode[ev.keyCode];
        if (keyName) {
            keys.push(keyName);
        }
        return keys.join('+');
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    _onKeydown: function (ev) {
        if (!ev.key || !ev.key.length === 1 || (!ev.ctrlKey && !ev.altKey && !ev.shiftKey && !ev.metaKey)) {
            return;
        }
        var shortcut = this._eventToShortcut(ev);
        var item = this.keyMap[shortcut];

        if (!item) {
            return;
        }

        ev.preventDefault();

        var plugin = this.dependencies[item.pluginName];
        this.trigger_up('command', {
            method: plugin[item.methodName].bind(plugin),
            args: [item.value, this.dependencies.Range.getRange()],
            disableRange: plugin.disableRange,
        });
    },
    _onTranslate: function (pluginName, node, attributeName, value, before, callback) {
        if (attributeName !== 'title' || !this.dependencies[pluginName]) {
            return callback(value);
        }
        var methodName = node.getAttribute('data-method');
        var keyMap = Object.values(this.keyMap);
        for (var k = 0; k < keyMap.length; k++) {
            var item = keyMap[k];
            if (item.pluginName === pluginName && item.methodName === methodName) {
                callback(value + ' [' + item.shortcut + ']');
                break;
            }
        }
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