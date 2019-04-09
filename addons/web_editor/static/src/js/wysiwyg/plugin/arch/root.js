odoo.define('wysiwyg.plugin.arch.root', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');


var RootNode = ArchNode.extend({
    init: function (tree) {
        this.tree = tree;
        this.nodeName = 'EDITABLE';
        this.childNodes = [];
    },
    index: function () {
        return null;
    },
    insert: function (fragment, offset) {
        if (offset || offset === 0) {
            return this._changeParent(fragment, offset + 1);
        }
        this.append(fragment);
    },
    isContentEditable: function () {
        return true;
    },
    /**
     * @override
     */
    isElement: function () {
        return false;
    },
    isVirtual: function () {
        return true;
    },
    toJSON: function (options) {
        var data = {
            id: this.id,
        };
        var childNodes = [];
        this.childNodes.forEach(function (archNode) {
            var json = archNode.toJSON(options);
            if (json) {
                if (json.nodeName || json.nodeValue) {
                    childNodes.push(json);
                } else if (json.childNodes) {
                    childNodes = childNodes.concat(json.childNodes);
                }
            }
        });
        data.childNodes = childNodes;
        return data;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _prevNextUntil: function (direction, fn, __closestUnbreakable, __goUp) {
        if (!__closestUnbreakable) {
            __closestUnbreakable = this;
            var next = this._super.apply(this, arguments);
            if (next) {
                return next;
            }
        }

        var insertMethod = this[direction === 'next' ? 'append' : 'prepend'].bind(this);
        return this.tree._generateVirtualNode(this, insertMethod, fn);
    },
});

return RootNode;

});
