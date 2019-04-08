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
    toJSON: function () {
        var data = {
            nodeValue: this.nodeValue,
        };
        if (this.id) {
            data.id = this.id;
        }
        return data;
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
    insert: function (fragment, offset) {
        console.error('todo: implement');
    },
    isText: function () {
        return true;
    },
    isVisibleText: function (argument) {
        return true;
    },
    _applyRulesPropagation: function () {},
    _addArchitecturalSpaceNodePropagation: function () {},
    _toNode: function (options) {
        if (this.isVirtual() && !options.keepVirtual) {
            return document.createDocumentFragment();
        }

        var text = this.toString(options);
        var node = this.tree._createTextNode(this);
        if (node.textContent !== text) {
            node.textContent = text;
        }
        return node;
    },
});

//////////////////////////////////////////////////////////////

var regExpSpaceBegin = /^([\s\n\r\t]*)/;
var regExpSpaceEnd = /([\s\n\r\t]*)$/;
var regExpSpace = /\s+/g;
var VisibleTextNode = TextNode.extend({
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
        var parent = this;
        var changes = [];
        fragment.childNodes.forEach(function (archNode) {
            parent.insertAfter(archNode, self);
            changes.push(archNode.id);
        });
        this.remove();
        this.parent.applyRules();
        return changes;
    },
    isVirtual: function () {
        return true;
    },

    //--------------------------------------------------------------------------
    // Public: export
    //--------------------------------------------------------------------------

    toJSON: function () {
        return null;
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
    toJSON: function () {
        return null;
    },
    toString: function (options) {
        if (this.isVirtual() && !options.keepVirtual) {
            return '';
        }
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
