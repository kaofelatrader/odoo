odoo.define('wysiwyg.plugin.arch.visibleText', function (require) {
'use strict';

var TextNode = require('wysiwyg.plugin.arch.text');
function True () { return true; };
function False () { return false; };


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
    /**
     * Return a string with the value of a text node stripped of its format space,
     * applying the W3 rules for white space processing in an inline context
     *
     * @see https://www.w3.org/TR/css-text-3/#white-space-processing
     * @param {Boolean} behavesLikeBlock true if the node behaves like a block (like in a block context)
     * @returns {String}
     */
    _removeFormatSpaceInlineContext: function (behavesLikeBlock) {
        var text = this.nodeValue;
        var spaceBeforeNewline = /([ \t])*(\n)/g;
        var spaceAfterNewline = /(\n)([ \t])*/g;
        var tabs = /\t/g;
        var newlines = /\n/g;
        var consecutiveSpace = /  */g;
        text = text.replace(spaceBeforeNewline, '$2')
            .replace(spaceAfterNewline, '$1')
            .replace(tabs, ' ')
            .replace(newlines, ' ')
            .replace(consecutiveSpace, ' ');
        if (behavesLikeBlock || this.isLeftEdgeOfBlock()) {
            var startSpace = /^ */g;
            text = text.replace(startSpace, '');
        }
        if (behavesLikeBlock || this.isRightEdgeOfBlock()) {
            var endSpace = / *$/g;
            text = text.replace(endSpace, '');
        }
        return text;
    },
    /**
     * Return a string with the value of a text node stripped of its format space,
     * applying the W3 rules for white space processing in a block context (every
     * unit of content in a block context behaves like a block)
     *
     * @see https://www.w3.org/TR/css-text-3/#white-space-processing
     * @returns {String}
     */
    _removeFormatSpaceBlockContext: function () {
        return this._removeFormatSpaceInlineContext(true);
    },
});

});
