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
    isVirtual: True,
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
});

return RootNode;

});
