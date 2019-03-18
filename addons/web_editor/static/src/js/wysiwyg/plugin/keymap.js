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

    init: function () {
        var self = this;
        this._super.apply(this, arguments);

        this.nameFromCode = {};
        Object.keys(this.codeFromName).forEach(function (key) {
            self.nameFromCode[self.codeFromName[key]] = key;
        })

        var defaults = JSON.parse(JSON.stringify(defaultOptions.keyMap));
        var keyMap = Object.assign(defaults, this.options.keyMap);
        var help = Object.assign({}, defaults.help, keyMap.help);
        var keyboard = this.options.env.isMac ? 'mac' : 'pc';
        keyMap = Object.assign({}, defaults[keyboard], keyMap[keyboard]);

        this.keyMap = {};
        var dependencies = this.dependencies.slice();
        Object.keys(keyMap).forEach(function (shortcut) {
            var command = keyMap[shortcut];
            var pluginMethod = command.split('.');
            var pluginName = pluginMethod[0];
            var method = pluginMethod[1].split(':');
            self.keyMap[shortcut] = {
                command: command,
                shortcut: shortcut,
                pluginName: pluginName,
                methodName: method[0],
                value: method[1],
                description: help[command] && self.options.translate('KeyMap', help[command]),
            };
            if (!help[command]) {
                console.info("No description for '" + command + "'");
            }
            if (dependencies.indexOf(pluginName) === -1) {
                dependencies.push(pluginName);
            }
        });
        this.dependencies = dependencies;
    },
    /**
     * @see Manager.translatePluginTerm
     */
    translatePluginTerm: function (pluginName, value, originalValue, elem, attributeName) {
        if (attributeName !== 'title' || !this.dependencies[pluginName]) {
            return value;
        }
        var methodName = elem.getAttribute('data-method');
        var keyMap = Object.values(this.keyMap);
        for (var k = 0; k < keyMap.length; k++) {
            var item = keyMap[k];
            if (item.pluginName === pluginName && item.methodName === methodName) {
                return value + ' [' + item.shortcut + ']';
            }
        }
        return value;
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
            var html = self.options.renderTemplate('KeyMap', 'wysiwyg.help_dialog', {
                keyMap: Object.values(self.keyMap),
            });
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
});

Manager.addPlugin('KeyMap', keyMapPlugin);

return keyMapPlugin;
});
