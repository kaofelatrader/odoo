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

        var text;
        if (this.isInlineFormattingContext()) {
            text = this._removeFormatSpaceInlineContext();
        } else {
            text = this._removeFormatSpaceBlockContext();
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
    _removeFormatSpaceInlineContext: function () {
        var text = this.nodeValue;
        var spaceAfterNewline = /(\n)([ \t])*/g;
        var tabs = /\t/g;
        var newlines = /\n/g;
        var consecutiveSpace = /  */g;
        text = text.replace(spaceAfterNewline, '$1')
            .replace(tabs, ' ')
            .replace(newlines, ' ')
            .replace(consecutiveSpace, ' ');
        if (this.parent.isLeftEdgeOfBlock()) {
            var startSpace = /^ */g;
            text = text.replace(startSpace, '');
        }
        if (this.parent.isRightEdgeOfBlock()) {
            var endSpace = / *$/g;
            text = text.replace(endSpace, '');
        }
        return text;
    },
    _removeFormatSpaceBlockContext: function () {
        // todo
        // source: https://medium.com/@patrickbrosset/when-does-white-space-matter-in-html-b90e8a7cdd33
        return this._removeFormatSpaceInlineContext();
    },
});

});
