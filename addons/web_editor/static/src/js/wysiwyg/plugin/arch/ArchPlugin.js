odoo.define('wysiwyg.plugin.arch', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var ArchManager = require('wysiwyg.plugin.arch.ArchManager');
var Renderer = require('wysiwyg.plugin.arch.renderer');
var WrappedRange = require('wysiwyg.WrappedRange');

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
var voidTags = [
    'br',
    'img',
    'iframe',
    'hr',
    'input'
];

var ArchPlugin = AbstractPlugin.extend({
    dependencies: [],

    customRules: [
        // [function (json) { return json; },
        // ['TEXT']],
    ],

    editableDomEvents: {
        'mouseup': '_onMouseUp',
        'keyup': '_onKeyup',
    },

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

        this.range = {
            scID: 1,
            so: 0,
            ecID: 1,
            eo: 0,
        };

        this.renderer = new Renderer(this.editable);

        this.manager = new ArchManager({
            parentedRules: this.parentedRules,
            customRules: this.customRules,
            orderRules: this.orderRules,
            isEditableNode: this.isEditableNode.bind(this),
            isUnbreakableNode: this.isUnbreakableNode.bind(this),
            formatTags: formatTags,
            voidTags: voidTags,
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
    // Range methods
    //--------------------------------------------------------------------------

    getFocusedNode: function () {
        return this.renderer.getElement(this.range.scID); // parent if text
    },
    /**
     * @returns {WrappedRange}
     */
    getRange: function () {
        var sc = this.renderer.getElement(this.range.scID);
        var ec = this.range.scID === this.range.ecID ? sc : this.renderer.getElement(this.range.ecID);
        return new WrappedRange({
            sc: sc,
            so: this.range.so,
            ec: ec,
            eo: this.range.eo,
        }, this.editable.ownerDocument);
    },
    /**
     * Set the range.
     * Pass only `points.sc` to set the range on the whole element.
     * Pass only `points.sc` and `points.so` to collapse the range on the start.
     *
     * @param {Object} points
     * @param {Node} points.sc
     * @param {Number} [points.so]
     * @param {Node} [points.ec]
     * @param {Number} [points.eo] must be given if ec is given
     */
    setRange: function (points) {
        this.range.scID = this.renderer.whoIsThisNode(points.sc);
        this.range.so = points.so || 0;
        this.range.ecID = points.ec ? this.renderer.whoIsThisNode(points.ec) : this.range.scID;
        this.range.eo = points.ec ? points.eo : (typeof points.so === 'number' ? points.so : this.utils.nodeLength(points.sc));
        this._setRange();
        this.trigger('focus'); // if change of IDs (or of parent ID if text)
        this.trigger('range'); // if change of offset or of node or of IDs
    },
    /**
     * Select the target media on the right (or left)
     * of the currently selected target media.
     *
     * @private
     * @param {Node} target
     * @param {Boolean} left
     */
    setRangeOnVoidBlock: function (target, left) {
        if (!target || !this.dependencies.Arch.isVoidBlock(target)) {
            return;
        }
        var range = this._getRange();
        var contentEditable;
        var targetClosest;

        if (
            range.sc.tagName && target.contains(range.sc) &&
            range.sc.classList.contains('o_fake_editable') &&
            left === !range.sc.previousElementSibling
        ) {
            contentEditable = this.utils.ancestor(range.sc, function (node) {
                return node.getAttribute('contentEditable');
            });
            targetClosest = this.utils.ancestor(target, function (node) {
                return node.getAttribute('contentEditable');
            });
            if (targetClosest !== contentEditable) {
                contentEditable.focus();
            }
            this.save();
            return;
        }

        var next = this.getPoint(target, 0);
        var method = left ? 'prevUntil' : 'nextUntil';
        next = next[method](function (point) {
            return point.node !== target && !target.contains(point.node) ||
                point.node.contentEditable === 'true' ||
                point.node.classList && point.node.classList.contains('o_fake_editable');
        });
        if (!next || next.node !== target && !target.contains(next.node)) {
            next = this.getPoint(target, 0);
        }

        contentEditable = this.utils.ancestor(next.node, function (node) {
            return node.getAttribute('contentEditable');
        });
        targetClosest = this.utils.ancestor(target, function (node) {
            return node.getAttribute('contentEditable');
        });
        if (targetClosest !== contentEditable) {
            // move the focus only if the new contentEditable is not the same (avoid scroll up)
            // (like in the case of a video, which uses two contentEditable in the media, so as to write text)
            contentEditable.focus();
        }

        if (range.sc !== next.node || range.so !== next.offset) {
            this.setRange({
                sc: next.node,
                so: next.offset,
            });
        }
    },
    /**
     * @returns {WrappedRange}
     */
    _getRange: function () {
        return new WrappedRange({}, this.editable.ownerDocument);
    },
    _select: function (sc, so, ec, eo) {
        var nativeRange = this._toNativeRange(sc, so, ec, eo);
        var selection = sc.ownerDocument.getSelection();
        if (selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
        selection.addRange(nativeRange);
    },
    _setRange: function () {
        var wrappedRange = this.getRange();
        this._select(wrappedRange.sc, wrappedRange.so, wrappedRange.ec, wrappedRange.eo);
    },
    _setRangeFromDOM: function () {
        this.setRange(this._getRange().getPoints());
    },
    /**
     * Get the native Range object corresponding to the given range.
     *
     * @returns {Range}
     */
    _toNativeRange: function (sc, so, ec, eo) {
        var nativeRange = sc.ownerDocument.createRange();
        nativeRange.setStart(sc, so);
        nativeRange.setEnd(ec, eo);
        return nativeRange;
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
        if (!id) {
            id = this.range.scID;
            offset = this.range.so;
        }
        var changedNodes = this.manager.insert(DOM, id, offset);
        this._applyChangesInRenderer(changedNodes);

        if (changedNodes.length) {
            this.dependencies.Arch.setRange({
                sc: this.renderer.getElement(changedNodes[0].id),
                so: changedNodes[0].offset,
            });
        }
    },
    addLine: function () {
        var changedNodes = this.manager.addLine(this.range);
        this._applyChangesInRenderer(changedNodes);


        var self = this;
        changedNodes.forEach(function (r) {
            console.log(r.id, self.renderer.getElement(r.id));
        });

        if (changedNodes.length) {
            this.setRange({
                sc: this.renderer.getElement(changedNodes[0].id),
                so: changedNodes[0].offset,
            });
        }
    },
    removeLeft: function () {
    },
    removeRight: function () {
    },


    //--------------------------------------------------------------------------
    // Private from Common
    //--------------------------------------------------------------------------

    _applyChangesInRenderer: function (changedNodes) {
        var self = this;
        if (!changedNodes.length) {
            return;
        }

        console.log(changedNodes.map(function (r) {return r.id;}));

        var json = changedNodes.map(function (change) {
            return self.manager.export(change.id, {
                keepVirtual: true,
            });
        });
        self.renderer.update(json);
        this.trigger_up('change');
    },
    _isVoidBlock: function (archNode) {
        return archNode.attributes && archNode.attributes.contentEditable === 'false';
    },
    _isUnbreakableNode: function (archNode) { // TODO
        return false;
        return  node === this.editable || !this.isEditableNode(node.parentNode);
    },
    _isEditableNode: function (archNode) {
        console.warn('todo');
        return false;
        archNode = archNode && (archNode.isText() ? archNode : archNode.parent);
        if (!archNode) {
            return false;
        }
        return ['table', 'thead', 'tbody', 'tfoot', 'tr'].indexOf(archNode.nodeName.toLowerCase()) === -1;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {jQueryEvent} e
     */
    _onKeyup: function (e) {
        var isNavigationKey = e.keyCode >= 33 && e.keyCode <= 40;
        if (isNavigationKey) {
            this._setRangeFromDOM();
        }
    },
    /**
     * trigger up a range event when receive a mouseup from editable
     */
    _onMouseUp: function (ev) {
        this._setRangeFromDOM();
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
