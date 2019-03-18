odoo.define('web_editor.wysiwyg.plugin.unbreakable', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $ = require('web_editor.jquery');
var _ = require('web_editor._');

//--------------------------------------------------------------------------
// unbreakable node preventing editing
//--------------------------------------------------------------------------

/**
 * o_editable
 * o_not_editable
 * o_fake_editable
 * o_fake_not_editable
 *
 * contentEditable
 */

var Unbreakable = AbstractPlugin.extend({
    dependencies: ['Range'],
    editableDomEvents: {
        'keydown': '_onKeydown',
    },

    start: function () {
        this.dependencies.Range.on('range', this, this._onRange.bind(this));
        this.secureArea();
        return this._super();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Change the selection if it breaks an unbreakable node:
     *
     * .. code-block:: xml
     *
        <unbreakable id="a">
            content_1
            <unbreakable id="b">content_2</unbreakable>
            <allow id="c">
                content_3
                <unbreakable id="d">content_4</unbreakable>
                <unbreakable id="e">
                    content_5
                    <allow id="f">content_6</allow>
                    content_7
                </unbreakable>
                content_8
            </allow>
            <unbreakable id="f">content_9</unbreakable>
            <allow id="g">
                content_10
                <unbreakable id="h">content_11</unbreakable>
                content_12
            </allow>
        </unbreakable>

     * .. code-block: none

        START            END            RESIZE START     RESIZE END

        content_1       content_1       content_3       content_3   (find the first allowed node)
        content_1       content_2       content_3       content_3
        content_1       content_3       content_3       -
        content_3       content_3       -               -           (nothing to do)
        content_3       content_8       -               -           (can remove unbreakable node)
        content_3       content_4       -               content_3
        content_3       content_5       -               #d          (can select the entire unbreakable node)
        content_5       content_8       content_6       content_6
        content_5       content_7       #e              #e          (select the entire unbreakable node)
        content_6       content_8       -               content_6
        content_7       content_8       -               content_8
        content_9       content_12      content_10      -
     *
     * @returns {WrappedRange}
     */
    secureRange: function () {
        if (this._selfRerange) {
            return;
        }
        var self = this;
        var range = this.dependencies.Range.getRange();
        var isCollapsed = range.isCollapsed();
        var needReselect = false;
        var startPoint = range.getStartPoint();
        var endPoint = range.getEndPoint();

        // don't change the selection if the carret is just after a media in editable area
        var prev;
        if (
            isCollapsed && startPoint.node.tagName && startPoint.node.childNodes[startPoint.offset] &&
            (prev = startPoint.prev()) && this.dependencies.Range.isVoidBlock(prev.node) &&
            this.options.isEditableNode(prev.node.parentNode)
        ) {
            return range;
        }

        // move the start selection to an allowed node
        var target = startPoint.node.childNodes[startPoint.offset] || startPoint.node;
        if (startPoint.offset && startPoint.offset === this.utils.nodeLength(startPoint.node)) {
            startPoint.node = this.utils.lastLeafUntil(startPoint.node, function (n) {
                return !self.dependencies.Range.isVoidBlock(n) && self.options.isEditableNode(n);
            });
            startPoint.offset = this.utils.nodeLength(startPoint.node);
        }
        if (!this.dependencies.Range.isVoidBlock(target) || !this.options.isEditableNode(target)) {
            var afterEnd = false;
            startPoint = startPoint.nextUntil(function (point) {
                if (point.node === endPoint.node && point.offset === endPoint.offset) {
                    afterEnd = true;
                }
                return self.options.isEditableNode(point.node) && point.isVisible() || !point.node;
            });
            if (!startPoint || !startPoint.node) { // no allowed node, search the other way
                afterEnd = false;
                startPoint = range.getStartPoint().prevUntil(function (point) {
                    return self.options.isEditableNode(point.node) && point.isVisible() || !point.node;
                });
            }
            if (startPoint && !startPoint.node) {
                startPoint = null;
            }
            if (afterEnd) {
                isCollapsed = true;
            }
        }

        if (startPoint && (startPoint.node !== range.sc || startPoint.offset !== range.so)) {
            needReselect = true;
            range.sc = startPoint.node;
            range.so = startPoint.offset;
            if (isCollapsed) {
                range.ec = range.sc;
                range.eo = range.so;
            }
        }

        if (startPoint && !isCollapsed) { // mouse selection or key selection with shiftKey
            var point = endPoint;
            endPoint = false;

            // if the start point was moved after the end point
            var toCollapse = !point.prevUntil(function (pt) {
                return pt.node === range.sc && pt.offset === range.so;
            });

            if (!toCollapse) {
                // find the first allowed ancestor
                var commonUnbreakableParent = this.utils.ancestor(range.sc, function (node) {
                    return !self.dependencies.Range.isVoidBlock(node) && self.options.isUnbreakableNode(node);
                });
                if (!commonUnbreakableParent) {
                    commonUnbreakableParent = this.editable;
                }

                var lastCheckedNode;
                if (point.offset === this.utils.nodeLength(point.node)) {
                    point = point.next();
                }

                // move the end selection to an allowed node in the first allowed ancestor
                endPoint = point.prevUntil(function (pt) {
                    if (pt.node === range.sc && pt.offset === range.so) {
                        return true;
                    }
                    if (lastCheckedNode === pt.node) {
                        return false;
                    }

                    // select the entirety of the unbreakable node
                    if (
                        pt.node.tagName && pt.offset &&
                        $.contains(commonUnbreakableParent, pt.node) &&
                        self.options.isUnbreakableNode(pt.node)
                    ) {
                        return true;
                    }

                    var unbreakableParent = this.utils.ancestor(pt.node, function (node) {
                        return !self.dependencies.Range.isVoidBlock(node) && self.options.isUnbreakableNode(node);
                    });
                    if (!unbreakableParent) {
                        unbreakableParent = self.editable;
                    }

                    if (commonUnbreakableParent !== unbreakableParent) {
                        lastCheckedNode = pt.node;
                        return false;
                    }
                    lastCheckedNode = pt.node;
                    if (!self.options.isEditableNode(pt.node)) {
                        return false;
                    }
                    if (
                        (/\S|\uFEFF|\u00A0/.test(pt.node.textContent) ||
                            this.dependencies.Range.isVoidBlock(pt.node)) &&
                        pt.isVisible()
                    ) {
                        return true;
                    }
                    if (this.utils.isText(pt.node)) {
                        lastCheckedNode = pt.node;
                    }
                    return false;
                });
            }

            if (!endPoint) {
                endPoint = range.getStartPoint();
            }

            if (endPoint.node !== range.ec || endPoint.offset !== range.eo) {
                needReselect = true;
                range.ec = endPoint.node;
                range.eo = endPoint.offset;
            }
        }

        if (needReselect) {
            this._selfRerange = true;
            range = this.dependencies.Range.setRange(range.getPoints());
            this._selfRerange = false;
            this.dependencies.Range.save(range);
        }
        return range;
    },
    /**
     * Apply contentEditable false on all media.
     *
     * @param {DOM} [node] default is editable area
     */
    secureArea: function (node) {
        var self = this;
        this.editable.querySelectorAll('.o_not_editable').forEach(function (node) {
            node.contentEditable = false;
        });

        var medias = (function findMedia(node) {
            var medias = [];
            if (node.tagName !== 'IMG' && self.dependencies.Range.isVoidBlock(node)) {
                medias.push(node);
            } else {
                [].forEach.call(node.childNodes, function (node) {
                    if (node.tagName) {
                        medias.push.apply(medias, findMedia(node));
                    }
                });
            }
            return medias;
        })(node || this.editable);

        medias.forEach(function (media) {
            media.classList.add('o_fake_not_editable');
            media.contentEditable = false;

            if (self.utils.isVideo(media) && !media.querySelector('.o_fake_editable')) {
                // allow char insertion
                var div = document.createElement('div');
                div.className = 'o_fake_editable o_wysiwyg_to_remove';
                div.style.position = 'absolute';
                div.contentEditable = true;
                media.insertBefore(div, media.firstChild);
                media.appendChild(div.cloneNode());
            }
        });
    },
    setValue: function () {
        this.secureArea();
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    /**
     * Method called on keydown event: prevents changes to unbreakable nodes.
     *
     * @param {jQueryEvent} e
     */
    _onKeydown: function (e) {
        if (!e.key || (e.key.length !== 1 && e.keyCode !== 8 && e.keyCode !== 46)) {
            return;
        }
        var range;
        var focusNode = this.dependencies.Range.getFocusedNode();
        // for test tour, to trigger Keydown on target (instead of use Wysiwyg.setRange)
        if (
            e.target !== focusNode &&
            (this.editable === e.target || $.contains(this.editable, e.target))
        ) {
            range = this.dependencies.Range.getRange();
            if (!$.contains(e.target, range.sc) && !$.contains(e.target, range.ec)) {
                this._selfRerange = true;
                range = this.dependencies.Range.setRange({
                    sc: e.target,
                    so: 0,
                }).normalize();
                this._selfRerange = false;
                this.dependencies.Range.save(range);
            }
        }

        // rerange to prevent some edition.
        // eg: if the user select with arraw and shifKey and keypress an other char
        range = this.secureRange();
        var target = range.getStartPoint();

        if (e.keyCode === 8) { // backspace
            if (!target || this.options.isUnbreakableNode(target.node)) {
                e.preventDefault();
            }
        } else if (e.keyCode === 46) { // delete
            target = target.next().nextUntil(function (pt) {
                return pt.isVisible();
            });
            if (!target || this.options.isUnbreakableNode(target.node)) {
                e.preventDefault();
            }
        }
    },
    /**
     * Method called on range event: secures the range, refocuses.
     */
    _onRange: function (e) {
        e.stopImmediatePropagation();
        this.secureRange();
    },
});

Manager.addPlugin('Unbreakable', Unbreakable);

return Unbreakable;

});
