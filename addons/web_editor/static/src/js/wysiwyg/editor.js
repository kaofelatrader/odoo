odoo.define('wysiwyg.editor', function (require) {
'use strict';

var Class = require('web.Class');
var mixins = require('web.mixins');
var PluginsManager = require('web_editor.wysiwyg.plugin.manager');
var defaultOptions = require('wysiwyg.options');
var id = 0;
var utils = require('wysiwyg.utils');


var Editor = Class.extend(mixins.EventDispatcherMixin).extend({
    custom_events: {
        wysiwyg_blur: '_onBlurCustom',
        command: '_onCommand',
        get_value: '_onGetValue',
        set_value: '_onSetValue',
    },
    /**
     * @property {Object []} editorEvents
     * {target: {String}, name: {String}, method: {String}}
     */
    editorEvents: {
        'mousedown document': '_onMouseDown',
        'mouseenter document': '_onMouseEnter',
        'mouseleave document': '_onMouseLeave',
        'mousemove document': '_onMouseMove',
        'blur editable': '_onBlurEditable',
        'focus editable': '_onFocusEditable',
        'paste editable': '_onPaste',
    },

    _templates: {},

    init: function (parent, params) {
        var self = this;
        this._super();
        if (!params) {
            params = parent;
            parent = null;
        }
        this.setParent(parent);
        this.id = 'wysiwyg-' + (++id);

        this.editable = document.createElement('editable');
        this.editable.contentEditable = 'true';

        this.editableContainer = []; 
        this.beforeContainer = [];
        this.afterContainer = [];
        this.beforeEditable = [];
        this.afterEditable = [];

        this._saveEventMethods();
        this._prepareOptions(params);

        this._pluginsManager = new PluginsManager(this, {
                id: this.id,
                plugins: this.plugins,
                editable: this.editable,
                addEditableContainer: function (node) {
                    if (self._isInsertEditableInContainers) {
                        throw new Error("Plugin content allready inserted, you can't change the container");
                    } else {
                        self.editableContainer.push(node);
                    }
                },
                insertBeforeContainer: function (node) {
                    if (self._isInsertEditableContainers) {
                        self.editor.insertBefore(node, self.editor.firstChild);
                    } else {
                        self.beforeContainer.push(node);
                    }
                },
                insertAfterContainer: function (node) {
                    if (self._isInsertEditableContainers) {
                        self.editor.appendChild(node);
                    } else {
                        self.afterContainer.push(node);
                    }
                },
                insertBeforeEditable: function (node) {
                    if (self._isInsertEditableInContainers) {
                        self.editable.parentNode.insertBefore(node, self.editable.parentNode.firstChild);
                    } else {
                        self.beforeEditable.push(node);
                    }
                },
                insertAfterEditable: function (node) {
                    if (self._isInsertEditableInContainers) {
                        self.editable.parentNode.appendChild(node);
                    } else {
                        self.afterEditable.push(node);
                    }
                },
            },
            this.options);
    },
    start: function (target) {
        var self = this;
        if (target.wysiwygEditor) {
            target.wysiwygEditor.destroy();
        }
        this.target = target;
        this.target.wysiwygEditor = this;
        this.target.dataset.dataWysiwygId = this.id;

        return this.isInitialized().then(function () {
            if (self._isDestroyed) {
                return;
            }
            self._insertEditorContainers();
            self._insertEditableInContainers();
            return self._pluginsManager.start();
        }).then(function () {
            if (self._isDestroyed) {
                return;
            }
            return self._afterStartAllPlugins();
        });
    },
    destroy: function () {
        this._isDestroyed = true;
        if (this.editor && this.editor.parentNode) {
            this.editor.parentNode.removeChild(this.editor);
            this._destroyEvents();
        }
        if (this.target) {
            this.target.wysiwygEditor = null;
            this.target.style.display = '';
        }
        this._super();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Cancel the edition and destroy the editor.
     */
    cancel: function () {
        this._pluginsManager.cancelEditor();
        this.destroy();
    },
    /**
     * Set the focus on the element.
     */
    focus: function () {
        $(this.editable).mousedown();
        this.editable.focus();
    },
    /**
     * Get the value of the editable element.
     *
     * @returns {String}
     */
    getValue: function () {
        var $editable = $(this.editable).clone();
        $editable.find('.o_wysiwyg_to_remove').remove();
        $editable.find('[contenteditable]').removeAttr('contenteditable');
        $editable.find('.o_fake_not_editable').removeClass('o_fake_not_editable');
        $editable.find('.o_fake_editable').removeClass('o_fake_editable');
        $editable.find('[class=""]').removeAttr('class');
        $editable.find('[style=""]').removeAttr('style');
        $editable.find('[title=""]').removeAttr('title');
        $editable.find('[alt=""]').removeAttr('alt');
        // $editable.find('a.o_image, span.fa, i.fa').html('');
        $editable.find('[aria-describedby]').removeAttr('aria-describedby').removeAttr('data-original-title');

        return this._pluginsManager.getEditorValue($editable.html());
    },
    /**
     * Return true if the content has changed.
     *
     * @returns {Boolean}
     */
    isDirty: function () {
        var isDirty = this._value !== this.getValue();
        if (!this._dirty && isDirty) {
            console.warn("not dirty flag ? Please fix it.");
        }
        return isDirty;
    },
    isInitialized: function () {
        return this._pluginsManager.isInitialized();
    },
    /**
     * Save the content in the target
     *      - in init option beforeSave
     *      - receive editable jQuery DOM as attribute
     *      - called after deactivate codeview if needed
     * @returns {$.Promise}
     *      - resolve with true if the content was dirty
     */
    save: function () {
        var self = this;
        var isDirty = this.isDirty();
        return this._pluginsManager.saveEditor(this.getValue()).then(function (html) {
            self.target.innerText = html;
            self.target.innerHTML = html;
            return {
                isDirty: isDirty,
                value: html,
            };
        });
    },
    /**
     * @param {String} value
     */
    setValue: function (value) {
        this.reset(value);
        this._dirty = true;
        this.trigger_up('change');
    },
    reset: function (value) {
        this.editable.innerHTML = value || '';
        this.editable.innerHTML = this._pluginsManager.setEditorValue(value || '');
        this._dirty = false;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Bind the events defined in the editorEvents property.
     *
     * @private
     */
    _bindEvents: function () {
        var self = this;
        this.editorEvents.forEach(function (event) {
            if (event.target === 'document') {
                window.top.document.addEventListener(event.name, event.method, true);
                self.editable.ownerDocument.addEventListener(event.name, event.method, false);
            } else {
                self[event.target].addEventListener(event.name, event.method, false);
            }
        });
    },
    _insertEditorContainers: function () {
        this._isInsertEditableContainers = true;
        this.editor = document.createElement('editor');
        this.editor.style.display = 'none';
        this.editor.id = this.id;
        if (this.target.nextSibling) {
            this.target.parentNode.insertBefore(this.editor, this.target.nextSibling);
        } else if (this.target.parentNode) {
            this.target.parentNode.appendChild(this.editor);
        } else {
            console.info("Can't insert this editor on a node without any parent");
        }
        var node;
        var editableContainer = this.editor;
        while (node = this.beforeContainer.pop()) {
            this.editor.appendChild(node);
        }
        while (node = this.editableContainer.shift()) {
            editableContainer.appendChild(node);
            editableContainer = node;
        }
        while (node = this.afterContainer.pop()) {
            this.editor.appendChild(node);
        }
        this.editableContainer = editableContainer;
    },
    _insertEditableInContainers: function () {
        this._isInsertEditableInContainers = true;
        var node;
        while (node = this.beforeEditable.pop()) {
            this.editableContainer.appendChild(node);
        }
        this.editableContainer.appendChild(this.editable);
        while (node = this.afterEditable.shift()) {
            this.editableContainer.appendChild(node);
        }
    },
    /**
     * Freeze an object and all its properties and return the frozen object.
     *
     * @private
     * @param {Object} object
     * @returns {Object}
     */
    _deepFreeze: function (object) {
        var self = this;
        // Retrieve the property names defined on object
        var propNames = Object.getOwnPropertyNames(object);

        // Freeze properties before freezing self
        propNames.forEach(function (name) {
            var value = object[name];
            if (value && typeof value === "object" && (typeof object.style !== "object" || typeof object.ownerDocument !== "object")) {
                object[name] = self._deepFreeze(value);
            } else {
                object[name] = value;
            }
        });

        return Object.freeze(object);
    },
    /**
     * Destroy all events defined in `editorEvents`.
     */
    _destroyEvents: function () {
        var self = this;
        this.editorEvents.forEach(function (event) {
            if (event.target === 'document') {
                window.top.document.removeEventListener(event.name, event.method, true);
                self.editable.removeEventListener(event.name, event.method, false);
            } else {
                self[event.target].removeEventListener(event.name, event.method, false);
            }
        });
    },
    /**
     * Return a list of the descendents of the current object.
     *
     * @private
     */
    _getDecendents: function () {
        var children = this.getChildren();
        var descendents = [];
        var child;
        while ((child = children.pop())) {
            descendents.push(child);
            children = children.concat(child.getChildren());
        }
        return descendents;
    },
    /**
     * Method to call after completion of the `start` method.
     *
     * @private
     */
    _afterStartAllPlugins: function () {
        this.target.style.display = 'none';
        this.editor.style.display = '';
        this._value = this.target[this.target.tagName === "TEXTAREA" ? 'value' : 'innerHtml'];
        this.reset(this._value);
        this._bindEvents();
    },
    /**
     * Return true if the given node is in the editor.
     * Note: a button in the MediaDialog returns true.
     *
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    _isEditorContent: function (node) {
        if (this.editor === node || this.editor.contains(node)) {
            return true;
        }

        var descendents = this._getDecendents().map(function (obj) {
            return Object.values(obj);
        });
        descendents = utils.uniq(utils.flatten(descendents));
        var childrenDom = descendents.filter(function (pluginNode) {
            return pluginNode && pluginNode.DOCUMENT_NODE &&
                pluginNode.tagName && pluginNode.tagName !== 'BODY' && pluginNode.tagName !== 'HTML' &&
                utils.isDescendentOf(node, pluginNode);
        });
        return !!childrenDom.length;
    },
    /**
     * Return the last added, non-null element in an array.
     *
     * @private
     * @param {any []} array
     * @returns {any}
     */
    _unstack: function (array) {
        var result = null;
        for (var k = array.length - 1; k >= 0; k--) {
            if (array[k] !== null) {
                result = array[k];
                break;
            }
        }
        return result;
    },
    /**
     * @todo Remove JQuery
     * @private
     * @param {Object} params
     */
    _prepareOptions: function (params) {
        var self = this;
        var defaults = JSON.parse(JSON.stringify(defaultOptions));
        utils.defaults(params, defaults);
        utils.defaults(params.env, defaults.env);
        utils.defaults(params.plugins, defaults.plugins);
        utils.defaults(params, {
            loadTemplates: this._loadTemplates.bind(this),
            renderTemplate: this._renderTemplate.bind(this),
            translateTemplateNodes: this._translateTemplateNodes.bind(this),
            translate: this._translateString.bind(this),
        });

        var renderTemplate = params.renderTemplate;
        params.renderTemplate = function (pluginName, template, values) {
            var fragment = document.createElement('fragment');
            fragment.innerHTML = renderTemplate(pluginName, template, values);
            self.options.translateTemplateNodes(pluginName, fragment);
            return fragment.innerHTML;
        },
        params.hasFocus = function () {return self._isFocused;};

        this.plugins = params.plugins;
        delete params.plugins;
        this.options = this._deepFreeze(params);
    },
    /**
     * @param {string[]} templatesDependencies
     * @returns {Promise}
     */
    _loadTemplates: function (templatesDependencies) {
        var promises = [];
        var xmlPath;
        while ((xmlPath = templatesDependencies.shift())) {
            var promise = new Promise(function (resolve) {
                $.get(xmlPath, function (html) {
                    var fragment = document.createElement('fragment');
                    fragment.innerHTML = html;
                    fragment.querySelectorAll('[t-name]').forEach(function (template) {
                        var templateName = template.getAttribute('t-name');
                        template.removeAttribute('t-name');
                        this._templates[templateName] = template.outerHTML;
                    });
                }).then(resolve);
            });
            promises.push(promise);
        }
        return Promise.all(promises);
    },
    /**
     * @param {string} pluginName
     * @param {string} template
     * @param {any} values
     * @returns {string}
     */
    _renderTemplate: function (pluginName, template, values) {
        return this._templates[template];
    },
    /**
     * @param {string} pluginName
     * @param {element} node
     * @returns {string}
     */
    _translateTemplateNodes: function (pluginName, node) {
        var self = this;
        var regExpText = /^([\s\n\r\t]*)(.*?)([\s\n\r\t]*)$/;
        (function translateNodes(elem) {
            if (elem.attributes) {
                Object.values(elem.attributes).forEach(function (attribute) {
                    if (attribute.name === 'title' || attribute.name === 'alt' || attribute.name === 'help') {
                        var text = attribute.value.match(regExpText);
                        if (text && text[2].length) {
                            var value = text[1] + self.options.translate(pluginName, text[2]) + text[3];
                            value = self._pluginsManager.translatePluginString(pluginName, value, text[2], elem, attribute.name);
                            attribute.value = value;
                        }
                    }
                });
            }

            var nodes = elem.childNodes;
            var i = nodes.length;
            while (i--) {
                var node = nodes[i];
                if (node.nodeType == 3) {
                    var text = node.nodeValue.match(regExpText);
                    if (text && text[2].length) {
                        var value = text[1] + self.options.translate(pluginName, text[2]) + text[3];
                        value = self._pluginsManager.translatePluginString(pluginName, value, text[2], node, 'nodeValue');
                        node.nodeValue = value;
                    }
                } else if (node.nodeType == 1 || node.nodeType == 9 || node.nodeType == 11) {
                    translateNodes(node);
                }
            }
        })(node);
    },
    /**
     * @param {string} pluginName
     * @param {string} string
     * @returns {string}
     */
    _translateString: function (pluginName, string) {
        string = string.replace(/\s\s+/g, ' ');
        if (this.options.lang && this.options.lang[string]) {
            return this.options.lang[string];
        }
        console.warn("Missing translation: " + string);
        return string;
    },
    /**
     * Save all event methods defined in editorEvents for safe destruction.
     *
     * @private
     */
    _saveEventMethods: function () {
        var self = this;
        var events = [];
        Object.keys(this.editorEvents).forEach(function (key) {
            var parts = key.split(' ');
            events.push({
                name: parts[0],
                target: parts[1],
                method: self[self.editorEvents[key]].bind(self),
            });
        });
        this.editorEvents = events;
    },
    _mouseEventFocus: function () {
        this._onMouseDownTime = null;
        if (!this._editableHasFocus && !this._isEditorContent(document.activeElement)) {
            $(this.editable).focus();
        }
        if (!this._isFocused) {
            this._isFocused = true;
            this._onFocus();
        }
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    /**
     * trigger_up 'blur'.
     *
     * @private
     * @param {Object} [options]
     */
    _onBlur: function (options) {
        this._pluginsManager.blurEditor();
        this.trigger_up('blur', options);
    },
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onBlurEditable: function () {
        var self = this;
        this._editableHasFocus = false;
        if (!this._isFocused) {
            return;
        }
        if (!this._justFocused && !this._mouseInEditor) {
            if (this._isFocused) {
                this._isFocused = false;
                this._onBlur();
            }
        } else if (!this._forceEditableFocus) {
            this._forceEditableFocus = true;
            setTimeout(function () {
                if (!self._isEditorContent(document.activeElement)) {
                    $(self.editable).focus();
                }
                self._forceEditableFocus = false; // prevent stack size exceeded.
            });
        } else {
            this._mouseInEditor = null;
        }
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onBlurCustom: function (ev) {
        ev.stopPropagation();
        this._isFocused = false;
        this._forceEditableFocus = false;
        this._mouseInEditor = false;
        this._summernote.disable();
        this.$target.focus();
        setTimeout(this._summernote.enable.bind(this._summernote));
        this._onBlur(ev.data);
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onCommand: function (ev) {
        var self = this;
        ev.stopPropagation();
        if (ev.data.disableRange) {
            this._pluginsManager.call('Range', 'clear');
        } else {
            this._pluginsManager.call('Range', 'save');
        }
        Promise.all([ev.data.method.apply(null, ev.data.args)]).then(function (result) {
            if (!ev.data.disableRange) {
                self._pluginsManager.call('Range', 'restore');
            }
            if (result && result.noChange) {
                return;
            }
            self._pluginsManager.changeEditorValue();
            self.trigger_up('change');
            if (ev.data.callback) {
                ev.data.callback(result);
            }
        });
    },
    /**
     * trigger_up 'wysiwyg_focus'.
     *
     * @private
     * @param {Object} [options]
     */
    _onFocus: function (options) {
        this._pluginsManager.focusEditor();
        this.trigger_up('focus', options);
    },
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onFocusEditable: function () {
        var self = this;
        this._editableHasFocus = true;
        this._justFocused = true;
        setTimeout(function () {
            self._justFocused = true;
        });
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @return {any}
     */
    _onGetValue: function (ev) {
        return ev.data.callback(this.getValue());
    },
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onMouseDown: function (ev) {
        var self = this;
        if (this._isEditorContent(ev.target)) {
            this._mouseEventFocus();
            this._onMouseDownTime = setTimeout(this._mouseEventFocus.bind(this));
        } else if (this._isFocused) {
            this._isFocused = false;
            this._onBlur();
        }
    },
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onMouseEnter: function (ev) {
        if (this._isFocused && !this._mouseInEditor && this._isEditorContent(ev.target)) {
            this._mouseInEditor = true;
        }
    },
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onMouseLeave: function () {
        if (this._isFocused && this._mouseInEditor) {
            this._mouseInEditor = null;
        }
    },
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onMouseMove: function (ev) {
        if (this._mouseInEditor === null) {
            this._mouseInEditor = !!this._isEditorContent(ev.target);
        }
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onPaste: function (ev) {
        ev.preventDefault();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onSetValue: function (ev) {
        this.setValue(ev.data.value);
    },
});

return Editor;

});
