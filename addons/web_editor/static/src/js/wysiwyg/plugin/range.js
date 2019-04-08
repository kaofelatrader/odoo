odoo.define('wysiwyg.plugin.range', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $ = require('web_editor.jquery');
var _ = require('web_editor._');


var RangePlugin = AbstractPlugin.extend({
    dependencies: ['Arch'],

    editableDomEvents: {
        'mouseup': '_onMouseUp',
        'keyup': '_onKeyup',
        'wysiwyg.range': '_onRange',
    },

    blurEditor: function () {
        this._clearFocusedNode();
    },
    changeEditorValue: function () {
        this.setRangeOnVoidBlock(this.getFocusedNode());
    },
    setEditorValue: function (value) {
        this.setRangeOnVoidBlock(this.getFocusedNode());
        return value;
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
        return this.focusedNode && this.editable.contains(this.focusedNode) ? this.focusedNode : null;
    },
    getRange: function () {
        var range = this.lastRange;
        if (!range || !this.editable.contains(range.sc)) {
            range = this._getRange();
            if (range && (!this.editable.contains(range.sc) || range.sc === this.editable || range.ec === this.editable)) {
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
        if (!target || !this.dependencies.Arch.isVoidBlock(target)) {
            return;
        }
        var range = this._getRange();
        var contentEditable;

        if (
            range.sc.tagName && target.contains(range.sc) &&
            range.sc.classList.contains('o_fake_editable') &&
            left === !range.sc.previousElementSibling
        ) {
            contentEditable = this.utils.ancestor(range.sc, function (node) {
                return node.getAttribute('contentEditable');
            });
            var targetClosest = this.utils.ancestor(target, function (node) {
                return node.getAttribute('contentEditable');
            });
            if (targetClosest !== contentEditable) {
                contentEditable.focus();
            }
            this.save();
            return;
        }

        var next = this.getPoint(target, 0);
        var method = left ? 'prevUntil' : 'nextUntil';
        next = next[method](function (point) {
            return point.node !== target && !target.contains(point.node) ||
                point.node.contentEditable === 'true' ||
                point.node.classList && point.node.classList.contains('o_fake_editable');
        });
        if (!next || next.node !== target && !target.contains(next.node)) {
            next = this.getPoint(target, 0);
        }

        contentEditable = this.utils.ancestor(next.node, function (node) {
            return node.getAttribute('contentEditable');
        });
        var targetClosest = this.utils.ancestor(target, function (node) {
            return node.getAttribute('contentEditable');
        });
        if (targetClosest !== contentEditable) {
            // move the focus only if the new contentEditable is not the same (avoid scroll up)
            // (like in the case of a video, which uses two contentEditable in the media, so as to write text)
            contentEditable.focus();
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
        this.lastRange = range ? this.setRange(range) : this._getRange();

        if (this.lastRange) {
            if (this.editable.style.display === 'none') {
                if ((!this.editor.contains(this.lastRange.sc) ||
                     !this.editor.contains(this.lastRange.ec)) &&
                    (!this.editable.contains(this.lastRange.sc) ||
                     !this.editable.contains(this.lastRange.ec))) {
                    console.warn("Try to save a wrong range.");
                    this.lastRange = null;
                }
            } else if (!this.editable.contains(this.lastRange.sc) ||
                    !this.editable.contains(this.lastRange.ec)) {
                console.warn("Try to save a wrong range.");
                this.lastRange = null;
            }
        }

        var input = this.lastRange && this.lastRange.sc.childNodes[this.lastRange.so];
        if (input && (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT')) {
            this.lastRange.input = input;
            this.lastRange.inputSelection = this._getTextSelection(input);
        }
    },
    restore: function () {
        if (this.lastRange) {
            var Wysiwyg = odoo.__DEBUG__.services['web_editor.wysiwyg'];
            Wysiwyg.setRange(this.lastRange);
            this.editable.normalize();
            if (this.lastRange.input) {
                this._setTextSelection(this.lastRange.input, this.lastRange.inputSelection);
            }
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
        return Wysiwyg.getRange(this.editable);
    },
    _getTextSelection: function (input) {
        var start = 0;
        var end = 0;
        if (typeof input.selectionStart == "number" && typeof input.selectionEnd == "number") {
            start = input.selectionStart;
            end = input.selectionEnd;
        } else {
            var range = document.selection.createRange();

            if (range && range.parentElement() == el) {
                var len = input.value.length;
                var normalizedValue = input.value.replace(/\r\n/g, "\n");

                // Create a working TextRange that lives only in the input
                var textInputRange = input.createTextRange();
                textInputRange.moveToBookmark(range.getBookmark());

                // Check if the start and end of the selection are at the very end
                // of the input, since moveStart/moveEnd doesn't return what we want
                // in those cases
                var endRange = input.createTextRange();
                endRange.collapse(false);

                if (textInputRange.compareEndPoints("StartToEnd", endRange) > -1) {
                    start = end = len;
                } else {
                    start = -textInputRange.moveStart("character", -len);
                    start += normalizedValue.slice(0, start).split("\n").length - 1;

                    if (textInputRange.compareEndPoints("EndToEnd", endRange) > -1) {
                        end = len;
                    } else {
                        end = -textInputRange.moveEnd("character", -len);
                        end += normalizedValue.slice(0, end).split("\n").length - 1;
                    }
                }
            }
        }
        return {
            start: start,
            end: end,
        };
    },
    /**
     * Trigger a focusnode event when the focus enters another node.
     *
     * @param {DOM} node
     */
    _setFocusedNode: function () {
        var range = this.getRange();
        if (!range) {
            return;
        }
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
    _setTextSelection: function (input, selection) {
        if (input.setSelectionRange) {
            input.focus();
            input.setSelectionRange(selection.start, selection.end);
        } else if (input.createTextRange) {
            var range = input.createTextRange();
            range.collapse(true);
            range.moveEnd('character', selection.end);
            range.moveStart('character', selection.start);
            range.select();
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {jQueryEvent} e
     */
    _onKeyup: function (e) {
        if (e.keyCode === 37 || e.keyCode === 39) {
            var point = this._getRange().getStartPoint();
            point = e.keyCode === 37 ? point.prev() : point.next();
            var node = point.node.childNodes[point.offset] || point.node;
            if (this.dependencies.Arch.isVoidBlock(node)) {
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
    _onMouseUp: function (ev) {
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

        var range = this.getRange();
        var html = this.editable.innerHTML;
        html = html ? html.replace(/\u00A0/g, '&nbsp;').replace(/\uFEFF/g, '&#65279;') : null;
        this.trigger('range');

        try {
            if (range) {
                this.dependencies.Arch.setRange(range.sc, range.so, range.ec, range.eo);
            }
        } catch (e) {
            console.error(e);
        }
    },
});

Manager.addPlugin('Range', RangePlugin);

return RangePlugin;
});
