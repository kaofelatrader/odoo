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
 * - save
 * - cancel
 */


var Editor = Class.extend(mixins.EventDispatcherMixin).extend({
    custom_events: {
        wysiwyg_blur: '_onBlurCustom',
        command: '_onCommand',
        get_value: '_onGetValue',
        set_value: '_onSetValue',
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
            return self._initialized();
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

        $(document).off('.' + this.id);
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
    cancel: function () {
        this._pluginsManager.triggerEach('cancel');
        this.destroy();
    },
    /**
     * Get the value of the editable element.
     *
     * @returns {String}
     */
    getValue: function () {
        var $editable = $(this.editable).clone();

        var result = this._compactResults(this._pluginsManager.triggerEach('getValue', $editable));
        if (result !== null) {
            return result;
        }

        $editable.find('.o_wysiwyg_to_remove').remove();
        $editable.find('[contenteditable]').removeAttr('contenteditable');
        $editable.find('.o_fake_not_editable').removeClass('o_fake_not_editable');
        $editable.find('.o_fake_editable').removeClass('o_fake_editable');
        $editable.find('[class=""]').removeAttr('class');
        $editable.find('[style=""]').removeAttr('style');
        $editable.find('[title=""]').removeAttr('title');
        $editable.find('[alt=""]').removeAttr('alt');
        $editable.find('a.o_image, span.fa, i.fa').html('');
        $editable.find('[aria-describedby]').removeAttr('aria-describedby').removeAttr('data-original-title');
        $editable.find(utils.formatTags.join(',')).filter(function (node) {
            return !node.firstChild;
        }).remove();
        return $editable.html() || $editable.val();
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
        var html = this.getValue();
        var results = this._pluginsManager.triggerEach('save');
        results.unshift(html);
        return Promise.all(results).then(function (results) {
            var html = self._compactResults(results);
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
        this._pluginsManager.triggerEach('setValue', value);
        this.trigger_up('change');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _compactResults: function (results) {
        var result = null;
        for (var k = results.length - 1; k >= 0; k--) {
            if (results[k] !== null) {
                result = results[k];
                break;
            }
        }
        return result;
    },
    _deepFreeze: function (object) {
        // Retrieve the property names defined on object
        var propNames = Object.getOwnPropertyNames(object);

        // Freeze properties before freezing self
        for (var name of propNames) {
            var value = object[name];
            if (value && typeof value === "object" && (typeof object.style !== "object" || typeof object.ownerDocument !== "object")) {
                object[name] = this._deepFreeze(value);
            } else {
                object[name] = value;
            }
        }

        return Object.freeze(object);
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
        if (this.editor === node) {
            return true;
        }
        if ($.contains(this.editor, node)) {
            return true;
        }

        var children = this.getChildren();
        var allChildren = [];
        var child;
        while ((child = children.pop())) {
            allChildren.push(child);
            children = children.concat(child.getChildren());
        }

        var childrenDom = _.filter(_.unique(_.flatten(_.map(allChildren, function (obj) {
            return _.map(obj, function (value) {
                return value instanceof $ ? value.get() : value;
            });
        }))), function (node) {
            return node && node.DOCUMENT_NODE && node.tagName && node.tagName !== 'BODY' && node.tagName !== 'HTML';
        });
        return !!$(node).closest(childrenDom).length;
    },
    _prepareOptions: function (params) {
        var self = this;
        var defaults = JSON.parse(JSON.stringify(defaultOptions));
        _.defaults(params, defaults);
        _.defaults(params.plugins, defaults.plugins);
        _.defaults(params.popover, defaults.popover);
        _.defaults(params.keyMap.pc, defaults.keyMap.pc);
        _.defaults(params.keyMap.mac, defaults.keyMap.mac);

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
    _initialized: function () {
        var self = this;
        $(this.target).after(this.editor);
        $(this.target).hide();

        this.once('change', this, function (ev) {
            ev.stopPropagation();
            self._dirty = false;
        });

        this._value = $(this.target)[this.target.tagName === "TEXTAREA" ? 'val' : 'html']();
        this.setValue(this._value);

        $(document).on('mousedown.' + this.id, this._onMouseDown.bind(this));
        $(document).on('mouseenter.' + this.id, '*', this._onMouseEnter.bind(this));
        $(document).on('mouseleave.' + this.id, '*', this._onMouseLeave.bind(this));
        $(document).on('mousemove.' + this.id, this._onMouseMove.bind(this));
        $(this.editable).on('blur', this._onBlurEditable.bind(this));
        $(this.editable).on('focus', this._onFocusEditable.bind(this));
        $(this.editable).on('paste', function (ev) {
            ev.preventDefault();
        });
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
        this._pluginsManager.triggerEach('blur');
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
            self._pluginsManager.triggerEach('change');
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
        this._pluginsManager.triggerEach('focus');
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
    _onSetValue: function (ev) {
        this.setValue(ev.data.value);
    },
});

return Editor;

});
