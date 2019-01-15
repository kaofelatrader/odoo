odoo.define('web_editor.wysiwyg.plugin.manager', function (require) {
'use strict';

var Class = require('web.Class');
var mixins = require('web.mixins');

var pluginsRegistry = {};


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
            return $.when.apply($, startPromises);
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
    triggerEach: function (eventName, value) {
        var results = [];
        var callback = results.push.bind(results);
        for (var i = 0; i < this._pluginNames.length; i++) {
            this._plugins[this._pluginNames[i]].trigger(eventName, value, callback);
        }
        return results;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _loadPlugins: function (params, options) {
        this._plugins = this._createPluginInstance(params, options);
        this._pluginNames = this._getSortedPluginNames(this._plugins);
        var promises = [this._loadXmlDependencies(this._pluginNames, this._plugins)];

        for (var i = 0; i < this._pluginNames.length; i++) {
            var pluginName = this._pluginNames[i];
            var pluginInstance = this._plugins[pluginName];
            pluginInstance.pluginName = pluginName;
            pluginInstance.dependencies = Object.freeze(_.pick(this._plugins, pluginInstance.dependencies));
            promises.push(pluginInstance.isInitialized());
        }

        return $.when.apply($, promises).then(function () {
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
        var pluginNames = Object.keys(params.plugins);

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
    _loadXmlDependencies: function (pluginNames, pluginInstances) {
        var xmlDependencies = [];
        for (var i = 0; i < pluginNames.length; i++) {
            var pluginInstance = pluginInstances[pluginNames[i]];
            for (var k = 0; pluginInstance.xmlDependencies.length < k; k++) {
                var src = pluginInstance.xmlDependencies[k];
                if (xmlDependencies.indexOf(src) === -1) {
                    xmlDependencies.push(src);
                }
            }
        }

        var defs = [];
        var xmlPath;
        while ((xmlPath = xmlDependencies.shift())) {
            defs.push(ajax.loadXML(xmlPath, core.qweb));
        }
        return $.when.apply($, defs);
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
