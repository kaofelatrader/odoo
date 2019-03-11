odoo.define('wysiwyg.plugin.ui.popover', function (require) {
'use strict';

var core = require('web.core');
var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var utils = require('wysiwyg.utils');

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
    };
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
        'blurEditor': '_onBlurEditor',
    },

    POPOVER_MARGIN_LEFT: 5,
    POPOVER_MARGIN_TOP: 5,

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
        group.innerHTML = this.options.renderTemplate(plugin.pluginName, plugin.buttons.template, {
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
        this._addButtonHandlersEvents(plugin, element);
        this._addButtonHandlersDataMethod(plugin, element);
        this._addButtonHandlersDropdown(element);

        // prevent all click (avoid href...)
        element.addEventListener('mousedown', function (ev) {
            ev.preventDefault();
        }, false);
        element.addEventListener('click', function (ev) {
            ev.preventDefault();
        }, false);
    },
    _addButtonHandlersEvents: function (plugin, element) {
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
    },
    _addButtonHandlersDataMethod: function (plugin, element) {
        var _onButtonMousedown = this._onButtonMousedown.bind(this, plugin);
        if (!element.getAttribute('data-method')) {
            _onButtonMousedown = handleSelector(element, 'button[data-method]', _onButtonMousedown);
        }
        element.addEventListener('mousedown', _onButtonMousedown, false);
    },
    _addButtonHandlersDropdown: function (element) {
        var dropdowns = element.tagName === 'DROPDOWN' ? [element] : element.querySelectorAll('dropdown');
        dropdowns.forEach(function (dropdown) {
            var toggler = dropdown.querySelector('toggler');
            var dropdownContents = dropdown.lastElementChild;
            dropdownContents.style.display = 'none';

            var mousedownCloseDropdown = function (ev) {
                if (!dropdown.contains(ev.target)) {
                    dropdownContents.style.display = 'none';
                    document.removeEventListener('click', mousedownCloseDropdown);
                }
            }

            dropdown.addEventListener('click', function () {
                var open = dropdownContents.style.display !== 'none';
                if (!toggler.classList.contains('disabled')) {
                    dropdownContents.style.display = open ? 'none' : '';
                    document.addEventListener('click', mousedownCloseDropdown, false);
                } else if (open) {
                    dropdownContents.style.display = 'none';
                }
            }, false);
        });
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
            popover.element.querySelectorAll('dropdown').forEach(function (dropdown) {
                var toggler = dropdown.querySelector('toggler');
                var dropdownContents = dropdown.lastElementChild;
                toggler.classList.toggle('disabled', !dropdownContents.querySelector('button[name]:not(.disabled)'));
            });
        });
    },
    _togglePluginButtonToggle: function (plugin, focusNode, buttonName, methodName) {
        var enabledMedthodName = plugin.buttons[methodName];
        if (enabledMedthodName) {
            var active = true;
            if (typeof enabledMedthodName === 'string') {
                active = !!plugin[enabledMedthodName](buttonName, focusNode);
            } else {
                active = !!enabledMedthodName.call(plugin, buttonName, focusNode);
            }
            if (active) {
                return true;
            }
        }
        return focusNode ? null : false;
    },
    _updatePluginButton: function (plugin, focusNode, button) {
        var enabled = this._togglePluginButtonToggle(plugin, focusNode, button.name, 'enabled');
        if (enabled || enabled === null) {
            button.classList.remove('disabled');
            var active = this._togglePluginButtonToggle(plugin, focusNode, button.name, 'active');
            if (active) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        } else {
            button.classList.add('disabled');
        }
    },
    _updatePluginPlaceholder: function (plugin, focusNode, button) {
        this.popovers.forEach(function (popover) {
            popover.element.querySelectorAll('dropdown').forEach(function (dropdown) {
                var placeholder = dropdown.querySelector('placeholder');
                if (!placeholder || dropdown.querySelector('toggler').classList.contains('disabled')) {
                    return;
                }

                placeholder.innerHTML = '';
                var activeButton = dropdown.querySelector('button.active');
                if (!activeButton) {
                    return;
                }

                var clone = activeButton.cloneNode(true);
                clone.removeAttribute('data-method');
                clone.removeAttribute('data-value');
                clone.classList.remove('active');
                placeholder.appendChild(clone);
            });
        });
    },
    _updatePopovers: function (range) {
        var self = this;
        this._hasDisplayedPopoverTargetText = false;
        this._hidePopovers();
        if (!range || !this.editable.contains(range.sc)) {
            return;
        }
        this.popovers.forEach(function (popover) {
            self._updatePopover(popover, range);
            if (popover.targetText) {
                self._hasDisplayedPopoverTargetText = true;
            }
        });
        this._updatePositionAvoidOverlap();
    },
    _updatePopover: function (popover, range) {
        var targetRange = popover.checkMethod(range.copy());
        if (!targetRange) {
            popover.targetRange = null;
            return;
        }
        if (utils.isText(targetRange.sc)) {
            popover.targetText = true;
        }
        popover.display = true;
        popover.targetRange = targetRange;

        this._updatePosition(popover, range);
    },
    _updatePopoverButtons: function (focusNode) {
        var self = this;
        this.popovers.forEach(function (popover) {
            if (!popover.display) {
                return;
            }

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
        this._updatePluginPlaceholder();
    },
    /**
     * Update the position of the popover in CSS.
     *
     * @private
     */
    _updatePosition: function (popover, range) {
        var targetRange = popover.targetRange;
        var popoverElement = popover.element;
        var top = this.POPOVER_MARGIN_TOP;

        if (popover.targetText) {
            targetRange = range;
            var fontSize = this.window.getComputedStyle(targetRange.sc.parentNode, null).getPropertyValue('font-size');
            top += parseInt(fontSize);
        } else if (targetRange.sc !== range.sc && targetRange.sc.contains(range.sc)) {
            top += targetRange.sc.offsetHeight;
        }

        var position = this.dependencies.Position.getPosition(targetRange.sc, targetRange.so);
        var pos = this.editor.getBoundingClientRect();
        var newPos = {
            left: position.left - pos.left + this.POPOVER_MARGIN_LEFT,
            top: position.top - pos.top + top,
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
        popoverElement.style.top = newPos.top + 'px';
    },
    _updatePositions: function (range) {
        var self = this;
        this.popovers.forEach(function (popover) {
            if (popover.display) {
                self._updatePosition(popover, range);
            }
        });
        this._updatePositionAvoidOverlap();
    },
    _updatePositionAvoidOverlap: function () {
        var popovers = [];
        this.popovers.forEach(function (popover) {
            if (popover.display) {
                popovers.push(popover);
            }
        });
        popovers.sort(function (a, b) {
            return a.targetRange.sc.contains(b.targetRange.sc) ? 1 : -1;
        });
        var bottom = 0;
        popovers.forEach(function (popover) {
            var pos = popover.element.getBoundingClientRect();
            var top = parseInt(popover.element.style.top);
            if (top < bottom) {
                popover.element.style.top = bottom + 'px';
            } else {
                bottom = top;
            }
            bottom += pos.height;
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onBlurEditor: function () {
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
            disableRange: plugin.disableRange,
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
        if (this._hasDisplayedPopoverTargetText) {
            var range = this.dependencies.Range.getRange();
            this.popovers.forEach(function (popover) {
                if (popover.targetText) {
                    self._updatePosition(popover, range);
                }
            });
            this._updatePositionAvoidOverlap();
        }
    },
    /**
     * @private
     */
    _onScroll: function () {
        this._updatePositions(this.dependencies.Range.getRange());
    },
});

Manager.addPlugin('Popover', PopoverPlugin);

return PopoverPlugin;
});
