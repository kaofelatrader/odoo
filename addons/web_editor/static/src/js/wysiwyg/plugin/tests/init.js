odoo.define('web_editor.wysiwyg.plugin.tests.init', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');


function deepEqual (v1, v2) {
    if (v1 === v2) {
        return true;
    }
    if (typeof v1 === 'object' && typeof v2 === 'object') {
        var k1 = Object.keys(v1);
        var k2 = Object.keys(v2);
        if (k1.length !== k2.length) {
            return false;
        }
        for (var i = 0; i < k1.length; i++) {
            var key = k1[i];
            if (!deepEqual(v1[key], v2[key])) {
                return false;
            }
        }
        return true;
    }
}
function log (result, testName, value) {
    if (result === true) {
        console.info('TEST: ', testName);
    } else if (result === false) {
        console.error('TEST: ', testName, value);
    }
}
/**
 * Get the event type based on its name.
 *
 * @private
 * @param {string} eventName
 * @returns string
 *  'mouse' | 'keyboard' | 'unknown'
 */
function _eventType(eventName) {
    var types = {
        mouse: ['click', 'mouse', 'pointer', 'contextmenu', 'select', 'wheel'],
        keyboard: ['key'],
    };
    var type = 'unknown';
    Object.keys(types).forEach(function (key, index) {
        var isType = types[key].some(function (str) {
            return eventName.indexOf(str) !== -1;
        });
        if (isType) {
            type = key;
        }
    });
    return type;
}

var TestPlugin = AbstractPlugin.extend({
    dependencies: ['Arch'],

    /**
     *@param {Object} options
     *@param {Object} options.testAssertObject
     *@param {function} options.testAssertObject.ok
     *@param {function} options.testAssertObject.notOk
     *@param {function} options.testAssertObject.strictEqual
     *@param {function} options.testAssertObject.deepEqual
     *@param {Object} options.returnTestResults called at the test ending
     **/
    init: function (parent, params, options) {
        var self = this;
        this._super.apply(this, arguments);

        this._plugins = [this];
        this._allPluginsAreReady = false;
        this._complete = false;

        this.assert = {
            ok: function (value, testName) {
                if (self.options.testAssertObject) {
                    self.options.testAssertObject.ok(value, testName);
                } else {
                    log(!!value, testName, value);
                }
            },
            notOk: function (value, testName) {
                if (self.options.testAssertObject) {
                    self.options.testAssertObject.notOk(value, testName);
                } else {
                    log(!value, testName, value);
                }
            },
            strictEqual: function (value, expectedValue, testName) {
                if (self.options.testAssertObject) {
                    self.options.testAssertObject.strictEqual(value, expectedValue, testName);
                } else {
                    log(value === expectedValue, testName, value);
                }
            },
            deepEqual: function (value, expectedValue, testName) {
                if (self.options.testAssertObject) {
                    self.options.testAssertObject.deepEqual(value, expectedValue, testName);
                } else {
                    log(deepEqual(value, expectedValue), testName, value);
                }
            },
        };
    },
    setEditorValue: function () {
        this._super.apply(this, arguments);
        if (!this._allPluginsAreReady) {
            this._allPluginsAreReady = true;
            setTimeout(this._loadTests.bind(this));
        }
    },
    destroy: function () {
        this._isDestroyed = true;
        if (!this._complete) {
            var assert = this.options.testAssertObject || this.assert;
            assert.notOk(true, "The editor are destroyed before all tests are complete");
            this._terminate();
        }
        this._super();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    add: function (plugin) {
        this._plugins.push(plugin);
    },
    test: function (assert) {
        var test = false;
        this._plugins.forEach(function (plugin) {
            if (plugin.pluginName === 'TestAutoInstall') {
                test = true;
            }
        })
        assert.ok(test, 'Should find "TestAutoInstall" plugin');
        return Promise.resolve();
    },
    /**
     * Trigger events natively (as opposed to the jQuery way)
     * on the specified target.
     *
     * @param {node} el
     * @param {string []} events
     * @param {object} [options]
     * @returns Promise <Event []>
     */
    triggerNativeEvents: function (el, events, options) {
        options = _.defaults(options || {}, {
            view: window,
            bubbles: true,
            cancelable: true,
        });
        if (typeof events === 'string') {
            events = [events];
        }
        var triggeredEvents = []
        events.forEach(function (eventName) {
            var event;
            switch (_eventType(eventName)) {
                case 'mouse':
                    event = new MouseEvent(eventName, options);
                    break;
                case 'keyboard':
                    event = new KeyboardEvent(eventName, options);
                    break;
                default:
                    event = new Event(eventName, options);
                    break;
            }
            el.dispatchEvent(event);
            triggeredEvents.push(event);
        });
        return new Promise(function (resolve) {
            setTimeout(function (argument) {
                resolve(triggeredEvents);
            }, 0);
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _loadTest: function (plugin) {
        if (this._isDestroyed) {
            return Promise.resolve();
        }
        var assert = this.options.testAssertObject || this.assert;
        this.trigger_up('set_value', {value: ''});
        assert.ok(true, '<' + plugin.pluginName + '>');
        return plugin.test(assert);
    },
    _loadTests: function () {
        var self = this;
        var promise = Promise.resolve();
        this._plugins.forEach(function (plugin) {
            promise = promise.then(self._loadTest.bind(self, plugin));
        });
        promise.then(this._terminate.bind(this));
    },
    _terminate: function () {
        this._complete = true;
        if (this.options.returnTestResults) {
            this.options.returnTestResults(this._results);
        }
    },
});


var TestAutoInstall = AbstractPlugin.extend({
    autoInstall: true,
    dependencies: ['Test'],
    start: function () {
        this.dependencies.Test.add(this);
        return this._super();
    },

    test: function (assert) {
        return Promise.resolve();
    },
});


Manager.addPlugin('Test', TestPlugin);
Manager.addPlugin('TestAutoInstall', TestAutoInstall);

});
