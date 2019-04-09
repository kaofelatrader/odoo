odoo.define('wysiwyg.plugin.arch', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var BoundaryPoint = require('wysiwyg.BoundaryPoint');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var ArchManager = require('wysiwyg.plugin.arch.ArchManager');
var Renderer = require('wysiwyg.plugin.arch.renderer');

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

    customRules: [
        // [function (json) { return json; },
        // ['TEXT']],
    ],

    // children must contains parents without other node between (must match at least with one)
    //
    // [parents, children]
    // parents must be the nodeName or null
    //    null = no needed parent (allow to have for eg: Table > jinja)
    // children is the nodeName (or uppercase custom NodeName)
    //    or a method who receive the export json and return a boolean
    //    or the "pluginName.methodName" who receive the export json and return a boolean
    parentedRules: [
        // table > tbody
        [
            ['table'],
            ['tbody', 'thead', 'tfoot'],
        ],
        [
            ['tbody', 'thead', 'tfoot'],
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
            ['EDITABLE', 'div', 'td', 'th', 'li'],
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
    orderRules: [
        formatTags.concat(['br']),
    ],

    isVoidBlockList: ['Arch._isVoidBlock'],
    isUnbreakableNodeList: ['Arch._isUnbreakableNode'],
    isEditableNodeList: ['Arch._isEditableNode'],

    init: function (parent, params, options) {
        this._super.apply(this, arguments);
        this.customRules = this.customRules.slice();
        this.parentedRules = this.parentedRules.slice();
        this.orderRules = this.orderRules.slice();

        this.isVoidBlockList = this.isVoidBlockList.slice();
        this.isUnbreakableNodeList = this.isUnbreakableNodeList.slice();
        this.isEditableNodeList = this.isEditableNodeList.slice();

        if (this.options.customRules) {
            this.customRules.push.apply(this.customRules, this.options.customRules);
        }
        if (this.options.parentedRules) {
            this.parentedRules.push.apply(this.parentedRules, this.options.parentedRules);
        }
        if (this.options.orderRules) {
            this.orderRules.push.apply(this.orderRules, this.options.orderRules);
        }
        if (this.options.isVoidBlock) {
            this.isVoidBlock.push.apply(this.isVoidBlock, this.options.isVoidBlock);
        }
        if (this.options.isUnbreakableNode) {
            this.isUnbreakableNode.push.apply(this.isUnbreakableNode, this.options.isUnbreakableNode);
        }
        if (this.options.isEditableNode) {
            this.isEditableNode.push.apply(this.isEditableNode, this.options.isEditableNode);
        }

        var self = this;
        ['customRules', 'parentedRules'].forEach(function (name) {
            self[name].forEach(function (rule) {
                rule[1].forEach(function (checker) {
                    if (typeof checker === 'string' && checker.indexOf('.') !== -1) {
                        checker = checker.split('.');
                        self.dependencies.push(checker[0]);
                    }
                });
            });
        });
        ['isVoidBlockList', 'isUnbreakableNodeList', 'isEditableNodeList'].forEach(function (name) {
            self[name].forEach(function (checker) {
                if (typeof checker === 'string' && checker.indexOf('.') !== -1) {
                    checker = checker.split('.');
                    self.dependencies.push(checker[0]);
                }
            });
        });
    },
    setEditorValue: function (value) {
        this.manager.reset(value || '');
        this.renderer.reset(this.manager.toJSON());
        return this.manager.toString();
    },
    start: function () {
        var promise = this._super();

        var self = this;
        ['customRules', 'parentedRules'].forEach(function (name) {
            self[name].forEach(function (rule) {
                rule[1] = rule[1].map(function (checker) {
                    if (typeof checker === 'string' && checker.indexOf('.') !== -1) {
                        checker = checker.split('.');
                        var Plugin = self.dependencies[checker[0]];
                        return Plugin[checker[1]].bind(Plugin);
                    }
                    return checker;
                });
            });
        });
        ['isVoidBlockList', 'isUnbreakableNodeList', 'isEditableNodeList'].forEach(function (name) {
            self[name] = self[name].map(function (checker) {
                if (typeof checker === 'string' && checker.indexOf('.') !== -1) {
                    checker = checker.split('.');
                    var Plugin = self.dependencies[checker[0]];
                    return Plugin[checker[1]].bind(Plugin);
                }
                return checker;
            });
        });

        this.renderer = new Renderer(this.editable);

        this.manager = new ArchManager({
            parentedRules: this.parentedRules,
            customRules: this.customRules,
            orderRules: this.orderRules,
            isEditableNode: this.isEditableNode.bind(this),
            isUnbreakableNode: this.isUnbreakableNode.bind(this),
            formatTags: formatTags,
        });

        return promise;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    getValue: function () {
        var value = this.manager.toString();
        console.log(value);
        return value;
    },
    addCustomRule: function (callback, children) {
        this.customRules.push([callback, children]);
    },
    addStructureRule: function (parents, children) {
        this.parentedRules.push([parents, children]);
    },
    addOrderedList: function (list) {
        this.orderRules.push(list);
    },

    //--------------------------------------------------------------------------
    // Public from Common
    //--------------------------------------------------------------------------

    /**
     * Add a method to the `_isVoidBlock` array.
     *
     * @see isVoidBlock
     * @see _isVoidBlock
     * @param {Function (Node)} fn
     */
    addVoidBlockCheck: function (fn) {
        if (this.isVoidBlockList.indexOf(fn) === -1) {
            this.isVoidBlockList.push(fn);
        }
    },
    addUnbreakableNodeCheck: function (fn) {
        if (this.isUnbreakableNodeList.indexOf(fn) === -1) {
            this.isUnbreakableNodeList.push(fn);
        }
    },
    addEditableNodeCheck: function (fn) {
        if (this.isEditableNodeList.indexOf(fn) === -1) {
            this.isEditableNodeList.push(fn);
        }
    },
    /**
     * Return true if the node is a block media to treat like a block where
     * the cursor can not be placed inside like the void.
     * The conditions can be extended by plugins by adding a method with
     * `addVoidBlockCheck`. If any of the methods returns true, this will too.
     *
     * @see _isVoidBlock
     * @see addVoidBlockCheck
     * @param {Node} node
     * @returns {Boolean}
     */
    isVoidBlock: function (archNode) {
        for (var i = 0; i < this.isVoidBlockList.length; i++) {
            if (this.isVoidBlockList[i](archNode)) {
                return true;
            }
        }
        return false;
    },
    /**
     * Return true if the current node is unbreakable.
     * An unbreakable node can be removed or added but can't by split into
     * different nodes (for keypress and selection).
     * An unbreakable node can contain nodes that can be edited.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isUnbreakableNode: function (node) {
        for (var i = 0; i < this.isUnbreakableNodeList.length; i++) {
            if (this.isUnbreakableNodeList[i](node)) {
                return true;
            }
        }
        return false;
    },
    /**
     * Return true if the current node is editable (for keypress and selection).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isEditableNode: function (node) {
        for (var i = 0; i < this.isEditableNodeList.length; i++) {
            if (!this.isEditableNodeList[i](node)) {
                return false;
            }
        }
        return true;
    },

    //--------------------------------------------------------------------------
    // Public GETTER
    //--------------------------------------------------------------------------

    /**
     * @param {Int} id
     * @param {boolean} options.keepArchitecturalSpaces
     * @returns {JSON}
     **/
    export: function (id) {
        if (id) {
            return this.manager.getNode(id).toJSON();
        }
        return this.manager.toJSON();
    },
    getRange: function () {
        return this.manager.getRange();
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
        return this.manager.render(id, options);
    },

    //--------------------------------------------------------------------------
    // Public SETTER
    //--------------------------------------------------------------------------

    /**
     * @param {DOM|null} element (by default, use the range)
     **/
    remove: function (element) {
        var id = element && this.renderer.whoIsThisNode(element);
        return this.manager.remove(id);
    },
    insert: function (DOM, element, offset) {
        if (typeof DOM !== 'string' && this.renderer.whoIsThisNode(DOM)) {
            DOM = this.renderer.whoIsThisNode(DOM);
        }
        var id = this.renderer.whoIsThisNode(element);
        var newIds = this.manager.insert(DOM, id, offset);
        this.renderer.update(this.manager.toJSON({
            keepVirtual: true,
        }));
        return newIds;
    },
    setRange: function (sc, so, ec, eo) {
        sc = this.renderer.whoIsThisNode(sc);
        ec = this.renderer.whoIsThisNode(ec);

        return this.manager.setRange(sc, so, ec, eo);
    },
    addLine: function () {
    },
    removeLeft: function () {
    },
    removeRight: function () {
    },


    //--------------------------------------------------------------------------
    // Private from Common
    //--------------------------------------------------------------------------

    _isVoidBlock: function (archNode) {
        return archNode.attributes && archNode.attributes.contentEditable === 'false';
    },
    _isUnbreakableNode: function (archNode) {
        return  node === this.editable || !this.isEditableNode(node.parentNode);
    },
    _isEditableNode: function (node) {
        node = node && (node.isText() ? node : node.parent);
        if (!node) {
            return false;
        }
        return ['table', 'thead', 'tbody', 'tfoot', 'tr'].indexOf(node.nodeName.toLowerCase()) === -1;
    },
});


/*
`
            Bonjour,
            <br>
            <b>comment va-<i>tu</i> ?</b>
            <table><td>wrong TD</td> free text in table</table>
            <i><font color="red">comment</font> <font color="blue">va-<b>tu</b></font> ?</i>
            <div>
                text dans div ?

                if (div) {
                    console.log('div');
                }
            </div>
            <pre> 
                if (tata) {
                    console.log('tutu');
                }

                <span>OKI</span>
            </pre>

            <section>
                <block>
                    % if toto:
                    TOTO
                    %end
                </block>
            </section>
            <p>
                <i>iiii</i> <iframe src="/test"/> <b>bbb</b>
            </p>
            `
*/
Manager.addPlugin('Arch', ArchPlugin);

return ArchPlugin;
});
