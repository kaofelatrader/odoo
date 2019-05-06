odoo.define('web_editor.wysiwyg.plugin.dropblockSelector', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var dropblockSelector = AbstractPlugin.extend({
    dependencies: ['DropBlock', 'Selector'],

    /**
     *
     * @override
     *
     * @param {Object[]} params.dropblockSelector
     * @param {string} params.dropblockSelector.selector
     * @param {string} params.dropblockSelector.dropIn
     * @param {string} params.dropblockSelector.dropNear
     **/
    init: function (parent, params) {
        this._super.apply(this, arguments);
        if (!this.options.dropblockSelector) {
            console.error("'DropblockSelector' plugin should use 'dropblockSelector' options");
        }
    },

    start: function () {
        var promise = this._super();
        this.dependencies.DropBlock.on('dropzone', this, this._onDragAndDropStart.bind(this));
        return promise;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    _onDragAndDropStart: function (dragAndDropContents, dropZones) {
        var self = this;
        if (dragAndDropContents.length > 1) {
            throw new Error("The dropable block content should contains only one child.");
        }
        var element = dragAndDropContents[0];
        dropZones.splice(0);
        this.options.dropblockSelector.forEach(function (zone) {
            if ((zone.dropIn || zone.dropNear) && self.dependencies.Selector.is(element, zone.selector)) {
                var dropInIds = zone.dropIn && self.dependencies.Selector.search(zone.dropIn);
                var dropNearIds = zone.dropNear && self.dependencies.Selector.search(zone.dropNear);
                dropZones.push({
                    dropIn: dropInIds && dropInIds.map(function (id) {
                        return self.dependencies.Arch.getElement(id);
                    }),
                    dropNear: dropNearIds && dropNearIds.map(function (id) {
                        return self.dependencies.Arch.getElement(id);
                    }),
                });
            }
        });
    },
});

Manager.addPlugin('dropblockSelector', dropblockSelector);



});
