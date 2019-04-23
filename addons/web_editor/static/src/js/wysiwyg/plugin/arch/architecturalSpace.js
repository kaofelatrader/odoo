odoo.define('wysiwyg.plugin.arch.architecturalSpace', function (require) {
'use strict';

var TextNode = require('wysiwyg.plugin.arch.text');
var ArchNode = require('wysiwyg.plugin.arch.node');
function True () { return true; };
function False () { return false; };


ArchNode.include({
    toJSON: function (options) {
        if (options && options.architecturalSpace && !options.__architecturalSpace) {
            options.__architecturalSpace = true;
            this._addArchitecturalSpaceNodes();
        }
        return this._super.apply(this, arguments);
    },
    toString: function (options) {
        if (options && options.architecturalSpace && !options.__architecturalSpace) {
            options.__architecturalSpace = true;
            this._addArchitecturalSpaceNodes();
        }
        return this._super.apply(this, arguments);
    },
    _addArchitecturalSpaceNode: function () {
        if (this.__removed || !this.parent || this.parent.ancestor(this.isPre)) {
            return;
        }

        if (!this.isText() && !this.isVoid() && !this.isPre()) {
            var block = this.isBlock() && this.childNodes && this.childNodes.length;
            if (!block && this.childNodes) {
                this.childNodes.forEach(function (child) {
                    block = block || child.isBlock();
                });
            }
            if (block) {
                this.prepend(new ArchitecturalSpace(this.params), this);
            }
        }

        if (!this.parent.parent && !this.nextSibling()) { // don't add space on first level
            return;
        }

        if (this.isBlock() || this.parent.isBlock() || (this.nextSibling() && this.nextSibling().isBlock())) {
            this.parent.insertAfter(new ArchitecturalSpace(this.params), this);
        }
    },
    _addArchitecturalSpaceNodes: function () {
        var childNodes = this.childNodes && this.childNodes.slice();
        this._addArchitecturalSpaceNode();
        if (childNodes) {
            childNodes.forEach(function (child) {
                child._addArchitecturalSpaceNodes();
            });
        }
    },
});


var ArchitecturalSpace = TextNode.extend({
    init: function (root) {
        this.params = root;
        this.nodeName = 'TEXT-ARCH';
        this.params.change(this, 0);
    },
    insert: function (node, offset) {
        this.parent.insert(node, this.index());
    },
    toJSON: function (options) {
        if (this.__removed || !options || !options.architecturalSpace) {
            return null;
        }
        return {
            id: this.id,
            nodeValue: this.toString(options),
        };
    },
    toString: function (options) {
        var space = '';

        if (!this.__removed && options && options.architecturalSpace) {
            if (typeof options.architecturalSpace !== 'integer') {
                options.architecturalSpace = 4;
            }

            space = '\n';

            var level = -1; // remove editable indent
            var node = this;
            while (node.parent) {
                if (!node.isVirtual() || options.keepVirtual) {
                    level++;
                }
                node = node.parent;
            }

            level -= (this.nextSibling() ? 0 : 1);

            if (level > 0) {
                space += (new Array(level * options.architecturalSpace + 1).join(' '));
            }
        }
        return space;
    },
    /**
     * @override
     */
    isArchitecturalSpace: True,
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
    _addArchitecturalSpaceNode: function () {
        var prev = this.previousSibling();
        if (prev && prev.isArchitecturalSpace()) {
            this.remove();
        }
    },
    _addArchitecturalSpaceNodes: function () {},
});

return ArchitecturalSpace;

});
