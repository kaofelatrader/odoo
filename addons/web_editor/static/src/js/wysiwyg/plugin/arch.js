odoo.define('wysiwyg.plugin.arch', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var BoundaryPoint = require('wysiwyg.BoundaryPoint');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var ArchTree = require('wysiwyg.plugin.arch_tree');

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
    // null = no needed parent (allow to have for eg: Table > jinja)
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
            ['editable', 'div', 'td', 'th', 'li'],
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
    ],

    // parents order, can contains itself as parents
    ordered: [
        formatTags.concat(['br']),
    ],

    init: function (parent, params, options) {
        this._super.apply(this, arguments);
        this.structure = this.structure.slice();
        this.ordered = this.ordered.slice();
    },
    setEditorValue: function (value) {
        var archNode = this._htmlToArch(value);
        return archNode.toText();
    },
    saveEditor: function () {
    },
    start: function () {
        var promise = this._super();
        this.arch = new ArchTree({
            structure: this.structure,
            ordered: this.ordered,
            styleTags: styleTags,
            formatTags: formatTags,
            isEditableNode: this.dependencies.Common.isEditableNode,
            isUnbreakableNode: this.dependencies.Common.isUnbreakableNode,
        });
        return promise;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    addStructureRule: function (parents, children) {
        this.structure.push([parents, children]);
    },
    addOrderedList: function (list) {
        this.ordered.push(list);
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
        return this.arch.export(id, options);
    },
    getRange: function () {
        return this.arch.getRange();
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
        return this.arch.render(id, options);
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
    _htmlToArch: function (html) {
        var archNode = this.arch.parse(html);

        var archNode = this.arch.parse(`

            Bonjour,
            <br>
            <b>comment va-<i>tu</i> ?</b>
            <table><td>wrong TD</td></table>
            <i><font color="red">comment</font> <font color="blue">va-<b>tu</b></font> ?</i>
            <div>
                text dans div ?
            </div>
            `);

        console.log(archNode);
        console.log(archNode.toNode());
        console.log(archNode.toText());


        return archNode;
    },
});

Manager.addPlugin('Arch', ArchPlugin);

return ArchPlugin;
});
