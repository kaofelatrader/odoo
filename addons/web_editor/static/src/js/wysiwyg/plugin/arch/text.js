odoo.define('wysiwyg.plugin.arch.text', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
function True () { return true; };
function False () { return false; };


var TextNode = ArchNode.extend({
    init: function (tree, nodeValue) {
        this.tree = tree;
        this.nodeName = 'TEXT';
        this.nodeValue = nodeValue;

        this.tree._markChange(this, nodeValue.length);
    },
    addLine: function (offset) {
        if (!this.isEditable()) {
            console.warn("can not split a not editable node");
            return;
        }

        var next = this.split(offset);
        return this.parent.addLine(next.index());
    },
    empty: function () {
        this.nodeValue = '';
    },
    insert: function (node, offset) {
        if (!this.isEditable()) {
            console.warn("can not split a not editable node");
            return;
        }

        var next = this.split(offset);
        this.parent.insert(node, next.index());
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
    isBlankNode: False,
    /**
     * @override
     */
    isBlankText: False,
    /**
     * @override
     */
    isElement: False,
    /**
     * @override
     */
    isEmpty: function () {
        return !!this.nodeValue.length;
    },
    /**
     * @override
     */
    isInline: True,
    /**
     * @override
     */
    isNodeBlockType: False,
    /**
     * @override
     */
    isText: True,
    /**
     * @override
     */
    isVisibleText: True,
    split: function (offset) {
        if (!this.isEditable()) {
            console.warn("can not split a not editable node");
            return;
        }

        var text = this.nodeValue.slice(offset);
        var Constructor = text.length ? this.constructor : VirtualTextNode;
        var archNode = new Constructor(this.tree, text);
        this.tree._markChange(archNode, 0);

        this.nodeValue = this.nodeValue.slice(0, offset);
        this.tree._markChange(this, offset);

        this.after(archNode);
        return archNode;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyRulesPropagation: function () {},
    _addArchitecturalSpaceNodePropagation: function () {},
});

//////////////////////////////////////////////////////////////

var regExpSpaceBegin = /^([\s\n\r\t]*)/;
var regExpSpaceEnd = /([\s\n\r\t]*)$/;
var regExpSpace = /\s+/g;
var VisibleTextNode = TextNode.extend({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

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
            if (this.nodeValue !== text) {
                this.nodeValue = text;
                this.tree._markChange(this, 0);
            }
        } else {
            this.remove();
        }
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

    insert: function (node, offset) {
        this.parent.insert(node, this.index());
        this.remove();
    },
    /**
     * @override
     */
    isBlankNode: True,
    /**
     * @override
     */
    isBlankText: True,
    /**
     * @override
     */
    isEmpty: True,
    /**
     * @override
     */
    isVirtual: True,
    /**
     * @override
     */
    split: False,

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
    insert: function (node, offset) {
        this.parent.insert(node, this.index());
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
    isArchitecturalSpaceNode: True,
    /**
     * @override
     */
    isBlankNode: True,
    /**
     * @override
     */
    isBlankText: True,
    /**
     * @override
     */
    isEmpty: True,
    /**
     * @override
     */
    isVisibleText: False,
    /**
     * @override
     */
    split: False,

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
