odoo.define('web_editor.wysiwyg.plugin.dropblock_selector', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $ = require('web_editor.jquery');
var _ = require('web_editor._');


var DropBlockSelector = AbstractPlugin.extend({
    dependencies: ['DropBlock'],


    _insertDropZoneSibling: function (sibling) {
        var $zone = $(this);
        var css = this.window.getComputedStyle(sibling);
        var parentCss = this.window.getComputedStyle(sibling.parentNode);
        var float = css.float || css.cssFloat;
        var parentDisplay = parentCss.display;
        var parentFlex = parentCss.flexDirection;

        function isFullWidth (child) {
            return child.parent.clientWidth === child.clientWidth;
        }
        if (sibling.previousElementSibling && sibling.previousElementSibling.classList.contains('oe_drop_zone')) {
            var insert = function (node) {
                sibling.parentNode.insertBefore(node, nodesibling);
            };
            if (float === 'left' || float === 'right' || (parentDisplay === 'flex' && parentFlex === 'row')) {
                dropzone = isFullWidth(parent) ? self._insertDropZoneHorizontal(sibling, insert) : self._insertDropZoneVertical(sibling, insert);
                dropzone.style.float = float;
            }
        }

        if (sibling.nextElementSibling && sibling.nextElementSibling.classList.contains('oe_drop_zone')) {
            var insert = function (node) {
                if (nodesibling.nextSibling) {
                    sibling.parentNode.insertBefore(node, nodesibling.nextSibling);
                } else {
                    sibling.parentNode.appendChild(node);
                }
            };
            if (float === 'left' || float === 'right' || (parentDisplay === 'flex' && parentFlex === 'row')) {
                dropzone = isFullWidth(parent) ? self._insertDropZoneHorizontal(sibling, insert) : self._insertDropZoneVertical(sibling, insert);
                dropzone.style.float = float;
            }
        }
    },
    _insertDropZoneSiblings: function (siblings) {
        var self = this;
        var dropzones = [];
        [].slice.call(siblings || []).forEach(function (sibling) {
            dropzones = dropzones.concat(self._insertDropZoneSibling(sibling));
        });
        return dropzones;
    },
    _insertDropZoneChild: function (parent) {
        var self = this;
        var css = this.window.getComputedStyle(parent);
        var parentCss = this.window.getComputedStyle(parent.parentNode);
        var float = css.float || css.cssFloat;
        var parentDisplay = parentCss.display;
        var parentFlex = parentCss.flexDirection;
        var dropzones = [];

        function isFullWidth (child) {
            return child.parent.clientWidth === child.clientWidth;
        }
        function _insertDropZoneChildOrientation (parent, child, insert) {
            var dropzone;
            var test = !!(child && ((!child.tagName && child.textContent.match(/\S/)) || child.tagName === 'BR'));
            if (test) {
                dropzone = self._insertDropZoneVertical(child, insert);
            } else if (float === 'left' || float === 'right' || (parentDisplay === 'flex' && parentFlex === 'row')) {
                dropzone = isFullWidth(parent) ? self._insertDropZoneHorizontal(child, insert) : self._insertDropZoneVertical(child, insert);
                dropzone.style.float = float;
            }
        }

        _insertDropZoneChildOrientation(parent, parent.lastChild, function (child) {
            dropzones.push(child);
            parent.appendChild(child);
        });
        _insertDropZoneChildOrientation(parent, parent.firstChild, function (child, test) {
            dropzones.push(child);
            self.utils.prependChild(parent, child);
        });

        return dropzones;
    },
    _insertDropZoneChildren: function (parents) {
        var self = this;
        var dropzones = [];
        var siblings = [];
        [].slice.call(parents || []).forEach(function (parent) {
            siblings = siblings.concat([].slice(parent.childNodes, 1, -1));
            dropzones = dropzones.concat(self._insertDropZoneChild(parent));
        });
        return {
            dropzones: dropzones,
            siblings: siblings,
        };
    },
    _insertDropZone: function (dropzone, nodeReference) {
        nodeReference.parentNode.insertBefore(dropzone, nodeReference);
        dropzone = this.utils.clone(dropzone);
        if (nodeReference.nextSibling) {
            nodeReference.parentNode.insertBefore(dropzone, nodeReference.nextSibling);
        } else {
            nodeReference.parentNode.appendChild(dropzone);
        }
    },
    _insertDropZoneHorizontal: function (child, insert) {
        insert(document.createElement('dropblock-dropzone'));
    },
    _insertDropZoneVertical: function (child, insert) {
        var dropzone = document.createElement('dropblock-dropzone');
        dropzone.setAttribute('orientation', 'vertical');
        dropzone.style.float = 'node';
        dropzone.style.display = 'inline-block';

        insert(dropzone);

        var test = !!(child && ((!child.tagName && child.textContent.match(/\S/)) || child.tagName === 'BR'));
        if (test) {
            dropzone.style.height = parseInt(self.window.getComputedStyle(child).lineHeight) + 'px';
        } else {
            dropzone.style.height =  Math.max(Math.min(parent.clientHeight, child && child.clientHeight), 30) + 'px';
            /// + add max with the next and previous
        }
    },

    
});

Manager.addPlugin('DropBlockSelector', DropBlockSelector);

});
