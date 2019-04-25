odoo.define('wysiwyg.plugin.arch.root', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
function True () { return true; };
function False () { return false; };


var RootNode = ArchNode.extend({
    init: function (params) {
        this.params = params;
        params.root = this;
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
    remove: function () {
        throw new Error("Can not remove the root");
    },
    /**
     * @override
     */
    isContentEditable: True,
    /**
     * @override
     */
    isElement: False,
    /**
     * @override
     */
    isRoot: True,
    /**
     * @override
     */
    isVirtual: True,
    /**
     * @override
     */
    split: function (offset) {
        var virtualText = this.params.create();
        this.childNodes[offset].after(virtualText);
        return virtualText;
    },
    /**
     * @override
     */
    toJSON: function (options) {
        var data = this._super(options);
        delete data.nodeName;
        return data;
    },
    /**
     * @override
     */
    toString: function (options) {
        var string = '';
        this.childNodes.forEach(function (archNode) {
            string += archNode.toString(options);
        });
        return string;
    },
});

return RootNode;

});
