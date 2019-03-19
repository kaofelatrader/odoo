odoo.define('web_editor.wysiwyg.plugin.link', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var LinkDialog = require('wysiwyg.widgets.LinkDialog');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $ = require('web_editor.jquery');
var _ = require('web_editor._');

//--------------------------------------------------------------------------
// link
//--------------------------------------------------------------------------

var LinkCreate = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_link.xml'],
    dependencies: ['Range'],

    buttons: {
        template: 'wysiwyg.buttons.link',
    },

    blankContent: "Label",

    showLinkDialog: function (value, range) {
        var self = this;
        return new Promise(function (resolve) {
            range = self._prepareRange(range);
            self.dependencies.Range.save(range);
            var linkDialog = new LinkDialog(self.options.parent, {
                onClose: self._onCloseDialog.bind(self),
            }, self._getLinkInfo(range));
            linkDialog.on('save', self, function (linkInfo) {
                self._onSaveDialog(linkInfo);
                resolve();
            });
            linkDialog.on('closed', self, function () {
                resolve({noChange: true});
            });
            linkDialog.open();
        });
    },

    _applyToAnchor: function (anchor, url, className) {
        anchor.setAttribute('href', url);
        anchor.className = className;
    },
    _getAnchorAncestor: function (node) {
        return this.utils.ancestor(node, this.utils.isAnchor);
    },
    _getLinkInfo: function (range) {
        var nodes = this._getNodesToLinkify(range);
        var anchorAncestor = this._getAnchorAncestor(range.commonAncestor());

        var linkInfo = {
            isAnchor: !!anchorAncestor,
            text: this._getTextToLinkify(nodes),
            url: anchorAncestor ? anchorAncestor.getAttribute('href') : ''
        };

        return linkInfo;
    },
    _getNodesToLinkify: function (range) {
        var anchorAncestor = this._getAnchorAncestor(range.commonAncestor());
        if (anchorAncestor) {
            return anchorAncestor.childNodes;
        }
        var nodes = [];
        range.getStartPoint().walkTo(range.getEndPoint(), function (point) {
            var node = point.node.childNodes && point.node.childNodes[point.offset] || point.node;
            if (nodes.indexOf(node) === -1 && nodes.indexOf(node.parentNode) === -1) {
                nodes.push(node);
            }
        });

        return nodes;
    },
    _getSplitText: function (range) {
        if (!this.utils.isText(range.sc)) {
            range.sc = (range.so ? range.sc.childNodes[range.so] : range.sc).firstChild || range.sc;
            range.so = 0;
        } else if (range.so !== range.sc.textContent.length) {
            if (range.sc === range.ec) {
                range.ec = range.sc = range.sc.splitText(range.so);
                range.eo -= range.so;
            } else {
                range.sc = range.sc.splitText(range.so);
            }
            range.so = 0;
        }

        if (!this.utils.isText(range.ec)) {
            range.ec = (range.eo ? range.ec.childNodes[range.eo - 1] : range.ec).lastChild || range.ec;
            range.eo = range.ec.textContent.length;
        } else if (range.eo !== range.ec.textContent.length) {
            range.ec.splitText(range.eo);
        }
        return range;
    },
    _getTextToLinkify: function (nodes) {
        if (nodes.length <= 0) {
            return;
        }

        var anchorAncestor = this._getAnchorAncestor(nodes[0]);
        var text = "";
        for (var i = 0; i < nodes.length; i++) {
            if (this.utils.ancestor(nodes[i], this.utils.isImg)) {
                text += this.utils.ancestor(nodes[i], this.utils.isImg).outerHTML;
            } else if (this.utils.ancestor(nodes[i], this.utils.isIcon)) {
                text += this.utils.ancestor(nodes[i], this.utils.isIcon).outerHTML;
            } else if (!anchorAncestor && nodes[i].nodeType === 1) {
                // just use text nodes from listBetween
            } else if (!anchorAncestor && i === 0) {
                text += nodes[i].textContent;
            } else if (!anchorAncestor && i === nodes.length - 1) {
                text += nodes[i].textContent;
            } else {
                text += nodes[i].textContent;
            }
        }
        return text.replace(this.utils.getRegex('space', 'g'), ' ');
    },
    _insertBlankLink: function () {
        var range = this.dependencies.Range.getRange();
        if (range.isCollapsed()) {
            if (!this.dependencies.Common.isVoidBlock(range.sc)) {
                range.replace({
                    sc: this.utils.firstLeaf(range.sc),
                    so: 0,
                });
            }
            if (this.utils.isText(range.sc)) {
                range.replace({
                    sc: range.sc.splitText(range.so),
                    so: 0,
                });
                range.sc.textContent = this.blankContent;
            } else if (this.utils.isBR(range.sc)) {
                var emptyText = this.document.createTextNode(this.blankContent);
                this.dom._insertAfter(emptyText, range.sc);
                range.sc.parentNode.removeChild(range.sc);
                range.replace({
                    sc: emptyText,
                    so: 0,
                });
            }
        }
        var anchor = document.createElement('a');
        range.sc.parentNode.insertBefore(anchor, range.sc);
        anchor.appendChild(range.sc);

        this.dependencies.Range.save({
            sc: anchor.firstChild,
            so: 0,
            ec: anchor.lastChild,
            eo: this.utils.nodeLength(anchor.lastChild),
        });
        return anchor;
    },
    _insertLink: function (linkInfo) {
        var anchor;
        if (linkInfo.isAnchor) {
            anchor = this._replaceLink(linkInfo.style, linkInfo.isNewWindow);
        } else {
            anchor = this._insertBlankLink();
        }
        anchor = this._applyToAnchor(anchor, linkInfo.url, linkInfo.className);
        this.trigger_up('focusnode', anchor);
    },
    _prepareRange: function (range) {
        if (this.utils.isImg(range.sc) || this.utils.isIcon && this.utils.isIcon(range.sc)) {
            return range;
        }

        range = this._getSplitText(range);

        // browsers can't target a picture or void node
        if (this.utils.isVoid(range.sc) || this.utils.isImg(range.sc)) {
            range.so = this.utils.listPrev(range.sc).length - 1;
            range.sc = range.sc.parentNode;
        }
        if (this.utils.isBR(range.ec)) {
            range.eo = this.utils.listPrev(range.ec).length - 1;
            range.ec = range.ec.parentNode;
        } else if (this.utils.isVoid(range.ec) || this.utils.isImg(range.sc)) {
            range.eo = this.utils.listPrev(range.ec).length;
            range.ec = range.ec.parentNode;
        }
        return range;
    },
    _replaceLink: function (style, isNewWindow) {
        var range = this.dependencies.Range.getRange();
        var anchor = this.utils.ancestor(range.sc, this.utils.isAnchor);
        if (style) {
            Object.keys(style).forEach (function (key) {
                anchor.style[key] = style[key];
            });
        }
        if (isNewWindow) {
            anchor.setAttribute('target', '_blank');
        } else {
            anchor.removeAttribute('target');
        }
        return anchor;
    },

    _onCloseDialog: function (ev) {
        this.editable.focus();
    },
    /**
     * @param {Object} linkInfo
     * @param {String} linkInfo.url
     * @param {String} linkInfo.className
     * @param {Object} linkInfo.style
     * @param {Boolean} linkInfo.replaceLink
     * @param {Boolean} linkInfo.isNewWindow
     */
    _onSaveDialog: function (linkInfo) {
        this._insertLink(linkInfo);
    },
});

var Link = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_link.xml'],
    dependencies: ['Range', 'LinkCreate'],

    buttons: {
        template: 'wysiwyg.popover.link',
        events: {
            'dblclick': '_onDblclick',
        },
    },

    get: function () {
        var range = this.dependencies.Range.getRange();
        var anchor = this.utils.ancestor(range.sc, this.utils.isAnchor);
        return anchor && range.replace({sc: anchor, so: 0});
    },

    /**
     * @param {Object} linkInfo
     * @param {WrappedRange} range
     * @returns {Promise}
     */
    showLinkDialog: function (value, range) {
        return this.dependencies.LinkCreate.showLinkDialog(value, range);
    },
    /**
     * Remove the current link, keep its contents.
     */
    unlink: function (value, anchor) {
        var startAndEndInvisible = this.utils.getRegex('startAndEndInvisible', 'g');
        anchor.innerHTML = anchor.innerHTML.replace(startAndEndInvisible, '');

        var contents = [].slice.call(anchor.childNodes);
        contents.forEach(function (node) {
            anchor.parentNode.insertBefore(node, anchor);
        });
        anchor.parentNode.removeChild(anchor);

        var start = contents[0];
        var end = contents[contents.length - 1];
        var range = this.dependencies.Range.setRange({
            sc: start,
            so: 0,
            ec: end,
            eo: this.utils.nodeLength(end),
        });
        this.dependencies.Range.save(range);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {jQueryEvent} e
     */
    _onDblclick: function (e) {
        return this.showLinkDialog(null, this.dependencies.Range.getRange());
    },
});

Manager.addPlugin('Link', Link)
    .addPlugin('LinkCreate', LinkCreate);

return {
    LinkCreate: LinkCreate,
    Link: Link,
};

});