odoo.define('wysiwyg.plugin.arch.text', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
function True () { return true; };
function False () { return false; };


var TextNode = ArchNode.extend({
    init: function (root, nodeValue) {
        this.params = root;
        this.nodeName = 'TEXT';
        this.nodeValue = nodeValue;

        this.params.change(this, nodeValue.length);
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
    insert: function (archNode, offset) {
        if (!this.isEditable()) {
            console.warn("can not split a not editable node");
            return;
        }

        if (archNode.isText() && archNode.isVisibleText()) {
            this.nodeValue = this.nodeValue.slice(0, offset) + archNode.nodeValue + this.nodeValue.slice(offset);
            this.params.change(this, offset + archNode.nodeValue.length);
            return;
        }

        var next = this.split(offset);
        this.parent.insert(archNode, next.index());
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
    removeLeft: function (offset) {
        if (offset <= 0) {
            var previousSibling = this.previousSibling();
            if (!previousSibling) {
                return;
            }
            previousSibling.removeLeft(0);
        } else if (this.length() === 1) {
            if (!this.previousSibling() || !this.nextSibling()) {
                this.after(new VirtualTextNode(this.params));
            }
            this.remove();
        } else {
            this.nodeValue = this.nodeValue.slice(0, offset - 1) + this.nodeValue.slice(offset, this.length());
            this.params.change(this, offset - 1);
        }
    },
    removeRight: function (offset) {
        if (offset >= this.length()) {
            var nextSibling = this.nextSibling();
            if (!nextSibling) {
                return;
            }
            nextSibling.removeRight(0);
        } else if (this.length() === 1) {
            if (!this.previousSibling() || !this.nextSibling()) {
                this.after(new VirtualTextNode(this.params));
            }
            this.remove();
        } else {
            this.nodeValue = this.nodeValue.slice(0, offset) + this.nodeValue.slice(offset + 1, this.length());
            this.params.change(this, offset);
        }
    },
    split: function (offset) {
        if (!this.isEditable()) {
            console.warn("can not split a not editable node");
            return;
        }

        var text = this.nodeValue.slice(offset);
        var archNode;

        if (offset === 0) {
            this.params.change(this, 0);
            archNode = new VirtualTextNode(this.params);
            this.before(archNode);
            return this;
        }

        var Constructor = text.length ? this.constructor : VirtualTextNode;
        archNode = new Constructor(this.params, text);
        this.params.change(archNode, 0); // set the last change to move range automatically

        this.nodeValue = this.nodeValue.slice(0, offset);
        this.params.change(this, offset);

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

var regExpSpaceBegin = /^([ \n\r\t\uFEFF]*)/;
var regExpSpaceEnd = /([ \n\r\t\uFEFF]*)$/;
var regExpSpace = /[ \t\r\n\uFEFF]+/g;
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
                this.params.change(this, 0);
            }
        } else {
            this.remove();
        }
    },
});

//////////////////////////////////////////////////////////////

var VirtualTextNode = TextNode.extend({
    char: '\uFEFF',
    init: function (root) {
        this.params = root;
        this.nodeName = 'TEXT-VIRTUAL';
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

    _applyRulesArchNode: function () {
        var para = this.ancestor(this._isPara);
        if (!para) {
            this.remove();
            return;
        }

        if (para.isEmpty()) {
            this._mutation('br');
            return;
        }
    },
    _applyRulesCheckParents: function () {},
    _addArchitecturalSpaceNode: function () {},
    _mutation: function (nodeName, param) {
        var archNode = this.params.create(nodeName, param);
        archNode.id = this.id;
        this.before(archNode);
        this.id = null;
        this.remove();
    },
});

//////////////////////////////////////////////////////////////

var ArchitecturalSpaceNode = TextNode.extend({
    init: function (root, nodeValue) {
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
