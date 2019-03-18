odoo.define('web_editor.wysiwyg.plugin.abstract', function (require) {
'use strict';

var BoundaryPoint = require('wysiwyg.BoundaryPoint');
var Class = require('web.Class');
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

    promise: null,

    /**
     * Use this prop if you want to extend a summernote plugin.
     *
     * @params {object} params
     * @params {int} params.id
     * @params {array} params.plugins
     * @params {Node} params.editable
     * @params {function} params.addEditableContainer
     * @params {function} params.insertBeforeEditable
     * @params {function} params.insertAfterEditable
     */
    init: function (parent, params, options) {
        var self = this;
        this._super.apply(this, arguments);
        this.setParent(parent);
        this.editorId = params.id;
        this.params = params;
        this.options = options;
        this.editable = params.editable;
        this.utils = utils;
        this.dependencies.push('Common'); // Common is a mandatory plugin
        this.dependencies = utils.uniq(this.dependencies);

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
     * @see Manager.isInitialized
     */
    isInitialized: function () {
        return Promise.resolve();
    },
    /**
     * @see Manager.start
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
    // Public
    //--------------------------------------------------------------------------

    /**
     * Used after the start, don't ovewrite it
     *
     * @see Manager.start
     */
    _afterStartAddDomReferences: function (dom) {
        this.document = this.editable.ownerDocument;
        this.window = this.document.defaultView;
        this.dom = dom;
    },
});

return AbstractPlugin;

});
