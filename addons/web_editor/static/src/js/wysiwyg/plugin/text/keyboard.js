odoo.define('web_editor.wysiwyg.plugin.keyboard', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var KeyboardPlugin = AbstractPlugin.extend({
    dependencies: ['Paragraph', 'Link', 'History', 'Table'], // TODO: Remove dependencies

    editableDomEvents: {
        'keydown': '_onKeydown',
        'textInput': '_onTextInput',
        'DOMNodeInserted editable': '_removeGarbageSpans',
    },
    tab: '\u00A0\u00A0\u00A0\u00A0',

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Handle TAB keydown event.
     *
     * @param {Boolean} [untab] true for shift+tab
     */
    handleTab: function (untab) {
        var range = this.dependencies.Arch.getRange();
        var point = range.getStartPoint();
        var startSpace = this.utils.getRegex('startSpace');

        // In table, on tab switch to next cell
        if (range.isOnCell()) {
            var nextCell = this.dependencies.Table[untab ? 'prev' : 'next'](null, range);
            if (!nextCell) {
                return;
            }
            var elementChild = nextCell[untab ? 'lastElementChild' : 'firstElementChild'];
            var nextText = this.utils[untab ? 'lastLeaf' : 'firstLeaf'](elementChild || nextCell);
            range.replace({
                sc: nextText,
                so: untab ? this.utils.nodeLength(nextText) : 0,
            });
            this.dependencies.Arch.setRange(range);
            this.dependencies.Arch.setRange();
            return;
        }
        // If on left edge point: indent/outdent
        if (this.utils.isText(point.node)) { // Clean up start spaces on textNode
            point.node.textContent.replace(startSpace, function (startSpaces) {
                point.offset = startSpaces.length === point.offset ? 0 : point.offset;
                return '';
            });
        }
        if (point.isLeftEdgeOfBlock() || this.utils.isEmpty(point.node)) {
            this.dependencies.Paragraph[untab ? 'outdent' : 'indent'](null, range);
            this.dependencies.Arch.getRange().normalize();
            return;
        }
        // Otherwise insert a tab or do nothing
        if (!untab) {
            this._insertTab();
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Handle the recording of history steps on character input.
     *
     * @param {String} key
     */
    _handleCharInputHistory: function (key) {
        var self = this;

        clearTimeout(this.lastCharIsVisibleTime);

        var stopChars = [' ', ',', ';', ':', '?', '.', '!'];
        var history = this.dependencies.History.getHistoryStep();

        var isStopChar = stopChars.indexOf(key) !== -1;
        var isTopOfHistoryStack = !history || history.stack.length ||
            history.stackOffset >= history.stack.length - 1;

        if (isStopChar || !isTopOfHistoryStack) {
            this.lastCharVisible = false;
        }
        this.lastCharIsVisibleTime = setTimeout(function () {
            self.lastCharIsVisible = false;
        }, 500);
        if (!this.lastCharIsVisible) {
            this.lastCharIsVisible = true;
            this.dependencies.History.recordUndo();
        }
    },
    /**
     * Handle deletion (BACKSPACE / DELETE).
     *
     * @private
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @returns {Boolean} true if case handled
     */
    _handleDeletion: function (isPrev) {
        this.dependencies.Arch[isPrev ? 'removeLeft' : 'removeRight']();
    },
    /**
     * Insert a TAB (4 non-breakable spaces).
     *
     * @private
     */
    _insertTab: function () {
        this.dependencies.Arch.insert(this.tab);
    },
    /**
     * Patch for Google Chrome's contenteditable SPAN bug.
     *
     * @private
     * @param {jQueryEvent} e
     */
    _removeGarbageSpans: function (e) {
        if (e.target.className === "" && e.target.tagName == "SPAN" &&
            e.target.style.fontStyle === "inherit" &&
            e.target.style.fontVariantLigatures === "inherit" &&
            e.target.style.fontVariantCaps === "inherit") {
            var $span = $(e.target);
            $span.after($span.contents()).remove();
        }
    },
    /**
     * Select all the contents of the current unbreakable ancestor.
     */
    _selectAll: function () {
        var self = this;
        var range = this.dependencies.Arch.getRange();
        var unbreakable = this.utils.ancestor(range.sc, this.dependencies.Arch.isUnbreakableNode);
        var $contents = $(unbreakable).contents();
        var startNode = $contents.length ? $contents[0] : unbreakable;
        var pointA = this.getPoint(startNode, 0);
        pointA = pointA.nextUntil(function (point) {
            return self.utils.isVisibleText(point.node);
        });
        var endNode = $contents.length ? $contents[$contents.length - 1] : unbreakable;
        var endOffset = $contents.length ? this.utils.nodeLength($contents[$contents.length - 1]) : 1;
        var pointB = this.getPoint(endNode, endOffset);
        pointB = pointB.prevUntil(function (point) {
            return self.utils.isVisibleText(point.node);
        });
        if (pointA && pointB) {
            range.replace({
                sc: pointA.node,
                so: pointA.offset,
                ec: pointB.node,
                eo: pointB.offset,
            }).normalize();
            range = this.dependencies.Arch.setRange(range.getPoints());
            this.dependencies.Arch.setRange(range);
        }
    },


    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    /** 
     * Customize handling of certain keydown events.
     *
     * @private
     * @param {SummernoteEvent} se
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case handled
     */
    _onKeydown: function (e) {
        var handled = false;

        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            this._selectAll();
            return;
        }

        var isChar = e.key && e.key.length === 1;
        var isAccented = e.key && (e.key === "Dead" || e.key === "Unidentified");
        var isModified = e.ctrlKey || e.altKey || e.metaKey;
        if ((isChar || isAccented) && !isModified) {
            if (isAccented) {
                this._accented = isAccented;
            }
            this._handleCharInputHistory(e.key);
        } else {
            this.lastCharIsVisible = false;
            switch (e.keyCode) {
                case 8: // BACKSPACE
                    handled = this._onBackspace(e);
                    break;
                case 13: // ENTER
                    handled = this._onEnter(e);
                    break;
                case 46: // DELETE
                    handled = this._onDelete(e);
                    break;
            }
            if (handled) {
                e.preventDefault();
            }
        }
        if (e.key !== "Dead") {
            this._accented = false;
        }
    },
    /**
     * Handle BACKSPACE keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onBackspace: function (e) {
        var self = this;
        var range = this.dependencies.Arch.getRange();

        // Special cases
        /* if (range.isCollapsed()) {

            // Do nothing if on left edge of a table cell
            var point = range.getStartPoint();
            if (point.node.childNodes[point.offset]) {
                point.node = point.node.childNodes[point.offset];
                point.offset = this.utils.nodeLength(point.node);
            }
            if (point.isLeftEdgeOfTag('TD')) {
                return true;
            }

            // Outdent if on left edge of an indented block
            point = range.getStartPoint();
            var isIndented = !!this.utils.ancestor(point.node, function (n) {
                var style = self.utils.isCell(n) ? 'paddingLeft' : 'marginLeft';
                return n.tagName && !!parseFloat(n.style[style] || 0);
            });
            if (point.isLeftEdgeOfBlock() && isIndented) {
                this.dependencies.Paragraph.outdent(null, range);
                return true;
            }
        }

        var needOutdent = this.utils.isInList(range.sc) && range.getStartPoint().isEdgeOfTag('LI', 'left'); */
        var didDelete;
        // if (!needOutdent || !range.isCollapsed()) {
            didDelete = this._handleDeletion(true);
        /* }
        if (!didDelete && needOutdent) {
            this.dependencies.Arch.setRange(range.getPoints());
            this.dependencies.Paragraph.outdent(null, range);
        } */

        return true;
    },
    /**
     * Handle DELETE keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onDelete: function (e) {
        var range = this.dependencies.Arch.getRange();

        // Special case
        if (range.isCollapsed()) {
            // Do nothing if on left edge of a table cell
            if (range.getStartPoint().isRightEdgeOfTag('TD')) {
                return true;
            }
        }

        this._handleDeletion(false);
        return true;
    },
    /**
     * Handle ENTER keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onEnter: function (e) {
        if (e.shiftKey) {
            this.dependencies.Arch.insert('<br/>');
        } else if (e.ctrlKey) {
            this.dependencies.Arch.insert('<hr/>');
        } else {
            var range = this.dependencies.Arch.getRange();
            var liAncestor = this.utils.ancestor(range.sc, this.utils.isLi);
            var isInEmptyLi = range.isCollapsed() && liAncestor &&
                /^\s*$/.test(liAncestor.textContent);
            if (isInEmptyLi) {
                this.dependencies.Arch.outdent();
            } else {
                this.dependencies.Arch.addLine();
            }
        }
        return true;
    },
    /**
     * Handle visible char keydown event.
     *
     * @private
     * @param {TextEvent} ev
     */
    _onTextInput: function (ev) {
        ev.preventDefault();
        this._handleCharInputHistory(ev.data);
        var text;
        if (ev.data === ' ') {
            text = this.utils.char('nbsp');
        } else if (ev.data.charCodeAt(0) === 10) {
            text = '<br/>';
        } else {
            text = ev.data;
        }
        this.dependencies.Arch.insert(text);
    },
});

Manager.addPlugin('Keyboard', KeyboardPlugin);

return KeyboardPlugin;
});
