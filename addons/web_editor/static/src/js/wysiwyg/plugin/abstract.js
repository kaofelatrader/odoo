odoo.define('web_editor.wysiwyg.plugin.abstract', function (require) {
'use strict';

var BoundaryPoint = require('wysiwyg.BoundaryPoint');
var Class = require('web.Class');
var Dom = require('wysiwyg.Dom');
var mixins = require('web.mixins');
var ServicesMixin = require('web.ServicesMixin');
var utils = require('wysiwyg.utils');

//--------------------------------------------------------------------------
// AbstractPlugin for summernote module API
//--------------------------------------------------------------------------

var $ = require('web_editor.jquery');
var _ = require('web_editor._');


var AbstractPlugin = Class.extend(mixins.EventDispatcherMixin, ServicesMixin).extend({
    templatesDependencies: [],
    dependencies: [],

    editableDomEvents: null,
    pluginEvents: null,

    /**
     * Use this prop if you want to extend a summernote plugin.
     */
    init: function (parent, params, options) {
        var self = this;
        this._super.apply(this, arguments);
        this.setParent(parent);

        this.options = options;

        this.editor = params.editor;
        this.editable = params.editable;
        this.document = this.editor.ownerDocument;
        this.window = this.document.defaultView;
        this.utils = utils;

        this.utils = utils;
        this.dom = new Dom(this.options);

        var editableDomEvents = Object.assign({}, this.editableDomEvents);
        Object.keys(editableDomEvents).forEach(function (key) {
            var value = editableDomEvents[key];
            if (typeof value === 'string') {
                value = self[value].bind(self);
            }
            self.editable.addEventListener(key, value, false);
        });

        var pluginEvents = Object.assign({}, this.pluginEvents);
        Object.keys(pluginEvents).forEach(function (key) {
            var value = pluginEvents[key];
            if (typeof value === 'string') {
                value = self[value].bind(self);
            }
            self.on(key, self, value);
        });
    },
    /**
     * return a Promise resolved when the plugin is initialized and can be started
     * This method can't start new call or perform calculations, must just return
     * the deferreds created in the init method.
     *
     * @returns {Promise}
     */
    isInitialized: function () {
        return Promise.resolve();
    },
    /**
     * Called when all plugins are initialized
     *
     * @returns {Promise}
     */
    start: function () {
        return Promise.resolve();
    },

    //--------------------------------------------------------------------------
    // Editor methods
    //--------------------------------------------------------------------------

    /**
     * Override any of these functions from within a plugin to allow it to add specific
     * behavior to any of these basic functions of the editor (eg modifying the value
     * to save, then passing to the next plugin's saveEditor override etc.).
     */

    /**
     * @see Manager.getEditorValue
     */
    getEditorValue: function (value) {
        return value;
    },
    /**
     * @see Manager.setEditorValue
     */
    setEditorValue: function (value) {
        return value;
    },
    /**
     * @see Manager.changeEditorValue
     */
    changeEditorValue: function () {},
    /**
     * Note: Please only change the string value without using the DOM.
     * The value is received from getEditorValue.
     *
     * @see Manager.saveEditor
     */
    saveEditor: function (value) {
        return Promise.resolve(value);
    },
    /**
     * @see Manager.cancelEditor
     */
    cancelEditor: function () {
        return Promise.resolve();
    },
    /**
     * @see Manager.translatePluginTerm
     */
    translatePluginTerm: function (pluginName, value, originalValue, elem, attributeName) {
        return value;
    },
    /**
     * @see Manager.blurEditor
     */
    blurEditor: function () {},
    /**
     * @see Manager.focusEditor
     */
    focusEditor: function () {},

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    getPoint: function (node, offset) {
        return new BoundaryPoint(node, offset);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Wraps a given function between common actions required
     * for history (undo/redo) and the maintenance of the DOM/range.
     *
     * @param {function} fn
     * @returns {any} the return of fn
     */
    _wrapCommand: function (fn) {
        var self = this;
        return function () {
            var res;
            self.trigger_up('command', {
                method: fn.bind(self),
                args: arguments,
                callback: function (result) {
                    res = result;
                }
            });
            return res;
        };
    },
});

return AbstractPlugin;

});
