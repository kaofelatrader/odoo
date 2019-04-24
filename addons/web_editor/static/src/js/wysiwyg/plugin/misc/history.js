odoo.define('web_editor.wysiwyg.plugin.history', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $ = require('web_editor.jquery');
var _ = require('web_editor._');
var spacePonctu = /( |\u00A0|~|`|!|@|#|\$|%|\^|&|\*|\(|\)|{|}|\[|\]|;|:|\"|'|<|,|\.|>|\?|\/|\\|\||-|_|\+|=)/;


var HistoryPlugin = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg.xml'],

    dependencies: ['Arch'],

    buttons: {
        template: 'wysiwyg.buttons.history',
        enabled: '_enabled',
    },

    init: function (params) {
        this._super.apply(this, arguments);
        this._eachNodeHistory = [[]];
        this._range = [];
    },
    setEditorValue: function (value) {
        this.clear();
        return value;
    },
    start: function () {
        this.dependencies.Arch.on('update', this, this._onArchUpdate.bind(this));
        this.dependencies.Arch.on('range', this, this._onArchRange.bind(this));
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Clear the history.
     *
     */
    clear: function () {
        // Clear the stack.
        this._eachNodeHistory = [[]];
        this._range = [];
        // Restore stackOffset to its original value.
        this.stackOffset = -1;
        // Record our first snapshot (of nothing).
        var json = this.dependencies.Arch.export({keepVirtual: true});
        var changes = [];

        (function flatChanges (json) {
            changes.push(json);
            if (json.childNodes) {
                json.childNodes = json.childNodes.map(flatChanges);
            }
            return json.id;
        })(json);

        this._onArchUpdate(changes);
    },
    undo: function () {
        if (this.stackOffset > 0) {
            var oldOffset = this.stackOffset;
            this.stackOffset--;
            this._muteUpdate = true;
            var diff = this._getStepDiff(this.stackOffset, oldOffset);
            var range = this._range[this.stackOffset];
            this.dependencies.Arch.importUpdate(diff, range);
            this._muteUpdate = false;
        }
    },
    redo: function () {
        if (this._range.length - 1 > this.stackOffset) {
            var oldOffset = this.stackOffset;
            this.stackOffset++;
            this._muteUpdate = true;
            var diff = this._getStepDiff(this.stackOffset, oldOffset);
            var range = this._range[this.stackOffset];
            this.dependencies.Arch.importUpdate(diff, range);
            this._muteUpdate = false;
        }
    },

    getHistoryStep: function () {},
    recordUndo: function () {},

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    _onArchRange: function (range) {
        if (this._muteUpdate) {
            return;
        }
        if (this.stackOffset < this._eachNodeHistory[0].length -1) {
            return;
        }

        if (this._eachNodeHistory[0][this.stackOffset] &&
            !this._eachNodeHistory[0][this.stackOffset + 1] &&
                (!this._range[this.stackOffset] ||
                    this._range[this.stackOffset].scID !== range.scID ||
                    this._range[this.stackOffset].so !== range.so ||
                    this._range[this.stackOffset].ecID !== range.ecID ||
                    this._range[this.stackOffset].eo !== range.eo
                )
            ) {
            this.stackOffset++;
        }
        this._range[this.stackOffset] = range;
    },
    _onArchUpdate: function (diffToNew) {
        var self = this;
        if (this._muteUpdate) {
            return;
        }

        var old = this._getStep(this.stackOffset);

        var concatTextHistory = false;
        if (diffToNew.length === 1 && diffToNew[0].nodeName === 'TEXT') {
            var nodeHistory = this._eachNodeHistory[diffToNew[0].id];
            var step = nodeHistory && nodeHistory[this.stackOffset];
            if (step) {
                // break the history for each space or ponctuation
                concatTextHistory = step.nodeValue.replace('\uFEFF', '').split(spacePonctu).length === diffToNew[0].nodeValue.replace('\uFEFF', '').split(spacePonctu).length;
            }
        }

        if (!concatTextHistory) {
            this.stackOffset++;
        }

        // Wash out stack after stackOffset
        if (this._range.length > this.stackOffset) {
            this._eachNodeHistory.forEach(function (nodeHistory) {
                if (nodeHistory) {
                    nodeHistory.splice(self.stackOffset);
                }
            });
            this._range = this._range.slice(0, this.stackOffset);
        }

        this._eachNodeHistory[0][self.stackOffset] = true;

        diffToNew.forEach(function (json) {
            var nodeHistory = self._eachNodeHistory[json.id];
            if (!nodeHistory) {
                self._eachNodeHistory[json.id] = nodeHistory = [];
            }
            if (json.childNodes) {
                json.childNodes = json.childNodes.map(function (child) {
                    return child.id || child;
                });
            }
            var oldJSON = old[json.id];
            if (oldJSON) {
                if (JSON.stringify(oldJSON) === JSON.stringify(json)) {
                    return;
                }
            }
            nodeHistory[self.stackOffset] = json;
        });

        this._range[this.stackOffset] = this.dependencies.Arch.exportRange();
    },
    _getStepActiveIds: function (step) {
        var ids = [];
        (function lookChildren (id) {
            ids.push(id);
            if (step[id].childNodes) {
                step[id].childNodes.forEach(lookChildren);
            }
        })(1);
        return ids.sort();
    },
    _getStep: function (oldOffset) {
        var nodes = [];
        this._eachNodeHistory.forEach(function (nodeHistory, id) {
            var offset = oldOffset;
            var snapshot = nodeHistory[offset];
            while (!snapshot && offset > 0) {
                offset--;
                snapshot = nodeHistory[offset];
            }
            nodes[+id] = snapshot;
        });
        return nodes;
    },
    _getStepDiff: function (newOffset, oldOffset) {
        var diff = [];
        var newStep = this._getStep(this.stackOffset);
        var oldStep = this._getStep(oldOffset);

        var oldIds = this._getStepActiveIds(oldStep);
        var newIds = this._getStepActiveIds(newStep);

        newStep.forEach(function (json) {
            if (!json || newIds.indexOf(json.id) === -1) {
                return;
            }
            if (oldIds.indexOf(json.id) === -1 || json !== oldStep[json.id]) {
                diff.push(json);
            }
        });
        return diff;
    },
    /**
     * @private
     */
    _enabled: function (buttonName) {
        switch (buttonName) {
            case 'undo': return this.stackOffset >= 1;
            case 'redo': return this.stackOffset + 1 < this._range.length;
        }
    },
});

Manager.addPlugin('History', HistoryPlugin);

return HistoryPlugin;

});
