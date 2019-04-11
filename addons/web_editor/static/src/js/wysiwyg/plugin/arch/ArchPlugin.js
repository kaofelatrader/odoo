odoo.define('wysiwyg.plugin.arch', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var customNodes = require('wysiwyg.plugin.arch.customNodes');
var FragmentNode = require('wysiwyg.plugin.arch.fragment');
var ArchNode = require('wysiwyg.plugin.arch.node');
var Renderer = require('wysiwyg.plugin.arch.renderer');
var RootNode = require('wysiwyg.plugin.arch.root');
var text = require('wysiwyg.plugin.arch.text');
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

    formatTags: formatTags,
    voidTags: voidTags,

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
        this._reset(value || '');
        return this._arch.toString({});
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

        this.isEditableNode = this.isEditableNode.bind(this);
        this.isUnbreakableNode = this.isUnbreakableNode.bind(this);

        this._arch = new RootNode({
            parentedRules: this.parentedRules,
            customRules: this.customRules,
            orderRules: this.orderRules,
            formatTags: formatTags,
            voidTags: voidTags,

            add: this._addToArch.bind(this),
            create: this._createArchNode.bind(this),
            change: this._changeArch.bind(this),
            remove: this._removeFromArch.bind(this),

            isEditableNode: this.isEditableNode.bind(this),
            isUnbreakableNode: this.isUnbreakableNode.bind(this),
        });
        this._renderer = new Renderer(this.editable);
        this._reset();

        return promise;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    getValue: function () {
        var value = this._arch.toString({});
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
    parentIfText: function (id) {
        var archNode = this._getNode(id);
        return archNode && (archNode.isText() ? archNode.parent.id : archNode.id);
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
     * @param {JSON} json
     * @returns {ArchNode}
     **/
    import: function (json) {
        var self = this;
        var fragment = new FragmentNode(this._arch.params);
        if (!json.childNodes || json.nodeValue || json.nodeName) {
            json = {
                childNodes: [json],
            };
        }
        json.childNodes.forEach(function (json) {
            fragment.append(self._importJSON(json));
        });
        return fragment;
    },
    /**
     * @param {Int} id
     * @param {boolean} options.keepVirtual
     * @param {boolean} options.keepArchitecturalSpaces
     * @returns {JSON}
     **/
    export: function (id, options) {
        var archNode;
        if (id) {
            archNode = this._getNode(id);
        } else {
            archNode = this._arch;
        }
        return archNode ? archNode.toJSON(options) : {};
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
        return this._manager.render(id, options);
    },

    //--------------------------------------------------------------------------
    // Range methods
    //--------------------------------------------------------------------------

    getFocusedNode: function () {
        return this._renderer.getElement(this.parentIfText(this._range.scID));
    },
    /**
     * @returns {WrappedRange}
     */
    getRange: function () {
        var sc = this._renderer.getElement(this._range.scID);
        var ec = this._range.scID === this._range.ecID ? sc : this._renderer.getElement(this._range.ecID);
        return new WrappedRange({
            sc: sc,
            so: this._range.so,
            ec: ec,
            eo: this._range.eo,
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
        // getDeepeset range
        while (points.sc.childNodes[points.so]) {
            points.sc = points.sc.childNodes[points.so];
            points.so = 0;
        }
        while (points.ec.childNodes[points.eo]) {
            points.ec = points.ec.childNodes[points.eo];
            points.eo = 0;
        }

        var pointsWithIDs = {
            scID: this._renderer.whoIsThisNode(points.sc),
            so: points.so,
            ecID: points.ec ? this._renderer.whoIsThisNode(points.ec) : undefined,
            eo: points.eo,
        };

        this._setRangeWithIDs(pointsWithIDs);
    },
    /**
     * Select the target media on the right (or left)
     * of the currently selected target media.
     *
     * @param {Node} target
     * @param {Boolean} left
     */
    setRangeOnVoidBlock: function (target, left) {
        if (!target || !this.isVoidBlock(target)) {
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
     * Get the range from the selection in the DOM.
     *
     * @private
     * @returns {WrappedRange}
     */
    _getRange: function () {
        return new WrappedRange({}, this.editable.ownerDocument);
    },
    /**
     * Set the DOM Range from the given points.
     *
     * @private
     * @param {Node} sc
     * @param {Number} so
     * @param {Node} ec
     * @param {Number} eo
     */
    _select: function (sc, so, ec, eo) {
        var nativeRange = this._toNativeRange(sc, so, ec, eo);
        var selection = sc.ownerDocument.getSelection();
        if (selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
        selection.addRange(nativeRange);
    },
    /**
     * Set the range in the DOM, based on the current value of `this._range`.
     *
     * @private
     */
    _setRange: function () {
        var wrappedRange = this.getRange();
        this._select(wrappedRange.sc, wrappedRange.so, wrappedRange.ec, wrappedRange.eo);
    },
    /**
     * Set the range from the selection in the DOM.
     *
     * @private
     */
    _setRangeFromDOM: function () {
        this.setRange(this._getRange().getPoints());
    },
    /**
     * Set the range.
     * Pass only `pointsWithIDs.scID` to set the range on the whole element.
     * Pass only `pointsWithIDs.scID` and `pointsWithIDs.so` to collapse the range on the start.
     *
     * @param {Object} pointsWithIDs
     * @param {Node} pointsWithIDs.scID
     * @param {Number} [pointsWithIDs.so]
     * @param {Node} [pointsWithIDs.ecID]
     * @param {Number} [pointsWithIDs.eo] must be given if ecID is given
     */
    _setRangeWithIDs: function (pointsWithIDs) {
        var scID = pointsWithIDs.scID;
        var so = pointsWithIDs.so || 0;
        var ecID = pointsWithIDs.ecID || scID;
        var eo = pointsWithIDs.eo;
        if (!pointsWithIDs.ecID) {
            if (typeof pointsWithIDs.so === 'number') {
                eo = so;
            } else {
                var sc = this._renderer.getElement(scID);
                eo = this.utils.nodeLength(sc);
            }
        }

        var didRangeChange = this._willRangeChange(scID, so, ecID, eo);
        var isChangeElemIDs = this.parentIfText(scID) !== this.parentIfText(this._range.scID) ||
            this.parentIfText(ecID) !== this.parentIfText(this._range.ecID);

        this._range.scID = scID;
        this._range.so = so;
        this._range.ecID = ecID;
        this._range.eo = eo;
        this._setRange();

        if (didRangeChange) {
            this.trigger('range');
        }
        if (isChangeElemIDs) {
            this.trigger('focus', this.getFocusedNode());
        }
    },
    /**
     * Get the native Range object corresponding to the given range points.
     *
     * @private
     * @returns {Range}
     */
    _toNativeRange: function (sc, so, ec, eo) {
        var nativeRange = sc.ownerDocument.createRange();
        nativeRange.setStart(sc, so);
        nativeRange.setEnd(ec, eo);
        return nativeRange;
    },
    /**
     * Return true if the range will change once set to the given points.
     *
     * @param {Number} scID
     * @param {Number} so
     * @param {Number} ecID
     * @param {Number} eo
     * @returns {Boolean}
     */
    _willRangeChange: function (scID, so, ecID, eo) {
        var willOffsetChange = so !== this._range.so || eo !== this._range.eo;
        var willIDsChange = scID !== this._range.scID || ecID !== this._range.ecID;
        var willNodesChange = this._renderer.getElement(scID) !== this._renderer.getElement(this._range.scID) ||
            this._renderer.getElement(ecID) !== this._renderer.getElement(this._range.ecID);
        return willOffsetChange || willIDsChange || willNodesChange;
    },

    //--------------------------------------------------------------------------
    // Public SETTER
    //--------------------------------------------------------------------------

    /**
     * @param {DOM|null} element (by default, use the range)
     **/
    remove: function (element) {
        this._resetChange();

        var id = element && this._renderer.whoIsThisNode(element);
        if (!id) {
            this._getNode(id).remove();
        } else {
            this._removeFromRange();
        }

        var changedNodes = this._getChanges();
        this._applyChangesInRenderer();
    },
    insert: function (DOM, element, offset) {
        if (typeof DOM !== 'string' && this._renderer.whoIsThisNode(DOM)) {
            DOM = this._renderer.whoIsThisNode(DOM);
        }
        var id = this._renderer.whoIsThisNode(element);
        if (!id) {
            id = this._range.scID;
            offset = this._range.so;
        }

        this._insert(DOM, id, offset);
        this._applyChangesInRenderer();
    },
    addLine: function () {
        this._resetChange();
        this._getNode(this._range.scID).addLine(this._range.so);
        this._applyChangesInRenderer();
    },
    removeLeft: function () {
        var archNode = this._getNode(this._range.scID);
        if (this.getRange().isCollapsed()) {
            archNode.removeLeft(this._range.so);
        } else {
            archNode.remove();
        }
        this._applyChangesInRenderer();
    },
    removeRight: function () {
        var archNode = this._getNode(this._range.scID);
        if (this.getRange().isCollapsed()) {
            archNode.removeRight(this._range.so);
        } else {
            archNode.remove();
        }
        this._applyChangesInRenderer();
    },

    //--------------------------------------------------------------------------
    // Private from Common
    //--------------------------------------------------------------------------

    _applyChangesInRenderer: function () {
        var self = this;
        var changedNodes = this._getChanges();

        if (!changedNodes.length) {
            return;
        }

        var json = changedNodes.map(function (change) {
            return self.export(change.id, {
                keepVirtual: true,
            });
        });
        self._renderer.update(json);
        this.trigger_up('change');

        changedNodes.forEach(function (r) {
            console.log(r.id, self._renderer.getElement(r.id), r.offset);
        });

        if (changedNodes.length) {
            this._setRangeWithIDs({
                scID: changedNodes[0].id,
                so: changedNodes[0].offset,
            });
        }
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
    // Private from ArchManager
    //--------------------------------------------------------------------------

    /**
     * Insert a node in the Arch.
     *
     * @param {string|DOM|FragmentDOM} DOM
     * @param {DOM} [element]
     * @param {Number} [offset]
     * @returns {Number}
     */
    _insert: function (DOM, id, offset) {
        var self = this;

        var archNode = id ? this._getNode(id) : this._arch;
        var fragment;
        if (typeof DOM === 'string') {
            fragment = this._parse(DOM);
        } else if (typeof DOM === 'number') {
            archNode = this._getNode(DOM);
            if (archNode !== this._arch && !archNode.isFragment()) {
                fragment = new FragmentNode(this._arch.params);
                fragment.append(archNode);
            } else {
                fragment = archNode;
            }
        } else {
            fragment = new FragmentNode(this._arch.params);
            if (DOM.nodeType !== DOM.DOCUMENT_FRAGMENT_NODE) {
                var dom = document.createDocumentFragment();
                dom.append(DOM);
                DOM = dom;
            }
            DOM.childNodes.forEach(function (node) {
                fragment.append(self._parseElement(node));
            });
        }

        this._resetChange();

        offset = offset || 0;
        var childNodes =  fragment.childNodes.slice();
        childNodes.reverse();
        childNodes.forEach(function (child, index) {
            archNode.insert(child, offset);
        });
    },
    _importJSON: function (json) {
        var self = this;
        var archNode;
        if (json.nodeName) {
            archNode = this._createArchNode(json.nodeName, json.attributes);
            json.childNodes.forEach(function (json) {
                archNode.append(self._importJSON(json));
            });
        } else {
            archNode = this._createArchNode('TEXT', json.nodeValue);
        }
        return archNode;
    },
    /**
     * @param {string} xml
     * @returns {ArchNode}
     **/
    _parse: function (html) {
        var self = this;
        var fragment = new FragmentNode(this._arch.params);

        var reVoidNodes = new RegExp('<((' + this.voidTags.join('|') + ')[^>/]*)>', 'g');
        var xml = html.replace(reVoidNodes, '<\$1/>');
        var parser = new DOMParser();
        var element = parser.parseFromString("<root>" + xml + "</root>","text/xml");

        if (element.querySelector('parsererror')) {
            console.error(element);
            return;
        }

        var root = element.querySelector('root');

        root.childNodes.forEach(function (element) {
            fragment.append(self._parseElement(element));
        });
        return fragment;
    },
    _parseElement: function (element) {
        var self = this;
        var archNode;
        if (element.tagName) {
            var attributes = Object.values(element.attributes).map(function (attribute) {
                return [attribute.name, attribute.value];
            });
            archNode = this._createArchNode(element.nodeName, attributes);
            element.childNodes.forEach(function (child) {
                archNode.append(self._parseElement(child));
            });
        } else {
            archNode = this._createArchNode('TEXT', element.nodeValue);
        }
        return archNode;
    },
    _removeFromRange: function () {
        var fromNode = this._getNode(this.scID);
        // ==> split: this.so

        var toNode = this._getNode(this.ecID);
        // ==> split: this.eo

        fromNode.nextUntil(function (next) {
            this.remove();
            if (next === toNode) {
                next.remove();
                return true;
            }
        });
    },
    _reset: function (value) {
        this._id = 1;
        this._arch.id = 1;
        this._arch.parent = null;
        this._archNodeList = {'1':  this._arch};
        this._arch.childNodes = [];

        if (value) {
            this._insert(value, 1, 0);
            this._applyRules();
        }

        this._renderer.reset(this._arch.toJSON({keepVirtual: true}));

        this._range = {
            scID: 1,
            so: 0,
            ecID: 1,
            eo: 0,
        };

        this._changes = [];
    },
    _addToArch: function (archNode) {
        var self = this;
        if (!archNode.__removed && !archNode.id && archNode.parent && archNode.parent.id) {
            archNode.id = ++this._id;
            this._archNodeList[archNode.id] = archNode;
            if (archNode.childNodes) {
                archNode.childNodes.forEach(function (archNode) {
                    self._addToArch(archNode);
                });
            }
        }
    },
    _applyRules: function () {
        this._changes.forEach(function (c) {
            c.archNode.applyRules();
        });
    },
    _createArchNode: function (nodeName, param) {
        if (!nodeName) {
            return new text.VirtualTextNode(this);
        } else if (nodeName !== 'TEXT') {
            var Constructor = customNodes[nodeName] || ArchNode;
            return new Constructor(this._arch.params, nodeName, param || []);
        } else {
            return new text.VisibleTextNode(this._arch.params, param);
        }
    },
    _changeArch: function (archNode, offset) {
        this._changes.push({
            archNode: archNode,
            offset: offset,
        });
    },
    _getChanges: function () {
        var self = this;
        this._applyRules();

        var changes = [];
        this._changes.forEach(function (c) {
            if (!c.archNode.id || !self._getNode(c.archNode.id)) {
                return;
            }
            var toAdd = true;
            changes.forEach(function (change) {
                if (change.id === c.archNode.id) {
                    toAdd = false;
                    change.offset = c.offset;
                }
            });
            if (toAdd) {
                changes.push({
                    id: c.archNode.id,
                    offset: c.offset,
                });
            }
        });

        return changes;
    },
    _getNode: function (archNodeId) {
        return this._archNodeList[archNodeId];
    },
    _removeFromArch: function (archNode) {
        var self = this;
        if (this._archNodeList[archNode.id]) {
            delete this._archNodeList[archNode.id];

            if (archNode.childNodes) {
                archNode.childNodes.forEach(function (archNode) {
                    self.removeFromRoot(archNode);
                });
            }
        }
    },
    _resetChange: function () {
        this._changes = [];
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
