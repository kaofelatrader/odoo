odoo.define('web_editor.wysiwyg.plugin.manager', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
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
        params.plugins.Arch = true;
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
    getEditorValue: function () {
        this._each('getEditorValue');
        return this._plugins.Arch.getValue();
    },
    /**
     *
     * @param {string} value
     * @returns string
     */
    setEditorValue: function (value) {
        this._each('setEditorValue', value);
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
    saveEditor: function () {
        var Arch = this._plugins.Arch;
        return this._eachAsync('saveEditor').then(function () {
            return Arch.getValue();
        });
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
     * @param {string} string
     * @param {string} originalValue
     * @param {Node} elem
     * @param {string} attributeName
     * @returns string|null
     */
    translatePluginString: function (pluginName, string, originalValue, elem, attributeName) {
        for (var i = 0; i < this._pluginNames.length; i++) {
            var plugin = this._plugins[this._pluginNames[i]];
            string = plugin.translatePluginTerm(pluginName, string, originalValue, elem, attributeName);
        }
        return string;
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
        var obj = {};
        var Arch = this._plugins.Arch;
        for (var k in Arch) {
            if (k[0] !== '_' && !this[k] && typeof Arch[k] === 'function') {
                obj[k] = Arch[k] = Arch[k].bind(Arch);
            }
        }
        var options = Object.assign(obj, this.options);
        var dom = new Dom(options);
        this._each('_afterStartAddDomReferences', dom);
    },
    _each: function (methodName, value) {
        for (var i = 0; i < this._pluginNames.length; i++) {
            var pluginName = this._pluginNames[i];
            var plugin = this._plugins[pluginName];
            value = plugin[methodName](value) || value;
        }
        return value;
    },
    _eachAsync: function (methodName, value) {
        var promise = Promise.resolve(value);
        for (var i = 0; i < this._pluginNames.length; i++) {
            var pluginName = this._pluginNames[i];
            var plugin = this._plugins[pluginName];
            promise.then(plugin[methodName].bind(plugin));
        }
        return promise;
    },
    _eachAsyncParallel: function (methodName, value) {
        var promises = [];
        for (var i = 0; i < this._pluginNames.length; i++) {
            var pluginName = this._pluginNames[i];
            var plugin = this._plugins[pluginName];
            promises.push(plugin[methodName](value));
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
    _getPluginConstructor: function (params, pluginName) {
        var Plugin = params.plugins[pluginName];
        if (typeof Plugin === 'object') {
            if (pluginsRegistry[pluginName]) {
                return pluginsRegistry[pluginName].extend(Plugin);
            } else {
                return AbstractPlugin.extend(Plugin);
            }
        } else if (typeof Plugin !== 'function') {
            return pluginsRegistry[pluginName];
        }
        if (!Plugin) {
            throw new Error("The plugin '" + pluginName + "' is unknown or couldn't be loaded.");
        }
        return Plugin;
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
        pluginNames.splice(pluginNames.indexOf('Arch'), 1);
        pluginNames.unshift('Arch');
        return pluginNames;
    },
    _createPluginInstance: function (params, options) {
        var pluginNames = [];

        Object.keys(params.plugins).forEach(function (pluginName) {
            if (params.plugins[pluginName]) {
                pluginNames.push(pluginName);
            }
        });

        var autoInstallPlugins = [];
        Object.keys(pluginsRegistry).forEach(function (pluginName) {
            var proto = pluginsRegistry[pluginName].prototype;
            if (proto.autoInstall && pluginNames.indexOf(pluginName) === -1) {
                autoInstallPlugins.push({
                    name: pluginName,
                    dependencies: proto.dependencies.slice(),
                });
            }
        });

        this.editor = params.editor;
        this.target = params.target;

        var pluginInstances = {};
        for (var i = 0; i < pluginNames.length; i++) {
            var pluginName = pluginNames[i];
            var Plugin = this._getPluginConstructor(params, pluginName);
            var pluginInstance = new Plugin(this, params, options);
            pluginInstance.pluginName = pluginName;

            // add dependencies

            for (var k = 0; k < pluginInstance.dependencies.length; k++) {
                var pName = pluginInstance.dependencies[k];
                if (pluginNames.indexOf(pName) === -1) {
                    pluginNames.push(pName);
                }
            }
            pluginInstances[pluginName] = pluginInstance;

            // add autoInstall plugins

            for (var k = autoInstallPlugins.length - 1; k >= 0 ; k--) {
                var autoInstall = autoInstallPlugins[k];
                var index;
                while ((index = autoInstall.dependencies.indexOf(pluginName)) !== -1) {
                    autoInstall.dependencies.splice(index, 1);
                }
                if (!autoInstall.dependencies.length) {
                    if (pluginNames.indexOf(autoInstall.name) === -1) {
                        pluginNames.push(autoInstall.name);
                    }
                    autoInstallPlugins.splice(k, 1);
                }
            }
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
