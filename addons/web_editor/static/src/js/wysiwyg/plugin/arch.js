odoo.define('wysiwyg.plugin.arch', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var BoundaryPoint = require('wysiwyg.BoundaryPoint');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $ = require('web_editor.jquery');
var _ = require('web_editor._');

var styleTags = [
    'p',
    'td',
    'th',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
];
var formatTags = [
    'abbr',
    'acronym',
    'b',
    'bdi',
    'bdo',
    'big',
    'blink',
    'cite',
    'code',
    'dfn',
    'em',
    'font',
    'i',
    'ins',
    'kbd',
    'mark',
    'nobr',
    'q',
    's',
    'samp',
    'small',
    'span',
    'strike',
    'strong',
    'sub',
    'sup',
    'tt',
    'u',
    'var',
];

var ArchPlugin = AbstractPlugin.extend({
    dependencies: [],

    // must contains parents without other node between (must match at least with one)
    structure: [
        // table > tbody
        [
            ['table'],
            ['tbody', 'thead', 'tfoot'],
        ],
        [
            ['table', 'tbody', 'thead', 'tfoot'],
            ['tr'],
        ],
        [
            ['tr'],
            ['td', 'th'],
        ],
        [
            ['ul', 'ol'],
            ['li'],
        ],
        // editable > p
        [
            ['div', 'td', 'th', 'li'],
            styleTags.concat(['ul', 'ol']),
        ],
        // H1 > i
        // b > i
        [
            styleTags.concat(formatTags),
            formatTags.concat(['TEXT']),
        ],
        [
            styleTags.concat(formatTags).concat(['div', 'td', 'th']),
            ['br'],
        ],

        // add with jinja plugin
        [
            [null], // null = no needed parent (allow to have for eg: Table > jinja)
            formatTags.concat(['Jinja.get']), // jinja node match for TEXT and jinja
        ]
    ],

    // parents order, can contains itself as parents
    ordered: [
        formatTags.concat(['br']),
    ],

    setEditorValue: function (value) {
    },
    saveEditor: function () {
    },

    //--------------------------------------------------------------------------
    // Public GETTER
    //--------------------------------------------------------------------------

    /**
     * @param {Int} id
     * @param {boolean} options.keepArchitecturalSpaces
     * @returns {JSON}
     **/
    export: function (id, options) {

    },
    getRange: function () {
        var start = this.arch;
        while (start.childNodes[start.startRange]) {
            start = start.childNodes[start.startRange];
        }
        while (end.childNodes[end.endRange]) {
            end = end.childNodes[end.endRange];
        }
        return {
            startId: start.id,
            startOffset: start.startRange,
            endId: end.id,
            endOffset: end.endRange,
        };
    },
    /**
     * @param {Int} id
     * @param {Object} [options]
     * @param {int} options.spacer
     *      number of space for indent the html (remove old architecturalSpaces if outside PRE tag)
     * @param {boolean} options.keepArchitecturalSpaces
     * @returns {string}
     **/
    render: function (id, options) {
        return this.arch.render(id);
    },

    //--------------------------------------------------------------------------
    // Public SETTER
    //--------------------------------------------------------------------------

    delete: function (fromId, fromOffset, toId, toOffset) {
        var fromNode = this.arch.getNode(fromId, fromOffset);
        var parent = fromNode.parent;
        var offset = fromNode.index();
        var toNode = this.arch.getNode(toId, toOffset);
        fromNode.nextNode(function (prev, next) {
            prev.remove();
            if (next === toNode) {
                next.remove();
                return true;
            }
        });
        // todo: boundary point takes arch node named archNode instead of dom node
        return new BoundaryPoint(parent, offset);
    },
    insert: function (DOM, id, offset) {
        var newId = this.arch.getNode(id).insert(DOM, offset);
        // ou var newId = this.arch.getNode(id).children.splice(offset, this._domToArch(arch));
        this._autoRedraw(newId, DOM);
    },
    replace: function (DOM, fromId, fromOffset, toId, toOffset) {
        var parentPoint = this.delete();
        var newId = this.insertArch(DOM, parentPoint.archNode.id, parentPoint.offset);
        this._autoRedraw(newId, DOM);
    },
    setRange: function (sc, so, ec, eo) {

    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _autoRedraw: function (id, DOM) {
        var html = this.arch.getNode(id).render();
        if (html !== DOM) {
            this._redraw(id);
        }
    },
    /**
     * @param {Int} id
     **/
    _redraw: function (id, options) {
        var html = this.render(id);
        var node = id ? this.editable.querySelector('[data-wysiwig-node-id=' + id + ']') : this.editable;
        node.innerHTML = html;
        this.trigger('redraw', id, html);
    },
    _domToArch: function () {
        // maybe inside the arch ?
    }
});

Manager.addPlugin('Arch', ArchPlugin);

return ArchPlugin;
});
