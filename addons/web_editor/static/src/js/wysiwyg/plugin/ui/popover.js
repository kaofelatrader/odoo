odoo.define('wysiwyg.plugin.ui.popover', function (require) {
'use strict';

var core = require('web.core');
var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var utils = require('wysiwyg.utils');

var QWeb = core.qweb;

var $ = require('web_editor.jquery');
var _ = require('web_editor._');


var handleSelector = function (element, selector, callback) {
    return function (ev) {
        var nodelist = element.querySelectorAll(selector);
        for (var k = nodelist.length - 1; k >= 0; k--) {
            var el = nodelist[k];
            if (el === ev.target || el.contains(ev.target)) {
                callback(ev);
                break;
            }
        }
    }
};


var PopoverPlugin = AbstractPlugin.extend({
    dependencies: ['Range', 'Position'],

    editableDomEvents: {
        'keydown': '_onKeyPress',
        'keyup': '_onKeyPress',
    },
    pluginEvents: {
        'update': '_onChange',
        'change': '_onChange',
        'blur': '_onBlur',
    },

    POPOVER_MARGIN_LEFT: 5,
    POPOVER_MARGIN_TOP: 7,

    init: function (parent, editor, options) {
        this._super.apply(this, arguments);
        var dependencies = this.dependencies.slice();

        var popover = this.options.popover;
        Object.keys(popover).forEach(function (checkMethod) {
            var plugins = popover[checkMethod];
            if (checkMethod.indexOf('.') !== -1) {
                dependencies.push(checkMethod.split('.')[0]);
            }
            plugins.forEach(function (plugin) {
            if (dependencies.indexOf(plugin) === -1)
                dependencies.push(plugin);
            });
        });
        this.dependencies = dependencies;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    start: function () {
        Object.values(this.dependencies).forEach(function (plugin) {
            if (plugin.buttons) {
                plugin.buttons = Object.assign({}, plugin.buttons);
            }
        });
        this._createPopover();
        this._toggleDropDownEnabled();
        var editable = this.editable;
        this.popovers.forEach(function (popover) {
            editable.parentNode.insertBefore(popover.element, editable);
        });
        this.dependencies.Position.on('scroll', this, this._onScroll.bind(this));
        this.dependencies.Range.on('focus', this, this._onFocusNode.bind(this));
        this.dependencies.Range.on('range', this, this._onRange.bind(this));
        return this._super();
    },
    setValue: function () {
        this._hidePopovers();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @returns [elements]
     */
    _createPopover: function () {
        console.warn('TO DO: use keyMap for button name HELP');

        var self = this;
        this.popovers = [];
        var popovers = this.options.popover;
        Object.keys(popovers).forEach(function (checkMethodKey) {
            var pluginNames = popovers[checkMethodKey];
            var checkMethodPluginName = checkMethodKey.split('.')[0];
            var plugin = self.dependencies[checkMethodPluginName];
            var checkMethod = plugin[checkMethodKey.split('.')[1]].bind(plugin);

            var popover = self.document.createElement('popover');
            var buttons = [];
            pluginNames.forEach(function (pluginName) {
                var render = self._renderButtons(pluginName);
                popover.appendChild(render.element);
                buttons = buttons.concat(render.buttons);
            });
            popover.setAttribute('name', checkMethodPluginName);

            self.popovers.push({
                checkMethod: checkMethod,
                element: popover,
                buttons: buttons,
                display: false,
            });
        });
    },
    _hidePopovers: function () {
        this.popovers.forEach(function (popover) {
            popover.element.style.display = '';
            popover.display = false;
        });
    },
    _renderButtons: function (pluginName) {
        var self = this;
        var plugin = self.dependencies[pluginName];
        if (!plugin.buttons || !plugin.buttons.template) {
            throw new Error('Button template of "' + pluginName + '" plugin is missing.');
        }

        var group = this.document.createElement('group');
        group.innerHTML = QWeb.render(plugin.buttons.template, {
            plugin: plugin,
            options: this.options,
        });
        var element = group.children.length === 1 ? group.children[0] : group;
        element.setAttribute('data-plugin', plugin.pluginName);

        this._addButtonHandlers(plugin, element);
        var buttons = this._recordPluginButtons(plugin, element);

        return {
            element: element,
            buttons: buttons,
        };
    },
    _addButtonHandlers: function (plugin, element) {
        // add plugins button event as handler
        var events = plugin.buttons.events;
        if (events) {
            Object.keys(events).forEach(function (key) {
                var handle = events[key];
                var eventName = key.split(' ').shift();
                var selector = key.split(' ').slice(1).join(' ');
                if (typeof handle === 'string') {
                    handle = plugin[handle];
                }
                handle = handle.bind(plugin);

                if (selector) {
                    handle = handleSelector(element, selector, handle);
                }
                element.addEventListener(eventName, handle, false);
            });
        }

        // add plugins named button handler
        var _onButtonMousedown = this._onButtonMousedown.bind(this, plugin);
        if (!element.getAttribute('data-method')) {
            _onButtonMousedown = handleSelector(element, 'button[data-method]', _onButtonMousedown);
        }
        element.addEventListener('mousedown', _onButtonMousedown, false);

        // prevent all click (avoid href...)
        element.addEventListener('click', function (ev) {
            ev.preventDefault();
        }, false);
    },
    _recordPluginButtons: function (plugin, element) {
        // add created dom on plugin buttons object
        if (!plugin.buttons.elements) {
            plugin.buttons.elements = [];
            plugin.buttons.buttons = [];
        }
        plugin.buttons.elements.push(element);
        var buttons = [].slice.call(element.getElementsByTagName('button'));
        if (element.tagName === 'BUTTON') {
            buttons.push(element);
        }
        buttons.forEach(function (button) {
            button.setAttribute('data-plugin', plugin.pluginName);
            plugin.buttons.buttons.push(button);
            if (button.name) {
                button.classList.add('disabled');
            }
        });

        return buttons;
    },
    _domFind: function (selector) {
        var elements = [];
        this.popovers.forEach(function (popover) {
            elements = elements.concat([].slice.call(popover.element.querySelectorAll(selector)));
        });
        return elements;
    },
    _toggleDropDownEnabled: function () {
        this.popovers.forEach(function (popover) {
            if (!popover.display) {
                return;
            }
            popover.element.querySelectorAll('.dropdown-menu').forEach(function (dropdown) {
                var classList = dropdown.previousElementSibling.classList;
                if (!dropdown.querySelector('button[name]:not(.disabled)')) {
                    classList.add('disabled');
                } else {
                    classList.remove('disabled');
                }
            });
        });
    },
    _togglePluginButtonEnabled: function (plugin, focusNode, button) {
        if (!focusNode) {
            return ' disabled';
        }
        var enabledMedthodName = plugin.buttons.enabled;
        if (enabledMedthodName) {
            var enabled = true;
            if (typeof enabledMedthodName === 'string') {
                enabled = !!plugin[enabledMedthodName](button.name, focusNode);
            } else {
                enabled = !!enabledMedthodName.call(plugin, button.name, focusNode);
            }
            if (!enabled) {
                return ' disabled';
            }
        }
        return '';
    },
    _togglePluginButtonActive: function (plugin, focusNode, button) {
        if (!focusNode) {
            return '';
        }
        var activeMedthodName = plugin.buttons.active;
        if (activeMedthodName) {
            var active = false;
            if (typeof activeMedthodName === 'string') {
                active = !!plugin[activeMedthodName](button.name, focusNode);
            } else {
                active = !!activeMedthodName.call(plugin, button.name, focusNode);
            }
            if (active) {
                var group = button.parentNode;
                while (group.tagName !== 'GROUP') {
                    group = group.parentNode;
                }
                if (group.tagName === 'GROUP') {
                    var placeholder = group.getElementsByTagName('placeholder')[0];
                    if (placeholder) {
                        placeholder.innerHTML = '';
                        var clone = button.cloneNode(true);
                        clone.removeAttribute('data-method');
                        clone.removeAttribute('data-value');
                        placeholder.appendChild(clone);
                    }
                }
                return ' active';
            }
        }
        return '';
    },
    _updatePluginButton: function (plugin, focusNode, button) {
        button.className = button.className.replace(/(^|\s)\s*(active|disabled)(\s+|$)/g, '\$1');
        var className = button.className;
        className += this._togglePluginButtonEnabled(plugin, focusNode, button);
        if (className.indexOf('disabled') === -1) {
            className += this._togglePluginButtonActive(plugin, focusNode, button);
        }
        button.className = className;
    },
    _updatePopovers: function (range) {
        var self = this;
        this._hasDisplayedPopoverTargetText = false;
        this._hidePopovers();
        if (!range || !this.editable.contains(range.sc)) {
            return;
        }
        this.popovers.forEach(function (popover) {
            var targetRange = popover.checkMethod(range.copy());
            if (!targetRange) {
                return;
            }
            if (utils.isText(targetRange.sc)) {
                self._hasDisplayedPopoverTargetText = true;
                popover.targetText = true;
            }
            popover.element.style.display = 'block';
            popover.display = true;

            self._updatePosition(popover, targetRange);
        });
    },
    _updatePopoverButtons: function (focusNode) {
        var self = this;
        this.popovers.forEach(function (popover) {
            if (!popover.display) {
                return;
            }
            popover.element.querySelectorAll('placeholder').forEach(function (placeholder) {
                placeholder.innerHTML = '';
            });

            var buttons = [].slice.call(popover.element.getElementsByTagName('button'));
            if (popover.element.tagName === 'BUTTON') {
                buttons.push(popover.element);
            }

            buttons.forEach(function (button) {
                if (!button.name) {
                    return;
                }
                self._updatePluginButton(self.dependencies[button.getAttribute('data-plugin')], focusNode, button);
            });
        });
        this._toggleDropDownEnabled();
    },
    /**
     * Update the position of the popover in CSS.
     *
     * @private
     */
    _updatePosition: function (popover, range) {
        var top = 0;
        var popoverElement = popover.element;
        if (popover.targetText) {
            top += parseInt(this.window.getComputedStyle(range.sc.parentNode, null).getPropertyValue('font-size'));
        }
        var position = this.dependencies.Position.getPosition(range.sc, range.so);
        var pos = this.editor.getBoundingClientRect();
        var newPos = {
            left: position.left - pos.left + this.POPOVER_MARGIN_LEFT,
            top: position.top - pos.top + this.POPOVER_MARGIN_TOP + top,
        };
        if (newPos.top < 0) {
            popoverElement.style.display = 'none';
            return;
        }
        var mouse = this.dependencies.Position.getMousePosition();
        var top = mouse.pageY - pos.top;
        var height = 40;
        if (newPos.top <= top && newPos.top + height >= top) {
            newPos.top = top;
        }

        // var $container = $(this.options.container);
        // var containerWidth = $container.width();
        // var containerHeight = $container.height();

        // var popoverWidth = $popover.width();
        // var popoverHeight = $popover.height();

        // var isBeyondXBounds = pos.left + popoverWidth >= containerWidth - this.POPOVER_MARGIN_LEFT;
        // var isBeyondYBounds = pos.top + popoverHeight >= containerHeight - this.POPOVER_MARGIN_TOP;
        // pos = {
        //     left: isBeyondXBounds ?
        //         containerWidth - popoverWidth - this.POPOVER_MARGIN_LEFT :
        //         pos.left,
        //     top: isBeyondYBounds ?
        //         pos.top = containerHeight - popoverHeight - this.POPOVER_MARGIN_TOP :
        //         (pos.top > 0 ? pos.top : this.POPOVER_MARGIN_TOP),
        // };

        popoverElement.style.display = 'block';
        popoverElement.style.left = newPos.left + 'px';
        popoverElement.style.top = (newPos.top + this.POPOVER_MARGIN_TOP) + 'px';
    },
    _updatePositions: function (range) {
        var self = this;
        this.popovers.forEach(function (popover) {
            if (popover.display) {
                self._updatePosition(popover, range);
            }
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onBlur: function () {
        this._onFocusNode(null);
    },
    _onButtonMousedown: function (plugin, ev) {
        ev.preventDefault();
        if (ev.which !== 1) {
            return;
        }
        var button = ev.target;
        while (button !== this.editor && button.tagName !== 'BUTTON') {
            button = button.parentNode;
        }

        if (button.classList.contains('disabled')) {
            return;
        }

        var method = button.getAttribute('data-method');
        var value = button.getAttribute('data-value');
        var popover;
        this.popovers.forEach(function (p) {
            if (p.buttons.indexOf(button) !== -1) {
                popover = p;
            }
        });
        var checkMethod = popover && popover.checkMethod;
        var range = this.dependencies.Range.getRange();
        if (checkMethod) {
            range = checkMethod(range);
            if (!range) {
                return;
            }
        }
        var buttonOptions;
        if (button.getAttribute('options')) {
            buttonOptions = JSON.parse(button.getAttribute('options'));
        }
        this.trigger_up('command', {
            method: plugin[method].bind(plugin),
            args: [value, range],
        });
    },
    /**
     * On change, update the popover position and the active button
     *
     * @private
     */
    _onChange: function () {
        this._onFocusNode(this.dependencies.Range.getFocusedNode());
    },
    /**
     * On change focus node, update the popover position and the active button
     *
     * @private
     */
    _onFocusNode: function (focusNode) {
        var range = this.dependencies.Range.getRange();
        this._updatePopovers(range);
        this._updatePopoverButtons(focusNode);
    },
    /**
     * On keydown or keyup, update the popover position
     *
     * @private
     */
    _onKeyPress: function () {
        this._updatePopovers(this.dependencies.Range.getRange());
    },
    /**
     * @private
     */
    _onRange: function () {
        var self = this;
        if (self._hasDisplayedPopoverTargetText) {
            var range = this.dependencies.Range.getRange();
            this.popovers.forEach(function (popover) {
                if (popover.targetText) {
                    self._updatePosition(popover, range);
                }
            });
        }
    },
    /**
     * @private
     */
    _onScroll: function () {
        self._updatePositions(this.dependencies.Range.getRange());
    },
});

Manager.addPlugin('Popover', PopoverPlugin);

return PopoverPlugin;
});
