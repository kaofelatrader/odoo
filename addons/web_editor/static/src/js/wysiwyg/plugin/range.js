odoo.define('wysiwyg.plugin.range', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var utils = require('wysiwyg.utils');

var RangePlugin = AbstractPlugin.extend({
    editableDomEvents: {
        'mouseup': '_onMouseUp',
        'keyup': '_onKeyup',
        'wysiwyg.range': '_onRange',
    },
    pluginEvents: {
        'change': '_onChange',
        'disable': '_onDisable',
        'blur': '_onBlur',
    },

    /**
     * @constructor
     */
    init: function (parent, media, options) {
        this._super.apply(this, arguments);

        /**
        * Return true if the node is a block media to treat like a block where
        * the cursor can not be placed inside like the void.
        *
        * @param {Node} node
        * @returns {Boolean}
        */
        utils.isVoidBlock = function (node) {
            return (!this.isBR(node) && this.isVoid(node)) ||
                node.contentEditable === 'false' ||
                $(node).hasClass('o_fake_editable');
        };
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    clear: function () {
        this.focusedNode = null;
        this.lastRange = null;
        this.trigger('range');
    },
    getFocusedNode: function () {
        return this.focusedNode && $.contains(this.editable, this.focusedNode) ? this.focusedNode : null;
    },
    getRange: function () {
        var range = this.lastRange;
        if (!range || !$.contains(this.editable, range.sc)) {
            range = this._getRange();
            if (range && !$.contains(this.editable, range.sc)) {
                range = null;
            }
        } else {
            range = range.copy();
        }
        return range;
    },
    // todo check if useful
    setRange: function (range, node) {
        var Wysiwyg = odoo.__DEBUG__.services['web_editor.wysiwyg'];
        this.lastRange = Wysiwyg.setRange(range, node);
        this._onRange();
        return this.lastRange;
    },
    /**
     * Select the target media on the right (or left)
     * of the currently selected target media.
     *
     * @private
     * @param {Node} target
     * @param {Boolean} left
     */
    setRangeOnVoidBlock: function (target, left) {
        if (!target || !utils.isVoidBlock(target)) {
            return;
        }
        var range = this._getRange();
        var $contentEditable;

        if (
            range.sc.tagName && $.contains(target, range.sc) &&
            $(range.sc).hasClass('o_fake_editable') &&
            left === !range.sc.previousElementSibling
        ) {
            $contentEditable = $(range.sc).closest('[contentEditable]');
            if ($(target).closest('[contentEditable]')[0] !== $contentEditable[0]) {
                $contentEditable.focus();
            }
            this.save();
            return;
        }

        var next = this.getPoint(target, 0);
        var method = left ? 'prevUntil' : 'nextUntil';
        next = next[method](function (point) {
            return point.node !== target && !$.contains(target, point.node) ||
                point.node.contentEditable === 'true' ||
                $(point.node).hasClass('o_fake_editable');
        });
        if (!next || next.node !== target && !$.contains(target, next.node)) {
            next = this.getPoint(target, 0);
        }

        $contentEditable = $(next.node).closest('[contentEditable]');
        if ($(target).closest('[contentEditable]')[0] !== $contentEditable[0]) {
            // move the focus only if the new contentEditable is not the same (avoid scroll up)
            // (like in the case of a video, which uses two contentEditable in the media, so as to write text)
            $contentEditable.focus();
        }

        if (range.sc !== next.node || range.so !== next.offset) {
            this.setRange({
                sc: next.node,
                so: next.offset,
            });
            this.save();
        }
    },
    save: function (range) {
        this.lastRange = range || this._getRange();

        if (this.lastRange && !$.contains(this.editable, this.lastRange.sc) || !$.contains(this.editable, this.lastRange.ec)) {
            throw new Error("Try to save a wrong range.");
        }
    },
    restore: function () {
        if (this.lastRange) {
            var Wysiwyg = odoo.__DEBUG__.services['web_editor.wysiwyg'];
            this.lastRange = Wysiwyg.setRange(this.lastRange);
            this.editable.normalize();
            this.lastRange = null;
            this._onRange();
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _clearFocusedNode: function () {
        if (this.focusedNode) {
            this.focusedNode = null;
        }
    },
    _getRange: function () {
        var Wysiwyg = odoo.__DEBUG__.services['web_editor.wysiwyg'];
        return Wysiwyg.getRange(this.document);
    },
    /**
     * Trigger a focusnode event when the focus enters another node.
     *
     * @param {DOM} node
     */
    _setFocusedNode: function () {
        var range = this.getRange();
        var node = range.sc.childNodes[range.so] || range.sc;
        if (!node.tagName) {
            node = node.parentNode;
        }

        if (this.focusedNode !== node) {
            this.focusedNode = node;
            this.trigger('focus', node);
        }
        return node;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onBlur: function () {
        this._clearFocusedNode();
    },
    /**
     * @private
     */
    _onChange: function () {
        this.setRangeOnVoidBlock(this.getFocusedNode());
    },
    /**
     * @private
     */
    _onDisable: function () {
        this._clearFocusedNode();
    },
    /**
     * @private
     * @param {jQueryEvent} e
     */
    _onKeyup: function (e) {
        if (e.keyCode === 37 || e.keyCode === 39) {
            var point = this._getRange().getStartPoint();
            point = e.keyCode === 37 ? point.prev() : point.next();
            var node = point.node.childNodes[point.offset] || point.node;
            if (utils.isVoidBlock(node)) {
                this.setRangeOnVoidBlock(node, e.keyCode === 37);
            }
        }
        if ((e.keyCode >= 37 && e.keyCode <= 40) || e.keyCode === 13) {
            this._setFocusedNode();
        }
        if (e.keyCode >= 37 || e.keyCode <= 40) {
            this._onRange();
        }
    },
    /**
     * trigger up a range event when receive a mouseup from editable
     */
    _onMouseUp: function () {
        this.lastRange = null;
        this._setFocusedNode();
        this._onRange();
    },
    /**
     * trigger up a range
     */
    _onRange: function () {
        if (this._rerange) {
            return;
        }
        var node = this._setFocusedNode();

        this._rerange = true; // todo: avoid cycle
        this.setRangeOnVoidBlock(node);
        this._rerange = false;

        console.log('range');
        this.trigger('range');
    },
});

Manager.addPlugin('Range', RangePlugin);

return RangePlugin;
});
