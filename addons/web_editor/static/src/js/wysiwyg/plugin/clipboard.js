odoo.define('web_editor.wysiwyg.plugin.clipboard', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');


var ClipboardPlugin = AbstractPlugin.extend({
    dependencies: ['Range'],
    editableDomEvents: {
        'paste': '_onPaste',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Paste nodes or their text content into the editor.
     *
     * @param {Node[]} nodes
     * @param {Boolean} textOnly true to allow only dropping plain text
     */
    pasteNodes: function (nodes, textOnly) {
        if (!nodes.length) {
            return;
        }
        nodes = textOnly ? this.document.createTextNode($(nodes).text()) : nodes;
        nodes = this._mergeAdjacentULs(nodes);

        var point = this._getPastePoint();
        // Prevent pasting HTML within a link:
        point = textOnly ? point : point.nextUntil(this._isPointInAnchor.bind(this));

        this._insertNodesAt(nodes, point);

        var start = nodes[nodes.length - 1];
        this.dependencies.Range.setRange({
            sc: start,
            so: this.utils.nodeLength(start),
        }).normalize();
    },
    /**
     * Prepare clipboard data for safe pasting into the editor.
     *
     * @see clipboardWhitelist
     * @see clipboardBlacklist
     *
     * @param {DOMString} clipboardData
     * @returns {Node[]}
     */
    prepareClipboardData: function (clipboardData) {
        var $clipboardData = this._removeIllegalClipboardElements($(clipboardData));

        var $all = $clipboardData.find('*').addBack();
        $all.filter('table').addClass('table table-bordered');
        this._wrapTDContents($all.filter('td'));
        this._fillEmptyBlocks($all);
        this._removeIllegalClipboardAttributes($all);
        $all.filter('a').removeClass();
        $all.filter('img').css('max-width', '100%');

        return $clipboardData.toArray();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Remove the non-whitelisted or blacklisted
     * top level elements from clipboard data.
     *
     * @see clipboardWhitelist
     * @see clipboardBlacklist
     *
     * @private
     * @param {JQuery} $clipboardData
     * @returns {Object} {$clipboardData: JQuery, didRemoveNodes: Boolean}
     */
    _cleanClipboardRoot: function ($clipboardData) {
        var self = this;
        var didRemoveNodes = false;
        var whiteList = this._clipboardWhitelist();
        var blackList = this._clipboardBlacklist();
        var $fakeParent = $(this.document.createElement('div'));
        _.each($clipboardData, function (node) {
            var isWhitelisted = self.utils.isText(node) || $(node).filter(whiteList.join(',')).length;
            var isBlacklisted = $(node).filter(blackList.join(',')).length;
            if (!isWhitelisted || isBlacklisted) {
                $fakeParent.append(node.childNodes);
                didRemoveNodes = true;
            } else {
                $fakeParent.append(node);
            }
        });
        return {
            $clipboardData: $fakeParent.contents(),
            didRemoveNodes: didRemoveNodes,
        };
    },
    /**
     * Return a list of jQuery selectors for prohibited nodes on paste.
     *
     * @private
     * @returns {String[]}
     */
    _clipboardBlacklist: function () {
        return ['.Apple-interchange-newline'];
    },
    /**
     * Return a list of jQuery selectors for exclusively authorized nodes on paste.
     *
     * @private
     * @returns {String[]}
     */
    _clipboardWhitelist: function () {
        var listSels = ['ul', 'ol', 'li'];
        var styleSels = ['i', 'b', 'u', 'em', 'strong'];
        var tableSels = ['table', 'th', 'tbody', 'tr', 'td'];
        var miscSels = ['img', 'br', 'a', '.fa'];
        return this.options.styleTags.concat(listSels, styleSels, tableSels, miscSels);
    },
    /**
     * Return a list of attribute names that are exclusively authorized on paste.
     * 
     * @private
     * @returns {String[]}
     */
    _clipboardWhitelistAttr: function () {
        return ['class', 'href', 'src'];
    },
    /**
     * Fill up empty block elements with BR elements so the carret can enter them.
     *
     * @private
     * @param {JQuery} $els
     */
    _fillEmptyBlocks: function ($els) {
        var self = this;
        $els.filter(function (i, n) {
            return self.utils.isNodeBlockType(n) && !n.childNodes;
        }).append(this.document.createElement('br'));
    },
    /**
     * Get all non-whitelisted or blacklisted elements from clipboard data.
     *
     * @private
     * @param {JQuery} $clipboardData
     * @returns {JQuery}
     */
    _filterIllegalClipboardElements: function ($clipboardData) {
        var self = this;
        return $clipboardData.find('*').addBack()
                .not(this._clipboardWhitelist().join(','))
                .addBack(this._clipboardBlacklist().join(','))
                .filter(function () {
                    return !self.utils.isText(this);
                });
    },
    /**
     * Get a legal point to paste at, from the current range's start point.
     *
     * @private
     * @returns {BoundaryPoint}
     */
    _getPastePoint: function () {
        var point = this.dependencies.Range.getRange().getStartPoint();
        var offsetChild = point.node.childNodes[point.offset];
        point = offsetChild ? this.getPoint(offsetChild, 0) : point;
        return point.nextUntil(this._isPastePointLegal.bind(this));
    },
    /**
     * Insert nodes at a point. Insert them inline if the first node is inline
     * and pasting inline is legal at that point.
     *
     * @private
     * @param {Node[]} nodes
     * @param {BoundaryPoint} point
     */
    _insertNodesAt: function (nodes, point) {
        var canInsertInline = this.utils.isText(point.node) || point.node.tagName === 'BR' || this.utils.isMedia(point.node);
        var $fakeParent = $(this.document.createElement('div'));
        $fakeParent.append(nodes);
        if (this.utils.isInline(nodes[0]) && canInsertInline) {
            point.node = point.node.tagName ? point.node : point.node.splitText(point.offset);
            $(point.node).before($fakeParent.contents());
        } else {
            this.dom.insertBlockNode($fakeParent[0], this.dependencies.Range.getRange());
        }
        $fakeParent.contents().unwrap();
    },
    /**
     * Return true if it's legal to paste nodes at the given point:
     * if the point is not within a void node and the point is not unbreakable.
     *
     * @private
     * @param {BoundaryPoint} point
     * @returns {Boolean}
     */
    _isPastePointLegal: function (point) {
        var node = point.node;
        var isWithinVoid = false;
        if (node.parentNode) {
            isWithinVoid = this.utils.isVoid(node.parentNode) || $(node.parentNode).filter('.fa').length;
        }
        return !isWithinVoid && !this.options.isUnbreakableNode(point.node);
    },
    /**
     * @private
     * @param {BoundaryPoint} point
     * @returns {Boolean}
     */
    _isPointInAnchor: function (point) {
        var ancestor = this.utils.ancestor(point.node, this.utils.isAnchor);
        return !ancestor || ancestor === this.editable;
    },
    /**
     * Check a list of nodes and merges all adjacent ULs together:
     * [ul, ul, p, ul, ul] will return [ul, p, ul], with the li's of
     * nodes[1] and nodes[4] appended to nodes[0] and nodes[3].
     *
     * @private
     * @param {Node[]} nodes
     * @return {Node[]} the remaining, merged nodes
     */
    _mergeAdjacentULs: function (nodes) {
        var res = [];
        var prevNode;
        _.each(nodes, function (node) {
            prevNode = res[res.length - 1];
            if (prevNode && node.tagName === 'UL' && prevNode.tagName === 'UL') {
                $(prevNode).append(node.childNodes);
            } else {
                res.push(node);
            }
        });
        return res;
    },
    /**
     * Remove non-whitelisted attributes from clipboard.
     *
     * @private
     * @param {JQuery} $els
     */
    _removeIllegalClipboardAttributes: function ($els) {
        var self = this;
        $els.each(function () {
            var $node = $(this);
            _.each(_.pluck(this.attributes, 'name'), function (attribute) {
                if (self._clipboardWhitelistAttr().indexOf(attribute) === -1) {
                    $node.removeAttr(attribute);
                }
            });
        }).removeClass('o_editable o_not_editable');
    },
    /**
     * Remove non-whitelisted and blacklisted elements from clipboard data.
     *
     * @private
     * @param {JQuery} $clipboardData
     * @returns {JQuery}
     */
    _removeIllegalClipboardElements: function ($clipboardData) {
        var root = true;
        $clipboardData = $clipboardData.not('meta').not('style').not('script');
        var $badNodes = this._filterIllegalClipboardElements($clipboardData);

        do {
            if (root) {
                root = false;
                var cleanData = this._cleanClipboardRoot($clipboardData);
                $clipboardData = cleanData.$clipboardData;
                root = cleanData.didRemoveNodes;
            } else {
                this._removeNodesPreserveContents($badNodes);
            }

            $badNodes = this._filterIllegalClipboardElements($clipboardData);
        } while ($badNodes.length);
        return $clipboardData;
    },
    /**
     * Remove nodes from the DOM while preserving their contents if any.
     *
     * @private
     * @param {JQuery} $nodes
     */
    _removeNodesPreserveContents: function ($nodes) {
        var $contents = $nodes.contents();
        if ($contents.length) {
            $contents.unwrap();
        } else {
            $nodes.remove();
        }
    },
    /**
     * Prevent inline nodes directly in TDs by wrapping them in P elements.
     *
     * @private
     * @param {JQuery} $tds
     */
    _wrapTDContents: function ($tds) {
        var self = this;
        var $inlinesInTD = $tds.contents().filter(function () {
            return !self.utils.isNodeBlockType(this);
        });
        var parentsOfInlinesInTD = [];
        _.each($inlinesInTD, function (n) {
            parentsOfInlinesInTD.push(self.utils.firstBlockAncestor(n));
        });
        $($.unique(parentsOfInlinesInTD)).wrapInner(this.document.createElement('p'));
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handle paste events to permit cleaning/sorting of the data before pasting.
     *
     * @private
     * @param {SummernoteEvent} se
     * @param {jQueryEvent} e
     */
    _onPaste: function (se, e) {
        se.preventDefault();
        se.stopImmediatePropagation();
        e.preventDefault();
        e.stopImmediatePropagation();

        this.context.invoke('editor.beforeCommand');

        // Clean up
        var clipboardData = e.originalEvent.clipboardData.getData('text/html');
        if (clipboardData) {
            clipboardData = this.prepareClipboardData(clipboardData);
        } else {
            clipboardData = e.originalEvent.clipboardData.getData('text/plain');
            // get that text as an array of text nodes separated by <br> where needed
            var allNewlines = /\n/g;
            clipboardData = $('<p>' + clipboardData.replace(allNewlines, '<br>') + '</p>').contents().toArray();
        }

        // Delete selection
        var point = this.dom.deleteSelection(this.dependencies.Range.getRange());
        var range = this.dependencies.Range.setRange({
            sc: point.node,
            so: point.offset,
        });
        this.editable.normalize();
        this.dependencies.Range.save(range);

        // Insert the nodes
        this.pasteNodes(clipboardData);
        range = this.dependencies.Range.getRange().normalize();
        this.dependencies.Range.save(range);

        this.context.invoke('editor.afterCommand');
    },
});

Manager.addPlugin('ClipboardPlugin', ClipboardPlugin);

return Clipboard;

});
