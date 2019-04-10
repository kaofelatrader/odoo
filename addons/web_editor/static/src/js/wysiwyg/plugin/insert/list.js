odoo.define('web_editor.wysiwyg.plugin.list', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var wysiwygOptions = require('wysiwyg.options');
var Manager = require('web_editor.wysiwyg.plugin.manager');

wysiwygOptions.keyMap.pc['CTRL+SHIFT+NUM9'] = 'List.insertList:checklist';
wysiwygOptions.keyMap.mac['CMD+SHIFT+NUM9'] = 'List.insertList:checklist';


var ListPlugin = AbstractPlugin.extend({
    dependencies: ['FontStyle'],

    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_list.xml'],

    buttons: {
        template: 'wysiwyg.buttons.list',
        active: '_active',
    },

    editableDomEvents: {
        'mousedown': '_onMouseDown',
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
     * @returns {Node []}
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
            var ulBefore = document.createElement(ol.tagName);
            ulBefore.className = ol.className;

            if (this.utils.isLi(ol.parentNode)) {
                var li = document.createElement('li');
                li.className = ol.parentNode.className;
                $(li).insertBefore(ol.parentNode);
                li.appendChild(ulBefore);
            } else {
                $(ulBefore).insertBefore(ol);
            }

            $(ulBefore).append(lisBefore);
        }
        if (lisAfter.length) {
            var ulAfter = document.createElement(ol.tagName);
            ulAfter.className = ol.className;

            if (this.utils.isLi(ol.parentNode)) {
                var li = document.createElement('li');
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
                ul = document.createElement(sorted === "ol" ? "ol" : "ul");
                ul.className = ol.className;
                $(ul).insertBefore(ol).append(lis);
                parent.removeChild(ol);
            }
            if (sorted === 'checklist') {
                $(ul).addClass('o_checklist');
            }

            var options = {
                isTryNonSim: false,
            };
            this.dom.deleteEdge(ul, false, options);
            this.dom.deleteEdge(ul, true, options);

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
                    return node.tagName && node.tagName !== "BR" && !self.dependencies.Arch.isVoidBlock(node);
                });
                if (!hasNode) {
                    var p = document.createElement('p');
                    $(p).insertBefore(ol).append(res);
                    res = [p];
                }
            }
            parent.removeChild(ol);

        }

        nodes.push.apply(nodes, res);

        return nodes;
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
        var range = this.dependencies.Arch.getRange();
        if (!range) {
            return false;
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
            return !self.dependencies.Arch.isVoidBlock(n) && self.dependencies.Arch.isEditableNode(n);
        });
        var endLeaf = this.utils.firstLeafUntil(end.node, function (n) {
            return !self.dependencies.Arch.isVoidBlock(n) && self.dependencies.Arch.isEditableNode(n);
        });
        range = this.dependencies.Arch.setRange({
            sc: startLeaf,
            so: this.utils.isText(startLeaf) ? start.offset : 0,
            ec: endLeaf,
            eo: this.utils.isText(endLeaf) ? end.offset : this.utils.nodeLength(endLeaf),
        });
        this.dependencies.Arch.setRange(range);

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
        var self = this;
        var range = this.dependencies.Arch.getRange();
        if (!range.isCollapsed()) {
            range.replace(this.dom.splitTextAtSelection(range));
        }
        var nodes = range.getSelectedNodes(function (node) {
            return self.utils.isVisibleText(node) || self.dependencies.Arch.isVoidBlock(node);
        });
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
        var ul = document.createElement(type === "ol" ? "ol" : "ul");
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
        var options = {
            isTryNonSim: false,
        };
        this.dom.deleteEdge(ul, false, options);
        this.dom.deleteEdge(ul, true, options);
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
            var li = document.createElement('li');
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
            if (ancestor && self.dependencies.Arch.isEditableNode(ancestor)) {
                if (!ancestor.childNodes.length) {
                    var br = document.createElement('br');
                    ancestor.appendChild(br);
                }
                var p = document.createElement('p');
                $(p).append(ancestor.childNodes);
                ancestor.appendChild(p);
                return p;
            }
            return self.dependencies.Arch.isEditableNode(node) && node || null;
        }));
        return formatNodes;
    },

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    /**
     * @param {jQueryEvent} e
     */
    _onMouseDown: function (e) {
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
