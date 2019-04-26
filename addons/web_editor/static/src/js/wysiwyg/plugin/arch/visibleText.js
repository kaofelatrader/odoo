odoo.define('wysiwyg.plugin.arch.visibleText', function (require) {
'use strict';

var TextNode = require('wysiwyg.plugin.arch.text');
function True () { return true; };
function False () { return false; };
var regExpSpaceBegin = /^([ \n\r\t\uFEFF]*)/;
var regExpSpaceEnd = /([ \n\r\t\uFEFF]*)$/;
var regExpSpace = /[ \t\r\n\uFEFF]+/g;


return TextNode.extend({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyRulesArchNode: function () {
        if (this.nodeValue.length && this.ancestor(this.isPre)) {
            return this._super();
        }

        var before = this.nodeValue.match(regExpSpaceBegin)[0];
        var after = before.length < this.nodeValue.length ? this.nodeValue.match(regExpSpaceEnd)[0] : '';
        before = before === ' ' ? '' : before;
        after = after === ' ' ? '' : after;
        var text = this.nodeValue.slice(before.length, this.nodeValue.length - after.length);

        text = text.replace(regExpSpace, ' ');

        if (before.length || text.length) {
            var ancestor = this.ancestor(this.isBlock);

            if (before.length) {
                before = '';
                var prev = this.previousSibling();
                if (!prev && !this.isLeftEdge(ancestor)) {
                    before = ' ';
                } else if (prev && prev.isInline() && (!(prev instanceof TextNode) || prev.isVisibleText())) {
                    before = ' ';
                }
            }
            if (after.length || !text.length) {
                var isRegularSpace = /^ +$/.test(after);
                after = '';
                var next = this.nextSibling();
                if (!next && !this.isRightEdge(ancestor)) {
                    after = ' ';
                } else if (next && next.isInline() && (!(next instanceof TextNode) || next.isVisibleText())) {
                    after = ' ';
                } else if (isRegularSpace) {
                    after = ' ';
                }
            }

            if (!text.length) {
                text = before.length && after.length ? ' ' : '';
            } else {
                text = before + text + after;
            }
        }

        if (text.length) {
            if (this.nodeValue !== text) {
                this.nodeValue = text;
                this.params.change(this, 0);
            }
        } else {
            this.remove();
        }
    },
});

});
