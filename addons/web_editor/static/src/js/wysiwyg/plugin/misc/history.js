odoo.define('web_editor.wysiwyg.plugin.history', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $ = require('web_editor.jquery');
var _ = require('web_editor._');


var HistoryPlugin = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg.xml'],

    dependencies: [],

    buttons: {
        template: 'wysiwyg.buttons.history',
        enabled: '_enabled',
    },

    changeEditorValue: function () {
        this.recordUndo();
    },
    setEditorValue: function (value) {
        this.clear();
        return value;
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
        this.stack = [];
        // Restore stackOffset to its original value.
        this.stackOffset = -1;
        // Record our first snapshot (of nothing).
        this.recordUndo();
    },
    /**
     * Get the current history stack and the current offset.
     *
     * @returns {Object} {stack: Object, stackOffset: Integer}
     */
    getHistoryStep: function () {
        return {
            stack: this.stack,
            stackOffset: this.stackOffset,
        };
    },
    recordUndo: function () {
        if (!this.stack[this.stackOffset] || this.editable.innerHTML !== this.stack[this.stackOffset].contents) {
            this.stackOffset++;
            // Wash out stack after stackOffset
            if (this.stack.length > this.stackOffset) {
                this.stack = this.stack.slice(0, this.stackOffset);
            }
            // Create new snapshot and push it to the end
            this.stack.push(this._makeSnapshot());
        }
    },
    undo: function () {
        if (this.stackOffset > 0) {
            this.stackOffset--;
        }
        this._applySnapshot(this.stack[this.stackOffset]);
    },
    redo: function () {
        if (this.stack.length - 1 > this.stackOffset) {
            this.stackOffset++;
            this._applySnapshot(this.stack[this.stackOffset]);
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Apply a snapshot.
     *
     * @private
     */
    _applySnapshot: function (snapshot) {
        if (snapshot.contents !== null) {
            this.editable.innerHTML = snapshot.contents;
        }
        if (snapshot.bookmark !== null) {
            this._createRangeFromBookmark(snapshot.bookmark);
        }
        this.trigger_up('change');
    },
    /**
     * @method
     *
     * create WrappedRange from bookmark
     *
     * @param {Node} editable
     * @param {Object} bookmark
     * @return {WrappedRange}
     */
    _createRangeFromBookmark: function (bookmark) {
        var sc = this._fromOffsetPath(bookmark.s.path);
        var so = bookmark.s.offset;
        var ec = this._fromOffsetPath(bookmark.e.path);
        var eo = bookmark.e.offset;

        if (!sc || !this.editable.contains(sc) || so > this.utils.nodeLength(sc) ||
            !ec || !this.editable.contains(ec) || eo > this.utils.nodeLength(ec)) {
            console.warn("Impossible to do the selection, the DOM does not match");
            return;
        }
        this.dependencies.Arch.setRange({
            sc: sc,
            so: so,
            ec: ec,
            eo: eo,
        });
    },
    /**
     * @private
     */
    _enabled: function (buttonName) {
        switch (buttonName) {
            case 'undo': return this.stackOffset >= 1;
            case 'redo': return this.stackOffset + 1 < this.stack.length;
        }
    },
    /**
     * @method fromOffsetPath
     *
     * return element from offsetPath(array of offset)
     *
     * @param {array} offsets - offsetPath
     */
    _fromOffsetPath: function(offsets) {
        var current = this.editable;
        for (var i = 0, len = offsets.length; i < len; i++) {
            if (current.childNodes.length <= offsets[i]) {
                current = current.childNodes[current.childNodes.length - 1];
            }
            else {
                current = current.childNodes[offsets[i]];
            }
            if (!current) {
                return;
            }
        }
        return current;
    },
    /**
     * @method makeOffsetPath
     *
     * return offsetPath(array of offset) from ancestor
     *
     * @param {Node} node
     */
    _makeOffsetPath: function (node) {
        var indexOf = [].indexOf;
        var positions = [];
        while (node.parentNode && node !== this.editable) {
            positions.push(indexOf.call(node.parentNode.childNodes, node));
            node = node.parentNode;
        }
        positions.reverse();
        return positions;
    },
    /**
     * Prevent errors with first snapshot.
     *
     * @private
     */
    _makeSnapshot: function () {
        var range = this.dependencies.Arch.getRange();
        var snapshot = {
            contents: this.editable.innerHTML,
            bookmark: range ?
                {
                    s: {
                        path: this._makeOffsetPath(range.sc),
                        offset: range.so
                    },
                    e: {
                        path: this._makeOffsetPath(range.ec),
                        offset: range.eo
                    }
                } : {
                    s: { path: [], offset: 0 },
                    e: { path: [], offset: 0 }
                }
        };
        if (!range || !this.editable.contains(range.sc)) {
            snapshot.bookmark.s.path = snapshot.bookmark.e.path = [0];
            snapshot.bookmark.s.offset = snapshot.bookmark.e.offset = 0;
        }
        return snapshot;
    },

});

Manager.addPlugin('History', HistoryPlugin);

return HistoryPlugin;

});
