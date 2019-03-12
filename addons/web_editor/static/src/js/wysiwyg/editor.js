odoo.define('wysiwyg.editor', function (require) {
'use strict';

var Class = require('web.Class');
var mixins = require('web.mixins');
var PluginsManager = require('web_editor.wysiwyg.plugin.manager');
var defaultOptions = require('wysiwyg.options');
var id = 0;
var utils = require('wysiwyg.utils');

/*
 * trigger on each plugins
 * - getValue
 * - setValue
 * - change
 * - save
 * - cancel
 * - translate
 * - blurEditor
 * - focusEditor
 */


var Editor = Class.extend(mixins.EventDispatcherMixin).extend({
    custom_events: {
        wysiwyg_blur: '_onBlurCustom',
        command: '_onCommand',
        get_value: '_onGetValue',
        set_value: '_onSetValue',
    },
    /**
     * @property {Object []} editor_events
     * {target: {String}, name: {String}, method: {String}}
     */
    editor_events: {
        'mousedown document': '_onMouseDown',
        'mouseenter document': '_onMouseEnter',
        'mouseleave document': '_onMouseLeave',
        'mousemove document': '_onMouseMove',
        'blur editable': '_onBlurEditable',
        'focus editable': '_onFocusEditable',
        'paste editable': '_onPaste',
    },

    init: function (parent, target, params) {
        this._super();
        if (!params) {
            params = target;
            target = parent;
            parent = null;
        }
        this.setParent(parent);
        this.id = 'wysiwyg-' + (++id);

        this.target = target;
        this.document = this.target.ownerDocument;
        this.window = this.document.defaultView;

        this.editor = this.document.createElement('editor');
        this.editor.id = this.id;
        this.editable = this.document.createElement('editable');
        this.editable.contentEditable = 'true';

        this._saveEventMethods();
        this._prepareOptions(params);
    },
    start: function () {
        var self = this;

        var instance = $(this.target).data('wysiwyg');
        if (instance) {
            if (instance === this) {
                return this.promise;
            }
            $(this.target).data('wysiwyg').destroy();
        }

        $(this.target).data('wysiwyg', this).attr('data-wysiwyg-id', this.id);

        this._pluginsManager = new PluginsManager(this, {
                plugins: this.plugins,
                target: this.target,
                editor: this.editor,
                editable: this.editable,
            },
            this.params);

        this.editor.innerHTML = '';
        this.editor.appendChild(this.editable);

        this.promise = this._pluginsManager.start().then(function () {
            if (self._isDestroyed) {
                return;
            }
            return self._afterStart();
        });

        return this.promise;
    },
    destroy: function () {
        this._isDestroyed = true;
        if (this.editor.parentNode) {
            this.editor.parentNode.removeChild(this.editor);
        }
        $(this.target).removeData('wysiwyg');
        $(this.target).show();

        this._destroyEvents();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

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
    /**
     * Cancel the edition and destroy the editor.
     */
    cancel: function () {
        this._pluginsManager.cancelEditor();
        this.destroy();
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
        $editable.find(utils.formatTags.join(',')).filter(function () {
            return !this.firstChild;
        }).remove();

        return this._pluginsManager.getEditorValue($editable.html());
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
     * @returns {String}
     */
    setValue: function (value) {
        this._dirty = true;
        this.editable.innerHTML = value || '';
        this.editable.innerHTML = this._pluginsManager.setEditorValue(value || '');
        this.trigger_up('change');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Bind the events defined in the editor_events property.
     *
     * @private
     */
    _bindEvents: function () {
        this.editor_events.forEach(function (event) {
            event.target.addEventListener(event.name, event.method);
        });
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
     * Destroy all events defined in `editor_events`.
     */
    _destroyEvents: function () {
        this.editor_events.forEach(function (event) {
            event.target.removeEventListener(event.name, event.method);
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
    _afterStart: function () {
        var self = this;
        if (this.target && this.target.parentNode) {
            this.target.parentNode.insertBefore(this.editor, this.target.nextSibling);
            this.target.style.display = 'none';
        }

        this.once('change', this, function (ev) {
            ev.stopPropagation();
            self._dirty = false;
        });

        this._value = this.target[this.target.tagName === "TEXTAREA" ? 'value' : 'innerHtml'];
        this.setValue(this._value);

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
        var childrenDom = descendents.filter(function (node) {
            return node && node.DOCUMENT_NODE && node.tagName && node.tagName !== 'BODY' && node.tagName !== 'HTML';
        });
        return utils.isDescendentOf(node, childrenDom);
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

        var templates = {};
        utils.defaults(params, {
            /**
             * @param {string[]} templatesDependencies
             * @returns {Promise}
             */
            loadTemplates: function (templatesDependencies) {
                var defs = [];
                var xmlPath;
                while ((xmlPath = templatesDependencies.shift())) {
                    defs.push($.get(xmlPath, function (html) {
                        var fragment = document.createElement('fragment');
                        fragment.innerHTML = html;
                        fragment.querySelectorAll('[t-name]').forEach(function (template) {
                            var templateName = template.getAttribute('t-name');
                            template.removeAttribute('t-name');
                            templates[templateName] = template.outerHTML;
                        });
                    }));
                }
                return $.when.apply($, defs);
            },

            /**
             * @param {string} template
             * @param {any} values
             * @returns {string}
             */
            renderTemplate: function (pluginName, template, values) {
                var html = templates[template];
                var fragment = document.createElement('fragment');
                fragment.innerHTML = html;
                return fragment.innerHTML;
            },

            translateTemplateNodes: function (pluginName, node) {
                var params = this;
                var regExpText = /^([\s\n\r\t]*)(.*?)([\s\n\r\t]*)$/;
                (function translateNodes(elem) {
                    if (elem.attributes) {
                        Object.values(elem.attributes).forEach(function (attribute) {
                            if (attribute.name === 'title' || attribute.name === 'alt' || attribute.name === 'help') {
                                var text = attribute.value.match(regExpText);
                                if (text) {
                                    var value = text[1] + params.translate(pluginName, text[2]) + text[3];
                                    value = self._pluginsManager.translatePluginValue(pluginName, value, text[2], elem, attribute.name);
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
                            if (text) {
                                var value = text[1] + params.translate(pluginName, text[2]) + text[3];
                                value = self._pluginsManager.translatePluginValue(pluginName, value, text[2], node, 'nodeValue');
                                node.nodeValue = value;
                            }
                        } else if (node.nodeType == 1 || node.nodeType == 9 || node.nodeType == 11) {
                            translateNodes(node);
                        }
                    }
                })(node);
            },

            /**
             * @param {string}
             * @returns {string}
             */
            translate: function (pluginName, string) {
                string = string.replace(/\s\s+/g, ' ');
                if (params.lang && params.lang[string]) {
                    return params.lang[string];
                }
                console.warn("Missing translation: " + string);
                return string;
            },
        });

        if (!params.hasFocus) {
            params.hasFocus = function () {
                return self._isFocused;
            };
        }

        /**
         * Return true if the current node is unbreakable.
         * An unbreakable node can be removed or added but can't by split into
         * different nodes (for keypress and selection).
         * An unbreakable node can contain nodes that can be edited.
         *
         * @param {Node} node
         * @returns {Boolean}
         */
        var _isUnbreakableNode = params.isUnbreakableNode;
        params.isUnbreakableNode = function (node) {
            node = node && (node.tagName ? node : node.parentNode);
            if (!node) {
                return true;
            }
            return ["TD", "TR", "TBODY", "TFOOT", "THEAD", "TABLE"].indexOf(node.tagName) !== -1 ||
                        $(node).is(self.editable) ||
                        !params.isEditableNode(node.parentNode) ||
                        !params.isEditableNode(node) ||
                        (_isUnbreakableNode && _isUnbreakableNode(node));
        };

        /**
         * Return true if the current node is editable (for keypress and selection).
         *
         * @param {Node} node
         * @returns {Boolean}
         */
        var _isEditableNode = params.isEditableNode;
        params.isEditableNode = function (node) {
            node = node && (node.tagName ? node : node.parentNode);
            if (!node) {
                return false;
            }
            return !$(node).is('table, thead, tbody, tfoot, tr')
                && (!_isEditableNode || _isEditableNode(node));
        };

        this.plugins = params.plugins;
        delete params.plugins;
        this.params = this._deepFreeze(params);
    },
    /**
     * Save all event methods defined in editor_events for safe destruction.
     *
     * @private
     */
    _saveEventMethods: function () {
        var self = this;
        var events = [];
        Object.keys(this.editor_events).forEach(function (key) {
            var parts = key.split(' ');
            events.push({
                name: parts[0],
                target: parts[1] === 'document' ? document : self[parts[1]],
                method: self[self.editor_events[key]].bind(self),
            });
        });
        this.editor_events = events;
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    /**
     * trigger_up 'wysiwyg_blur'.
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
            setTimeout(function () {
                if (!self._editableHasFocus && !self._isEditorContent(document.activeElement)) {
                    $(self.editable).focus();
                }
                if (!self._isFocused) {
                    self._isFocused = true;
                    self._onFocus();
                }
            });
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
