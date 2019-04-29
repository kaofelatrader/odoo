odoo.define('wysiwyg.plugin.arch.architecturalSpace', function (require) {
'use strict';

var TextNode = require('wysiwyg.plugin.arch.text');
var ArchNode = require('wysiwyg.plugin.arch.node');
function True () { return true; };
function False () { return false; };


ArchNode.include({
    toJSON: function (options) {
        if (options && options.architecturalSpace && !this._hasArchitecturalSpace && !options.noInsert) {
            this._addArchitecturalSpaceNodes();
        }
        return this._super.apply(this, arguments);
    },
    toString: function (options) {
        if (options && options.architecturalSpace && !this._hasArchitecturalSpace && !options.noInsert) {
            this._addArchitecturalSpaceNodes();
        }
        return this._super.apply(this, arguments);
    },
    /**
     * @see https://google.github.io/styleguide/htmlcssguide.html#General_Formatting
     */
    _addArchitecturalSpaceNode: function () {
        if (this.__removed || !this.parent || this.ancestor(this.isPre) || this._hasArchitecturalSpace) {
            return;
        }

        if (this.isBlock() && (this.parent.isBlock() || this.parent.isRoot() && this.previousSibling())) {
            this.before(new ArchitecturalSpace(this.params));
            if (!this.nextSibling()) {
                this.after(new ArchitecturalSpace(this.params));
            }
            this._hasArchitecturalSpace = true;
        }
    },
    _addArchitecturalSpaceNodes: function () {
        this._addArchitecturalSpaceNode();
        var visibleChildren = this.visibleChildren();
        if (visibleChildren) {
            visibleChildren.forEach(function (child) {
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
            var indent = typeof options.architecturalSpace === 'integer' ? options.architecturalSpace : 4;

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
                space += (new Array(level * indent + 1).join(' '));
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
    /**
     * @override
     */
    _nextSibling: function (fn) {
        return this.nextSibling(fn);
    },
    /**
     * @override
     */
    _previousSibling: function (fn) {
        return this.previousSibling(fn);
    },
});

return ArchitecturalSpace;

});
