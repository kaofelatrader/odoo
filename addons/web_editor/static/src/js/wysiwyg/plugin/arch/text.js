odoo.define('wysiwyg.plugin.arch.text', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');


var TextNode = ArchNode.extend({
    init: function (tree, nodeValue) {
        this.tree = tree;
        this.nodeName = 'TEXT';
        this.nodeValue = nodeValue;
    },
    empty: function () {
        this.nodeValue = '';
    },
    toString: function (options) {
        if (this.isVirtual() && !options.keepVirtual) {
            return '';
        }
        return this.nodeValue || '';
    },
    length: function (argument) {
        return this.nodeValue.length;
    },
    /**
     * @override
     */
    isBlankNode: function () {
        return false;
    },
    /**
     * @override
     */
    isElement: function () {
        return false;
    },
    /**
     * @override
     */
    isEmpty: function () {
        return true;
    },
    /**
     * @override
     */
    isInline: function () {
        return true;
    },
    isText: function () {
        return true;
    },
    isVisibleText: function (argument) {
        return true;
    },
    _applyRulesPropagation: function () {},
    _addArchitecturalSpaceNodePropagation: function () {},
});

//////////////////////////////////////////////////////////////

var regExpSpaceBegin = /^([\s\n\r\t]*)/;
var regExpSpaceEnd = /([\s\n\r\t]*)$/;
var regExpSpace = /\s+/g;
var VisibleTextNode = TextNode.extend({
    insert: function (node, offset) {
        var next = this._split(offset);
        this.parent.insert(node, next.index());
        return [this.id, next.id];
    },
    /**
     * @override
     */
    isEmpty: function () {
        return false;
    },
    _applyRulesArchNode: function () {
        if (this.nodeValue.length && this.ancestor(this.isPre)) {
            return this._super();
        }

        var before = this.nodeValue.match(regExpSpaceBegin)[0];
        var after = before.length < this.nodeValue.length ? this.nodeValue.match(regExpSpaceEnd)[0] : '';
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
                after = '';
                var next = this.nextSibling();
                if (!next && !this.isRightEdge(ancestor)) {
                    after = ' ';
                } else if (next && next.isInline() && (!(next instanceof TextNode) || next.isVisibleText())) {
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
            this.nodeValue = text;
        } else {
            this.remove();
        }
    },
    _split: function (offset) {
        var text = this.nodeValue.slice(offset);
        this.nodeValue = this.nodeValue.slice(0, offset);
        var node = new VisibleTextNode(this.tree, text);
        this.after(node);
        return node;
    },
});

//////////////////////////////////////////////////////////////

var VirtualTextNode = TextNode.extend({
    char: '\uFEFF',
    init: function (tree) {
        this.tree = tree;
        this.nodeName = 'TEXT';
        this.nodeValue = this.char;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    insert: function (fragment, offset) {
        var self = this;
        var changes = [];
        fragment.childNodes.forEach(function (archNode) {
            self.after(archNode);
            changes.push(archNode.id);
        });
        this.remove();
        this.parent.applyRules();
        return changes;
    },
    /**
     * @override
     */
    isBlankText: function () {
        return true;
    },
    isVirtual: function () {
        return true;
    },

    //--------------------------------------------------------------------------
    // Public: export
    //--------------------------------------------------------------------------

    toJSON: function (options) {
        if (!options || !options.keepVirtual) {
            return null;
        }
        return this._super(options);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyRulesArchNode: function () {},
    _applyRulesCheckParents: function () {},
    _addArchitecturalSpaceNode: function () {},
});

//////////////////////////////////////////////////////////////

var ArchitecturalSpaceNode = TextNode.extend({
    init: function (tree, nodeValue) {
        this._super.apply(this, arguments);
        this.nodeName = 'TEXT-ARCH';
    },
    toJSON: function (options) {
        if (!options || !options.architecturalSpace) {
            return null;
        }
        return {
            id: this.id,
            nodeValue: this.toString(),
        };
    },
    toString: function (options) {
        var space = '';
        if (options.architecturalSpace) {
            space = '\n';
            var level = (options.architecturalLevel || 0) - (this.nextSibling() ? 0 : 1);
            if (level > 0) {
                space += (new Array(level * options.architecturalSpace + 1).join(' '));
            }
        }
        return space;
    },
    /**
     * @override
     */
    isArchitecturalSpaceNode: function () {
        return true;
    },
    /**
     * @override
     */
    isBlankText: function () {
        return true;
    },
    isVisibleText: function (argument) {
        return false;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyRulesCheckParents: function () {},
    _addArchitecturalSpaceNode: function () {},
});

return {
	TextNode: TextNode,
	VisibleTextNode: VisibleTextNode,
	VirtualTextNode: VirtualTextNode,
	ArchitecturalSpaceNode: ArchitecturalSpaceNode,
};

});
