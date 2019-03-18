odoo.define('web_editor.wysiwyg.plugin.manager', function (require) {
'use strict';

var Class = require('web.Class');
var Dom = require('wysiwyg.Dom');
var mixins = require('web.mixins');

var pluginsRegistry = {};

var $ = require('web_editor.jquery');
var _ = require('web_editor._');


var PluginsManager = Class.extend(mixins.EventDispatcherMixin).extend({
    /**
     * The plugin can call insertBeforeEditable and insertAfterEditable to add content
     * in the dom.
     * Before all plugins are started, the plugins can't have access to the DOM.
     *
     */
    init: function (parent, params, options) {
        this._super.apply(this, arguments);
        this.options = options || {};
        this.setParent(parent);
        params.plugins.Range = true; // `Range` is a mandatory Plugin, used virtually everywhere
        this._loadPlugins(params, options);
    },
    /**
     * return a Promise resolved when the plugin is initialized and can be started
     * This method can't start new call or perform calculations, must just return
     * the deferreds created in the init method.
     *
     * @returns {Promise}
     */
    isInitialized: function () {
        return this._eachAsyncParallel('isInitialized');
    },
    /**
     * Start all plugins when all plugins are initialized and the editor and plugins
     * are inserted into the deepest container.
     * When all plugin are starte, the DOM references are added to all plugins
     *
     * @returns {Promise}
     */
    start: function () {
        return this._eachAsyncParallel('start').then(this._afterStartAddDomTools.bind(this));
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    call: function (pluginName, methodName, args) {
        var plugin = this._plugins[pluginName];
        if (plugin) {
            return plugin[methodName].apply(plugin, args);
        }
    },

    /**
     * The following methods call methods of the same name in `AbstractPlugin`, which in turn
     * can be overridden from within any plugin to allow it to add specific behavior to any of
     * these basic actions on the editor (eg modifying the value to save, then passing it to
     * the next plugin's saveEditor override etc.).
     */

    /**
     *
     * Note: This method must be idempotent.
     *
     * @param {string} value
     * @returns string
     */
    getEditorValue: function (value) {
        return this._each('getEditorValue', value);
    },
    /**
     *
     * @param {string} value
     * @returns string
     */
    setEditorValue: function (value) {
        return this._each('setEditorValue', value);
    },
    /**
     *
     * @param {string} value
     */
    changeEditorValue: function () {
        this._each('changeEditorValue');
    },
    /**
     * Note: Please only change the string value without using the DOM.
     * The value is received from getEditorValue.
     *
     * @param {string} value
     * @returns {Promise<string>}
     */
    saveEditor: function (value) {
        return this._eachAsync('saveEditor', value);
    },
    /**
     * 
     * @returns {Promise}
     */
    cancelEditor: function () {
        return this._eachAsync('cancelEditor');
    },
    /**
     *
     * @param {string} pluginName
     * @param {string} value
     * @param {string} originalValue
     * @param {Node} elem
     * @param {string} attributeName
     * @returns string|null
     */
    translatePluginValue: function (pluginName, value, originalValue, elem, attributeName) {
        for (var i = 0; i < this._pluginNames.length; i++) {
            var plugin = this._plugins[this._pluginNames[i]];
            value = plugin.translatePluginTerm(pluginName, value, originalValue, elem, attributeName);
        }
        return value;
    },
    /**
     *
     */
    blurEditor: function () {
        this._each('blurEditor');
    },
    /**
     *
     */
    focusEditor: function () {
        this._each('focusEditor');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _afterStartAddDomTools: function () {
        var options = Object.assign({
            isVoidBlock: this._plugins.Range.isVoidBlock.bind(this._plugins.Range),
        }, this.options);
        var dom = new Dom(options);
        this._each('_afterStartAddDomReferences', dom);
    },
    _each: function (methodName, value) {
        for (var i = 0; i < this._pluginNames.length; i++) {
            var plugin = this._plugins[this._pluginNames[i]];
            value = plugin[methodName](value) || value;
        }
        return value;
    },
    _eachAsync: function (methodName, value) {
        var promise = Promise.resolve(value);
        for (var i = 0; i < this._pluginNames.length; i++) {
            var plugin = this._plugins[this._pluginNames[i]];
            promise.then(plugin[methodName].bind(plugin));
        }
        return promise;
    },
    _eachAsyncParallel: function (methodName, value) {
        var promises = [];
        for (var pluginName in this._plugins) {
            promises.push(this._plugins[pluginName][methodName](value));
        }
        return Promise.all(promises);
    },
    _loadPlugins: function (params, options) {
        this._plugins = this._createPluginInstance(params, options);
        this._pluginNames = this._getSortedPluginNames(this._plugins);
        var promises = [this._loadTemplatesDependencies(this._pluginNames, this._plugins, options)];

        for (var i = 0; i < this._pluginNames.length; i++) {
            var pluginName = this._pluginNames[i];
            var pluginInstance = this._plugins[pluginName];
            var dependencies = {};
            for (var k = 0; k < pluginInstance.dependencies.length; k++) {
                var depName = pluginInstance.dependencies[k];
                dependencies[depName] = this._plugins[depName];
            }
            pluginInstance.dependencies = Object.freeze(dependencies);
            promises.push(pluginInstance.isInitialized());
        }

        return Promise.all(promises).then(function () {
            Object.freeze(self._plugins);
        });
    },
    /*
     * sort with the deepest dependencies in first
     */
    _getSortedPluginNames: function (pluginInstances) {
        var pluginNames = Object.keys(pluginInstances);
        function deepestPluginsDependent(pluginNames, deep) {
            deep += 1;
            for (var i = 0; i < pluginNames.length; i++) {
                var pluginInstance = pluginInstances[pluginNames[i]];
                if (deep > pluginInstance._deepestPluginsDependent) {
                    pluginInstance._deepestPluginsDependent = deep;
                }
                deepestPluginsDependent(pluginInstance.dependencies);
            }
        }
        deepestPluginsDependent(pluginInstances);
        pluginNames.sort(function (a, b) {
            return pluginInstances[b]._deepestPluginsDependent - pluginInstances[a]._deepestPluginsDependent;
        });
        for (var i = 0; i < pluginNames.length; i++) {
            delete pluginInstances[pluginNames[i]]._deepestPluginsDependent;
        }
        return pluginNames;
    },
    _createPluginInstance: function (params, options) {
        var pluginNames = [];
        Object.keys(params.plugins).forEach(function (pluginName) {
            if (params.plugins[pluginName]) {
                pluginNames.push(pluginName);
            }
        });

        this.editor = params.editor;
        this.target = params.target;

        var pluginInstances = {};
        for (var i = 0; i < pluginNames.length; i++) {
            var pluginName = pluginNames[i];
            if ((!params.plugins[pluginName] || typeof params.plugins[pluginName] !== 'object') && !pluginsRegistry[pluginName]) {
                throw new Error("The plugin '" + pluginName + "' is unknown or couldn't be loaded.");
            }
            var Plugin = typeof params.plugins[pluginName] === 'object' ? params.plugins[pluginName] : pluginsRegistry[pluginName];
            var pluginInstance = new Plugin(this, params, options);
            pluginInstance.pluginName = pluginName;

            for (var k = 0; k < pluginInstance.dependencies.length; k++) {
                var pName = pluginInstance.dependencies[k];
                if (pluginNames.indexOf(pName) === -1) {
                    pluginNames.push(pName);
                }
            }
            pluginInstances[pluginName] = pluginInstance;
        }
        return pluginInstances;
    },
    _loadTemplatesDependencies: function (pluginNames, pluginInstances, options) {
        var templatesDependencies = [];
        for (var i = 0; i < pluginNames.length; i++) {
            var pluginInstance = pluginInstances[pluginNames[i]];
            for (var k = 0; k < pluginInstance.templatesDependencies.length; k++) {
                var src = pluginInstance.templatesDependencies[k];
                if (templatesDependencies.indexOf(src) === -1) {
                    templatesDependencies.push(src);
                }
            }
        }
        return options.loadTemplates(templatesDependencies);
    },
});

PluginsManager._registry = pluginsRegistry;
PluginsManager.addPlugin = function (pluginName, Plugin) {
    if (pluginsRegistry[pluginName]) {
        console.info('The wysiwyg "' + pluginName + '" plugin was overwritten');
    }
    pluginsRegistry[pluginName] = Plugin;
    return this;
};

return PluginsManager;

});
