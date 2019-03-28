odoo.define('wysiwyg.plugin.arch', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $ = require('web_editor.jquery');
var _ = require('web_editor._');


var ArchPlugin = AbstractPlugin.extend({
    dependencies: [],

    setEditorValue: function (value) {
    },
    saveEditor: function () {
    },

    //--------------------------------------------------------------------------
    // Public GETTER
    //--------------------------------------------------------------------------

    /**
     * @param {Int} id
     * @param {boolean} options.keepArchitecturalSpaces
     * @returns {JSON}
     **/
    export: function (id, options) {

    },
    getRange: function () {
        var start = this.arch;
        while (start.childNodes[start.startRange]) {
            start = start.childNodes[start.startRange];
        }
        while (end.childNodes[end.endRange]) {
            end = end.childNodes[end.endRange];
        }
        return {
            startId: start.id,
            startOffset: start.startRange,
            endId: end.id,
            endOffset: end.endRange,
        };
    },
    /**
     * @param {Int} id
     * @param {Object} [options]
     * @param {int} options.spacer
     *      number of space for indent the html (remove old architecturalSpaces if outside PRE tag)
     * @param {boolean} options.keepArchitecturalSpaces
     * @returns {string}
     **/
    render: function (id, options) {
        return this.arch.render(id);
    },

    //--------------------------------------------------------------------------
    // Public SETTER
    //--------------------------------------------------------------------------

    insert: function (DOM, id, offset) {
        var newId = this.arch.getNode(id).insert(DOM, offset);
        // ou var newId = this.arch.getNode(id).children.splice(offset, this._domToArch(arch));
        this._autoRedraw(newId, DOM);
    },
    replace: function (DOM, fromId, fromOffset, toId, toOffset) {
        var fromNode = this.arch.getNode(fromId, fromOffset);
        var parent = fromNode.parent;
        var offset = fromNode.index();
        var toNode = this.arch.getNode(toId, toOffset);
        fromNode.nextNode(function (prev, next) {
            prev.remove();
            if (next === toNode) {
                next.remove();
                return true;
            }
        });
        var newId = this.insertArch(DOM, parent.id, offset);
        this._autoRedraw(newId, DOM);
    },
    setRange: function (sc, so, ec, eo) {

    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    _autoRedraw: function (id, DOM) {
        var html = this.arch.getNode(id).render();
        if (html !== DOM) {
            this._redraw(id);
        }
    },
    /**
     * @param {Int} id
     **/
    _redraw: function (id, options) {
        var html = this.render(id);
        var node = id ? this.editable.querySelector('[data-wysiwig-node-id=' + id + ']') : this.editable;
        node.innerHTML = html;
        this.trigger('redraw', id, html);
    },
    _domToArch: function () {
        // maybe inside the arch ?
    }
});

Manager.addPlugin('Arch', ArchPlugin);

return ArchPlugin;
});
