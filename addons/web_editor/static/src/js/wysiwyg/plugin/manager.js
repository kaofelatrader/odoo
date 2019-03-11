odoo.define('web_editor.wysiwyg.plugin.manager', function (require) {
'use strict';

var Class = require('web.Class');
var mixins = require('web.mixins');

var pluginsRegistry = {};

var $ = require('web_editor.jquery');
var _ = require('web_editor._');


var PluginsManager = Class.extend(mixins.EventDispatcherMixin).extend({
    /**
     *
     */
    init: function (parent, params, options) {
        this._super.apply(this, arguments);
        this.setParent(parent);

        if (typeof params.container === 'string') {
            params.container = document.querySelector(params.container);
        } else if (params.target.parentNode) {
            params.target.parentNode.style.position = 'relative';
            params.container = params.target.parentNode;
        } else {
            params.container = params.target.ownerDocument.body;
        }

        this._initializePromise = this._loadPlugins(params, options);
    },
    /**
     * Start all plugins when all plugins are initialized
     *
     * @returns {Promise}
     */
    start: function () {
        var self = this;
        return this._initializePromise.then(function () {
            var startPromises = [];
            for (var pluginName in self._plugins) {
                startPromises.push(self._plugins[pluginName].start());
            }
            return Promise.all(startPromises);
        });
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
    each: function (methodName, args) {
        var results = [];
        for (var i = 0; i < this._pluginNames.length; i++) {
            var plugin = this._plugins[this._pluginNames[i]];
            results.push(plugin[methodName].apply(plugin, args));
        }
        return results;
    },
    triggerEach: function (eventName) {
        var results = [];
        var callback = results.push.bind(results);
        var args = [].slice.call(arguments);
        args.push(callback);
        for (var i = 0; i < this._pluginNames.length; i++) {
            var plugin = this._plugins[this._pluginNames[i]];
            plugin.trigger.apply(plugin, args);
        }
        return results;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _loadPlugins: function (params, options) {
        this._plugins = this._createPluginInstance(params, options);
        this._pluginNames = this._getSortedPluginNames(this._plugins);
        var promises = [this._loadTemplatesDependencies(this._pluginNames, this._plugins, options)];

        for (var i = 0; i < this._pluginNames.length; i++) {
            var pluginName = this._pluginNames[i];
            var pluginInstance = this._plugins[pluginName];
            pluginInstance.pluginName = pluginName;
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
            for (var k = 0; pluginInstance.templatesDependencies.length < k; k++) {
                var src = pluginInstance.templatesDependencies[k];
                if (templatesDependencies.indexOf(src) === -1) {
                    templatesDependencies.push(src);
                }
            }
        }
        var promises = [];
        var templatesPath;
        while ((templatesPath = templatesDependencies.shift())) {
            promises.push(options.loadTemplates(templatesPath));
        }
        return Promise.all(promises);
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
