odoo.define('web_editor.wysiwyg.plugin.list', function (require) {
'use strict';

var core = require('web.core');
var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var wysiwygOptions = require('wysiwyg.options');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var _t = core._t;

wysiwygOptions.keyMap.pc['CTRL+SHIFT+NUM9'] = 'insertCheckList';
wysiwygOptions.keyMap.mac['CMD+SHIFT+NUM9'] = 'insertCheckList';


var ListPlugin = AbstractPlugin.extend({
    dependencies: ['Range', 'FontStyle'],

    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_list.xml'],

    buttons: {
        template: 'wysiwyg.buttons.list',
        active: function (buttonName, range) {
            return this._active(buttonName, range);
        },
    },

    editableDomEvents: {
        'summernote.mousedown': '_onMouseDown',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Convert ul<->ol or remove ul/ol.
     *
     * @param {boolean} isWithinElem true if selection already inside the LI
     * @param {DOM[]} nodes selected nodes
     * @param {Object} startPoint
     * @param {Object} endPoint
     * @param {boolean} sorted
     * @returns {boolean} isWithinElem
     */
    convertList: function (isWithinElem, nodes, startPoint, endPoint, sorted) {
        var self = this;
        var ol = this.utils.ancestor(startPoint.node, this.utils.isList);
        var parent = ol.parentNode;

        // get selected lis

        var lis = [];
        var lisBefore = [];
        var lisAfter = [];
        _.each(ol.children, function (li) {
            if (!isWithinElem && (li === startPoint.node || $.contains(li, startPoint.node))) {
                isWithinElem = true;
            }
            if (isWithinElem) {
                lis.push(li);
            } else if (lis.length) {
                lisAfter.push(li);
            } else {
                lisBefore.push(li);
            }
            if (isWithinElem && (li === endPoint.node || $.contains(li, endPoint.node))) {
                isWithinElem = false;
            }
        });

        var res = lis;

        if (lisBefore.length) {
            var ulBefore = this.document.createElement(ol.tagName);
            ulBefore.className = ol.className;

            if (this.utils.isLi(ol.parentNode)) {
                var li = this.document.createElement('li');
                li.className = ol.parentNode.className;
                $(li).insertBefore(ol.parentNode);
                li.appendChild(ulBefore);
            } else {
                $(ulBefore).insertBefore(ol);
            }

            $(ulBefore).append(lisBefore);
        }
        if (lisAfter.length) {
            var ulAfter = this.document.createElement(ol.tagName);
            ulAfter.className = ol.className;

            if (this.utils.isLi(ol.parentNode)) {
                var li = this.document.createElement('li');
                li.className = ol.parentNode.className;
                $(li).insertAfter(ol.parentNode);
                li.appendChild(ulAfter);
            } else {
                $(ulAfter).insertAfter(ol);
            }

            $(ulAfter).append(lisAfter);
        }

        // convert ul<->ol or remove list
        var current = ol.tagName === 'UL' && ol.className.indexOf('o_checklist') !== -1 ? 'checklist' : ol.tagName.toLowerCase();
        if (current !== sorted) {
            // convert ul <-> ol

            var ul;
            if (sorted === 'checklist' && current === "ul") {
                ul = ol;
            } else if (sorted === 'ul' && current === 'checklist') {
                $(ol).removeClass('o_checklist');
                ul = ol;
            } else {
                $(ol).removeClass('o_checklist');
                ul = this.document.createElement(sorted === "ol" ? "ol" : "ul");
                ul.className = ol.className;
                $(ul).insertBefore(ol).append(lis);
                parent.removeChild(ol);
            }
            if (sorted === 'checklist') {
                $(ul).addClass('o_checklist');
            }

            this.dom.deleteEdge(ul, 'next');
            this.dom.deleteEdge(ul, 'prev');

        } else {
            // remove ol/ul

            if (this.utils.isLi(parent) || this.utils.isList(parent)) {
                if (this.utils.isLi(parent)) {
                    ol = parent;
                    parent = ol.parentNode;
                }
                $(lis).insertBefore(ol);
            } else {
                res = [];
                _.each(lis, function (li) {
                    res.push.apply(res, li.childNodes);
                    $(li.childNodes).insertBefore(ol);
                });

                // wrap in p

                var hasNode = _.find(res, function (node) {
                    return node.tagName && node.tagName !== "BR" && (!self.utils.isMedia || !self.utils.isMedia(node));
                });
                if (!hasNode) {
                    var p = this.document.createElement('p');
                    $(p).insertBefore(ol).append(res);
                    res = [p];
                }
            }
            parent.removeChild(ol);

        }

        nodes.push.apply(nodes, res);

        return isWithinElem;
    },
    /**
     * Insert an ordered list, an unordered list or a checklist.
     * If already in list, remove the list or convert it to the given type.
     *
     * @param {string('ol'|'ul'|'checklist')} type the type of list to insert
     * @returns {false|Node[]} contents of the ul/ol or content of the converted/removed list
     */
    insertList: function (type) {
        var self = this;
        var range = this.dependencies.Range.getRange();
        if (!range) {
            return;
        }
        var res;
        var start = range.getStartPoint();
        var end = range.getEndPoint();

        if (this.utils.isInList(range.sc)) {
            res = this.convertList(false, [], start, end, type);
        } else {
            var ul = this._createList(type);
            res = [].slice.call(ul.children);
        }

        var startLeaf = this.utils.firstLeafUntil(start.node, function (n) {
            return (!self.utils.isMedia || !self.utils.isMedia(n)) && self.options.isEditableNode(n);
        });
        var endLeaf = this.utils.firstLeafUntil(end.node, function (n) {
            return (!self.utils.isMedia || !self.utils.isMedia(n)) && self.options.isEditableNode(n);
        });
        range = this.dependencies.Range.setRange({
            sc: startLeaf,
            so: start.offset,
            ec: endLeaf,
            eo: end.offset,
        });
        this.dependencies.Range.save(range);

        return res;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {WrappedRange} range
     * @returns {Boolean} true if the given button should be active
     */
    _active: function (buttonName, range) {
        var listAncestor = this.utils.ancestor(range.sc, this.utils.isList);
        if (!listAncestor) {
            return false;
        }
        var listType = buttonName.split('-')[1];
        if (listType === 'checklist') {
            return listAncestor.className.indexOf('o_checklist') !== -1;
        }
        return listAncestor.tagName === listType.toUpperCase();
    },
    /**
     * Create a list if allowed.
     *
     * @param {string('ol'|'ul'|'checklist')} type the type of list to insert
     * @returns {false|Node} the list, if any
     */
    _createList: function (type) {
        var range = this.dependencies.Range.getRange();
        if (!range.isCollapsed()) {
            range.replace(this.dom.splitTextAtSelection(range));
        }
        var nodes = range.getSelectedNodes();
        var formatNodes = this._filterEditableFormatNodes(nodes);
        if (!formatNodes.length) {
            return;
        }

        var ul = this._createListElement(type);
        $(formatNodes[0][0] || formatNodes[0]).before(ul);
        this._fillListElementWith(ul, formatNodes);
        this._deleteListElementEdges(ul);

        return ul;
    },
    /**
     * Create a list element of the given type and return it.
     *
     * @param {string('ol'|'ul'|'checklist')} type the type of list to insert
     * @returns {Node}
     */
    _createListElement: function (type) {
        var ul = this.document.createElement(type === "ol" ? "ol" : "ul");
        if (type === 'checklist') {
            ul.className = 'o_checklist';
        }
        return ul;
    },
    /**
     * Delete a list element's edges if necessary.
     *
     * @param {Node} ul
     */
    _deleteListElementEdges: function (ul) {
        this.dom.deleteEdge(ul, 'next');
        this.dom.deleteEdge(ul, 'prev');
        this.editable.normalize();
    },
    /**
     * Fill a list element with the nodes passed, wrapped in LIs.
     *
     * @param {Node} ul
     * @param {Node[]} nodes
     */
    _fillListElementWith: function (ul, nodes) {
        var self = this;
        _.each(nodes, function (node) {
            var li = self.document.createElement('li');
            $(li).append(node);
            ul.appendChild(li);
        });
    },
    /**
     * Filter the editable format ancestors of the given nodes
     * and fill or wrap them if needed for range selection.
     *
     * @param {Node[]} nodes
     * @returns {Node[]}
     */
    _filterEditableFormatNodes: function (nodes) {
        var self = this;
        var formatNodes = this.dependencies.FontStyle.filterFormatAncestors(nodes);
        formatNodes = _.compact(_.map(formatNodes, function (node) {
            var ancestor = (!node.tagName || node.tagName === 'BR') && self.utils.ancestor(node, self.utils.isCell);
            if (ancestor && self.options.isEditableNode(ancestor)) {
                if (!ancestor.childNodes.length) {
                    var br = self.document.createElement('br');
                    ancestor.appendChild(br);
                }
                var p = self.document.createElement('p');
                $(p).append(ancestor.childNodes);
                ancestor.appendChild(p);
                return p;
            }
            return self.options.isEditableNode(node) && node || null;
        }));
        return formatNodes;
    },

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    /**
     * @param {SummernoteEvent} se
     * @param {jQueryEvent} e
     */
    _onMouseDown: function (se, e) {
        if (!this.utils.isLi(e.target) || !$(e.target).parent('ul.o_checklist').length || e.offsetX > 0) {
            return;
        }
        e.preventDefault();
        var checked = $(e.target).hasClass('o_checked');
        $(e.target).toggleClass('o_checked', !checked);
        var $sublevel = $(e.target).next('ul.o_checklist, li:has(> ul.o_checklist)').find('> li, ul.o_checklist > li');
        var $parents = $(e.target).parents('ul.o_checklist').map(function () {
            return this.parentNode.tagName === 'LI' ? this.parentNode : this;
        });
        if (checked) {
            $sublevel.removeClass('o_checked');
            $parents.prev('ul.o_checklist li').removeClass('o_checked');
        } else {
            $sublevel.addClass('o_checked');
            var $lis;
            do {
                $lis = $parents.not(':has(li:not(.o_checked))').prev('ul.o_checklist li:not(.o_checked)');
                $lis.addClass('o_checked');
            } while ($lis.length);
        }
    },
});

Manager.addPlugin('List', ListPlugin);

return ListPlugin;

});
