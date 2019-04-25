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

    documentDomEvents: null,
    editableDomEvents: null,
    pluginEvents: null,

    promise: null,

    autoInstall: false,

    /**
     * Use this prop if you want to extend a summernote plugin.
     *
     * @params {object} parent
     * @params {object} params
     * @params {int} params.id
     * @params {array} params.plugins
     * @params {Node} params.editable
     * @params {function} params.addEditableContainer
     * @params {function} params.insertBeforeEditable
     * @params {function} params.insertAfterEditable
     */
    init: function (parent, params, options) {
        this._super.apply(this, arguments);
        this.setParent(parent);
        this.editorId = params.id;
        this.params = params;
        this.options = options;
        this.editable = params.editable;
        this.utils = utils;
        this.dependencies.push('Arch');
        this.dependencies = utils.uniq(this.dependencies);

        this._eventToRemoveOnDestroy = [];
        this._bindSelfEvents(this.pluginEvents);
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
        this._bindDOMEvents(window.top.document, this.documentDomEvents);
        this._bindDOMEvents(this.editable, this.editableDomEvents);
        return Promise.resolve();
    },
    destroy: function () {
        this._eventToRemoveOnDestroy.forEach(function (event) {
            event.target.addEventListener(event.name, event.value, false);
        });
        this._super();
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
     * @see Manager.translatePluginString
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
     * Used after the start, don't ovewrite it
     *
     * @see Manager.start
     */
    _afterStartAddDomReferences: function (dom) {
        this.document = this.editable.ownerDocument;
        this.window = this.document.defaultView;
        this.dom = dom;
    },
    _bindDOMEvents: function (dom, events) {
        var self = this;
        Object.keys(events || {}).forEach(function (event) {
            var eventName = event.split(' ')[0];
            var selector = event.split(' ').slice(1).join(' ');
            var targets = [dom];
            if (selector) {
                targets = dom.querySelectorAll(selector);
            }
            var value = events[event];
            if (typeof value === 'string') {
                value = self[value];
            }
            value = value.bind(self);
            if (eventName === 'mousemove' || eventName === 'scroll') {
                value = self._throttled(6, value);
            }

            targets.forEach(function (target) {
                self._eventToRemoveOnDestroy.push({
                    target: target,
                    name: eventName,
                    value: value,
                });
                target.addEventListener(eventName, value, false);
            });
        });
    },
    _bindSelfEvents: function (events) {
        var self = this;
        Object.keys(events || {}).forEach(function (key) {
            var value = events[key];
            if (typeof value === 'string') {
                value = self[value].bind(self);
            }
            self.on(key, self, value);
        });
    },
    _throttled: function  (delay, fn) {
        var  lastCall = 0;
        return function () {
            var args = arguments;
            var now = new Date().getTime();
            if (now - lastCall < delay) {
                return;
            }
            lastCall = now;
            return fn.apply(null, args);
        }
    },
});

return AbstractPlugin;

});
