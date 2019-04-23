odoo.define('wysiwyg.plugin.arch.text', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
function True () { return true; };
function False () { return false; };


return ArchNode.extend({
    init: function (params, nodeValue) {
        this.params = params;
        this.nodeName = 'TEXT';
        this.nodeValue = nodeValue;
        this.params.change(this, nodeValue.length);
    },
    addLine: function (offset) {
        if (!this.isEditable()) {
            console.warn("can not split a not editable node");
            return;
        }

        if (offset === this.length() && this.parent.isFormatNode() && this.parent.parent) {
            return this.parent.parent.split(this.index());
        }
        var next = this.split(offset) || this.nextSibling() || this;
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

        if (archNode.isText() && archNode.isVisibleText() && !archNode.isVirtual()) {
            this.nodeValue = this.nodeValue.slice(0, offset) + archNode.nodeValue + this.nodeValue.slice(offset);
            this.params.change(this, offset + archNode.nodeValue.length);
            return;
        }

        var next = this.split(offset);
        this.parent.insert(archNode, next.index());
    },
    toString: function (options) {
        options = options || {};
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
        this._removeSide(offset, true);
    },
    removeRight: function (offset) {
        this._removeSide(offset, false);
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
            archNode = this.params.create();
            this.before(archNode);
            return this;
        }

        if (text.length) {
            archNode = new this.constructor(this.params, text);
        } else {
            archNode = this.params.create();
        }
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
    _removeSide: function (offset, isLeft) {
        if (isLeft && offset <= 0 || !isLeft && offset >= this.length()) {
            var next = this[isLeft ? 'previousSibling' : 'nextSibling']();
            if (!next) {
                if (this.parent[isLeft ? 'previousSibling' : 'nextSibling']()) {
                    this.parent.deleteEdge(isLeft);
                }
                return;
            }
            next[isLeft ? 'removeLeft' : 'removeRight'](0);
        } else if (this.length() === 1) {
            if (!this.previousSibling() || !this.nextSibling()) {
                this.after(new VirtualText(this.params));
            }
            this.remove();
        } else {
            offset = isLeft ? offset - 1 : offset;
            this.nodeValue = this.nodeValue.slice(0, offset) + this.nodeValue.slice(offset + 1, this.length());
            this.params.change(this, offset);
        }
    },
});

});
