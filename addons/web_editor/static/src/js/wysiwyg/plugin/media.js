odoo.define('web_editor.wysiwyg.plugin.media', function (require) {
'use strict';

var core = require('web.core');
var weWidgets = require('wysiwyg.widgets');
var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var _t = core._t;

//--------------------------------------------------------------------------
// Size button
//--------------------------------------------------------------------------

var Float = AbstractPlugin.extend({
    buttons: {
        template: 'wysiwyg.buttons.align',
        active: '_active',
    },
    update: function (float, range) {
        var target = range.sc;
        $(target).css('float', '').removeClass('mx-auto pull-right pull-left');
        if (float === 'center') {
            $(target).addClass('mx-auto');
        } else if (float !== 'none') {
            $(target).addClass('pull-' + float);
        }
        $(target).trigger('change');
    },
    _active:  function (buttonName, focusNode) {
        switch (buttonName) {
            case 'align-left': return $(focusNode).hasClass('pull-left');
            case 'align-center': return $(focusNode).hasClass('mx-auto');
            case 'align-right': return $(focusNode).hasClass('pull-right');
            case 'align-none':  return !($(focusNode).hasClass('pull-left') || $(focusNode).hasClass('mx-auto') || $(focusNode).hasClass('pull-right'));
        }
    },
});

Manager.addPlugin('Float', Float);

//--------------------------------------------------------------------------
// Size button
//--------------------------------------------------------------------------

var MediaSize = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_media.xml'],
    buttons: {
        template: 'wysiwyg.buttons.size',
        active: '_active',
    },
    update: function (size, range) {
        var target = range.sc;
        $(target).css('width', size === 'auto' ? '' : size).trigger('change');
    },

    _active: function (buttonName, focusNode) {
        var size = buttonName.split('-')[1];
        if (size === 'auto') {
            size = '';
        }
        return focusNode.style.width.replace('%', '') ===  size;
    },
});

Manager.addPlugin('MediaSize', MediaSize);

//--------------------------------------------------------------------------
// Padding button
//--------------------------------------------------------------------------

var Padding = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_media.xml'],
    buttons: {
        template: 'wysiwyg.buttons.padding',
        active: '_active',
    },

    update: function (value, range) {
        var target = range.sc;
        target.className = target.className.replace(/(\s+)?padding-\S+/, '');
        $(target).addClass(value).trigger('change');
    },

    _active: function (buttonName, focusNode) {
        return $(focusNode).hasClass(buttonName);
    },
    _getButtonValues: function (method) {
        return this.buttons.$el.find('[data-method="' + method + '"][data-value]').map(function () {
            return $(this).attr('[data-value]');
        }).get();
    }
});

Manager.addPlugin('Padding', Padding);

//--------------------------------------------------------------------------
// Media (for image, video, icon, document)
//--------------------------------------------------------------------------

var MediaPlugin = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_media.xml'],
    dependencies: ['Range', 'Common'],

    buttons: {
        template: 'wysiwyg.buttons.media',
    },

    /**
     * @constructor
     */
    init: function (parent, media, options) {
        this._super.apply(this, arguments);
    },

    start: function () {
        var self = this;
        this.dependencies.Common.addVoidBlockCheck(function (node) {
            return self.isMedia(node);
        });
        return Promise.resolve();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Open the image dialog and listen to its saved/closed events.
     */
    showImageDialog: function (value, range) {
        var self = this;
        var media = this.isMedia(range.sc) && range.sc;
        return new Promise(function (resolve) {
            var $mediaParent = $(media).parent();
            if ($mediaParent.hasClass('media_iframe_video')) {
                media = $mediaParent[0];
                $mediaParent = $mediaParent.parent();
            }
            var mediaDialog = new weWidgets.MediaDialog(self, {
                onlyImages: $mediaParent.data('oeField') === 'image' || $mediaParent.data('oeType') === 'image',
            },
                $(media).clone()[0]
            );
            mediaDialog.on('saved', self, function (data) {
                self._insertMedia(media, data);
                resolve();
            });
            mediaDialog.on('closed', self, function () {
                resolve({noChange: true});
            });
            mediaDialog.open();
        });
    },
    /**
     * Remove the current target media and hide its popover.
     */
    removeMedia: function (value, range) {
        var target = range.sc;
        var point = this.dom.removeBlockNode(target);
        var rangePoints = {
            sc: point.node,
            so: point.offset,
        };
        // TODO create range + .normalize()
        this.dependencies.Range.save(rangePoints);
    },
    /**
    * Return true if the node is a media (image, icon, document or video).
    *
    * @param {Node} node
    * @returns {Boolean}
    */
    isMedia: function (node) {
        return node.tagName === 'IMG';
        return this.isImg(node) ||
            this.isIcon(node) ||
            this.isDocument(node) ||
            this.isVideo(node);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Insert or replace an inline media in the DOM.
     *
     * @private
     * @param {Node} newMedia
     * @param {WrappedRange} range
     * @param {Node} [oldMedia]
     * @returns {WrappedRange}
     */
    _insertBlockMedia: function (newMedia, range, oldMedia) {
        if (oldMedia) {
            range = this._prepareReplaceMedia(oldMedia, newMedia);
            var doNotInsertP = oldMedia.tagName === newMedia.tagName;
            var point = this.dom.removeBlockNode(oldMedia, doNotInsertP);
            if (!range.sc.parentNode || !range.sc.childNodes[range.so]) {
                range.replace({
                    sc: point.node,
                    so: point.offset,
                });
            }
        }
        this.dom.insertBlockNode(newMedia, range.getPoints());
        return this.dependencies.Range.getRange();
    },
    /**
     * Insert or replace an inline media in the DOM.
     *
     * @private
     * @param {Node} newMedia
     * @param {WrappedRange} range
     * @param {Node} [oldMedia]
     * @returns {WrappedRange}
     */
    _insertInlineMedia: function (newMedia, range, oldMedia) {
        if (oldMedia) {
            range = this._prepareReplaceMedia(oldMedia, newMedia);
        }
        var point = range.getStartPoint();
        if (!range.isCollapsed()) {
            point = this.dom.deleteBetween(point, range.getEndPoint());
        }

        if (point.node.tagName) {
            this._insertMediaInElement(newMedia, point, oldMedia);
        } else {
            this._insertMediaInText(newMedia, point);
        }
        var isFakeNotEditable = this._isFakeNotEditable(newMedia);
        if (isFakeNotEditable && !newMedia.previousSibling) {
            $(newMedia).before(this.document.createTextNode(this.utils.char('zeroWidth')), newMedia);
        }
        if (isFakeNotEditable && !newMedia.nextSibling) {
            $(newMedia).after(this.document.createTextNode(this.utils.char('zeroWidth')), newMedia);
        }
        return range.replace({
            sc: newMedia.nextSibling || newMedia,
            so: 0,
        }).normalize();
    },
    /**
     * Insert or replace a media.
     *
     * @param {Node} previous the media to replace, if any
     * @param {Object} data contains the media to insert
     */
    _insertMedia: function (previous, data) {
        var newMedia = data.media;
        var range = this.dependencies.Range.getRange();
        this.editable.focus();
        var isMediaBlock = this.utils.isVideo && this.utils.isVideo(newMedia);
        if (isMediaBlock) {
            range = this._insertBlockMedia(newMedia, range, previous);
        } else {
            range = this._insertInlineMedia(newMedia, range, previous);
        }
        this.dependencies.Range.save(range);
    },
    /**
     * Insert or replace a media inside an element node (point.node).
     *
     * @private
     * @param {Node} newMedia
     * @param {BoundaryPoint} point
     * @param {Node} [oldMedia]
     */
    _insertMediaInElement: function (newMedia, point, oldMedia) {
        if (oldMedia) {
            return $(oldMedia).replaceWith(newMedia);
        }
        if (this.utils.isVoid(point.node)) {
            return point.node.parentNode.insertBefore(newMedia, point.node);
        }
        if (point.node.tagName === 'BR') {
            return $(point.node).replaceWith(newMedia);
        }
        var node = point.node.childNodes[point.offset];
        if (node && node.tagName === 'BR') {
            return $(node).replaceWith(newMedia);
        }
        point.node.insertBefore(newMedia, node || null);
    },
    /**
     * Insert a media inside a text node (point.node).
     *
     * @private
     * @param {Node} newMedia
     * @param {BoundaryPoint} point
     */
    _insertMediaInText: function (newMedia, point) {
        var next = this.document.createTextNode(point.node.textContent.slice(point.offset));
        point.node.textContent = point.node.textContent.slice(0, point.offset);

        $(point.node).after(next).after(newMedia);
        point.node.parentNode.normalize();
    },
    /**
     * Return true if the node is a fake not-editable.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    _isFakeNotEditable: function (node) {
        var contentEditableAncestor = this.utils.ancestor(node, function (n) {
            return !!n.contentEditable && n.contentEditable !== 'inherit';
        });
        return !!contentEditableAncestor && contentEditableAncestor.contentEditable === 'false';
    },
    /**
     * Prepare for replacement of a media with another.
     *
     * @private
     * @param {Node} oldMedia
     * @param {Node} newMedia
     * @returns {WrappedRange}
     */
    _prepareReplaceMedia: function (oldMedia, newMedia) {
        var range = this.dependencies.Range.getRange();
        var start = oldMedia.parentNode;
        range.replace({
            sc: start,
            so: _.indexOf(start.childNodes, oldMedia),
        });
        if (oldMedia.tagName === newMedia.tagName) {
            // Eg: replace an image with an image -> reapply classes removed by `clear`
            var reFaIcons = /fa-(?!spin(\s|$))\S+/g; // do not keep fontawesome icons but keep fa-spin
            $(newMedia).addClass(oldMedia.className.replace(reFaIcons, ''));
        }
        return range;
    },
    /**
     * Select the target media based on the
     * currently saved target or on the current range.
     *
     * @private
     * @param {Node} [target] optional
     * @returns {Node} target
     */
    _selectTarget: function (target) {
        if (!target) {
            target = this.getTarget();
        }

        if (this.context.isDisabled()) {
            return;
        }
        var range = this.dependencies.Range.getRange();
        if (!target && range.isCollapsed()) {
            target = range.sc.childNodes[range.so] || range.sc;
        }
        if (!target || !this.utils.isMedia(target)) {
            return target;
        }

        while (target.parentNode && this.utils.isMedia(target.parentNode)) {
            target = target.parentNode;
        }

        if (!this.dependencies.Common.isEditableNode(target)) {
            if (!target.parentNode) {
                target = this.editable;
            }
            return target;
        }

        this.context.triggerEvent('focusnode', target);

        return target;
    },
});

Manager.addPlugin('Media', MediaPlugin);

//--------------------------------------------------------------------------
// Abstract
//--------------------------------------------------------------------------

var AbstractMediaPlugin = AbstractPlugin.extend({
    dependencies: ['Media', 'Range'],
    editableDomEvents: {
        // 'wysiwyg.Position.mouse': '_onMouseChange',
        // 'wysiwyg.MediaPlugin.focus': '_onFocus',
        // 'wysiwyg.MediaPlugin.blur': '_onBlur',
        'dblclick': '_onDblclick',
    },
    custom_events: {
        edit: '_onEdit',
        remove: '_onRemove',
    },

    isMediaMethod: null,
    popoverConstructor: null,

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    get: function () {
        return false;
    },
    getTargetRange: function (target) {
        if (this.isMediaMethod && this[this.isMediaMethod](target)) {
            return this.dependencies.getRange().replace({
                sc: target,
                so: 0,
            });
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {jQueryEvent} e
     */
    _onDblclick: function (e) {
        if (this.isMediaMethod && this[this.isMediaMethod](e.target)) {
            var range = this.getTargetRange(e.target);
            this.dependencies.Media.showImageDialog(null, range);
        }
    },
    /**
     * @private
     * @param {OdooEvent} oe
     */
    _onEdit: function (oe) {
        ev.stopPropagation();
        this.dependencies.Media.showImageDialog(null, oe.data);
    },
    /**
     * @private
     * @param {OdooEvent} oe
     */
    _onFocus: function (oe) {
        var target = oe.data;
        if (this.popover && !this.popover.is(target)) {
            this.popover.destroy();
            this.popover = null;
        }
        if (this.isMediaMethod && this[this.isMediaMethod](target)) {
            if (!this.popover && this.options.displayPopover(target)) {
                this.popover = new (popovers[this.popoverConstructor])(this, target);
                this.appendTo(this.editor);
            }

            var $target = $(target);
            if (!$target.data('show_tooltip')) {
                $target.data('show_tooltip', true);
                setTimeout(function () {
                    $target.tooltip({
                        title: _t('Double-click to edit'),
                        trigger: 'manuel',
                        container: this.document.body,
                    }).tooltip('show');
                    setTimeout(function () {
                        $target.tooltip('dispose');
                    }, 2000);
                }, 400);
            }
        }
    },
    /**
     * @private
     * @param {OdooEvent} oe
     */
    _onMouseChange: function (oe) {
        if (this.popover) {
            this.popover.updatePosition();
        }
    },
    /**
     * @private
     * @param {OdooEvent} oe
     */
    _onRemove: function (oe) {
        ev.stopPropagation();
        this.dependencies.Media.removeMedia(null, oe.data);
    },
});

//--------------------------------------------------------------------------
// Image
//--------------------------------------------------------------------------

var ImagePlugin = AbstractMediaPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_media.xml'],
    buttons: {
        template: 'wysiwyg.buttons.media',
    },

    isMediaMethod: 'isImg',
    popoverConstructor: 'ImagePopover',

    init: function () {
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    get: function (range) {
        return this.isImg(range.sc) && range.collapse(true);
    },
    /**
     * Return true if the node is an image.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isImg: function (node) {
        return node && node.tagName === "IMG";
    },


    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Save cropped images.
     *
     * @private
     * @returns {Promise}
     */
    _saveCroppedImages: function () {
        var self = this;
        var defs = [].map.call(this.editable.querySelectorAll('.o_cropped_img_to_save'), function (node) {
            var $croppedImg = $(node);
            $croppedImg.removeClass('o_cropped_img_to_save');
            var resModel = $croppedImg.data('crop:resModel');
            var resID = $croppedImg.data('crop:resID');
            var cropID = $croppedImg.data('crop:id');
            var mimetype = $croppedImg.data('crop:mimetype');
            var originalSrc = $croppedImg.data('crop:originalSrc');
            var datas = $croppedImg.attr('src').split(',')[1];
            if (!cropID) {
                var name = originalSrc + '.crop';
                return self._rpc({
                    model: 'ir.attachment',
                    method: 'create',
                    args: [{
                        res_model: resModel,
                        res_id: resID,
                        name: name,
                        datas_fname: name,
                        datas: datas,
                        mimetype: mimetype,
                        url: originalSrc, // To save the original image that was cropped
                    }],
                }).then(function (attachmentID) {
                    return self._rpc({
                        model: 'ir.attachment',
                        method: 'generate_access_token',
                        args: [
                            [attachmentID],
                        ],
                    }).then(function (access_token) {
                        $croppedImg.attr('src', '/web/image/' + attachmentID + '?access_token=' + access_token[0]);
                    });
                });
            } else {
                return self._rpc({
                    model: 'ir.attachment',
                    method: 'write',
                    args: [
                        [cropID], {
                            datas: datas,
                        },
                    ],
                });
            }
        }).get();
        return $.when.apply($, defs);
    },
});

Manager.addPlugin('Image', ImagePlugin);

//--------------------------------------------------------------------------
// Video
//--------------------------------------------------------------------------

var VideoPlugin = AbstractMediaPlugin.extend({
    isMediaMethod: 'isVideo',
    popoverConstructor: 'VideoPopover',

    init: function () {
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    get: function (range) {
        var video = this.isVideo(range.sc);
        if (video) {
            return range.replace({
                sc: video,
                so: 0
            });
        }
    },
    /**
     * Return true if the node is a video.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isVideo: function (node) {
        node = node && !node.tagName ? node.parentNode : node;
        return (node.tagName === "IFRAME" || node.tagName === "DIV") &&
            (node.parentNode.className && node.parentNode.className.indexOf('media_iframe_video') !== -1 ||
                node.className.indexOf('media_iframe_video') !== -1);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    getTargetRange: function (target) {
        target = this[this.isMediaMethod](target) && $(target).closest('.media_iframe_video')[0];
        if (target) {
            var wRange = this.dependencies.Range.getRange();
            wRange.sc = range.ec = target;
            wRange.so = range.eo = target;
            return wRange;
        }
    },

});

Manager.addPlugin('Video', VideoPlugin);

//--------------------------------------------------------------------------
// Icons: Fontawesome (and other with themes)
//--------------------------------------------------------------------------

var IconPlugin = AbstractMediaPlugin.extend({
    isMediaMethod: 'isIcon',
    popoverConstructor: 'IconPopover',

    init: function () {
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    get: function (range) {
        return this.isIcon(range.sc) && range.collapse(true);
    },
    /**
     * Return true if the node is an icon.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isIcon: function (node) {
        return node && node.className && node.className.indexOf(' fa-') !== -1;
    },
});

Manager.addPlugin('Icon', IconPlugin);

//--------------------------------------------------------------------------
// Media Document
//--------------------------------------------------------------------------

var DocumentPlugin = AbstractMediaPlugin.extend({
    isMediaMethod: 'isDocument',
    popoverConstructor: 'DocumentPopover',

    init: function () {
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    get: function (range) {
        return this.isDocument(range) && range.collapse(true);
    },
    /**
     * Return true is the node is a document.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isDocument: function (node) {
        node = node && !node.tagName ? node.parentNode : node;
        return node && (node.tagName === "A" && node.className.indexOf('o_image') !== -1);
    },
});

Manager.addPlugin('Document', DocumentPlugin);

//--------------------------------------------------------------------------
// Handle (hover image)
//--------------------------------------------------------------------------

// Make sure not to forget https://github.com/odoo/odoo/pull/31226 !!!
// var HandlePlugin = Plugins.handle.extend({
//     /**
//      * Update the handle.
//      *
//      * @param {Node} target
//      * @returns {Boolean}
//      */
//     update: function (target) {
//         if (this.context.isDisabled()) {
//             return false;
//         }
//         var isImage = this.utils.isImg(target);
//         var $selection = this.$handle.find('.note-control-selection');
//         this.context.invoke('imagePopover.update', target);
//         if (!isImage) {
//             return isImage;
//         }

//         var $target = $(target);
//         var pos = $target.offset();
//         var posContainer = $selection.closest('.note-handle').offset();

//         // exclude margin
//         var imageSize = {
//             w: $target.outerWidth(false),
//             h: $target.outerHeight(false)
//         };
//         $selection.css({
//             display: 'block',
//             left: pos.left - posContainer.left,
//             top: pos.top - posContainer.top,
//             width: imageSize.w,
//             height: imageSize.h,
//         }).data('target', $target); // save current target element.

//         var src = $target.attr('src');
//         var sizingText = imageSize.w + 'x' + imageSize.h;
//         if (src) {
//             var origImageObj = new Image();
//             origImageObj.src = src;
//             sizingText += ' (' + this.lang.image.original + ': ' + origImageObj.width + 'x' + origImageObj.height + ')';
//         }
//         $selection.find('.note-control-selection-info').text(sizingText);

//         return isImage;
//     },
// });

// Manager.addPlugin('Handle', HandlePlugin);

return {
    MediaPlugin: MediaPlugin,
    ImagePlugin: ImagePlugin,
    VideoPlugin: VideoPlugin,
    IconPlugin: IconPlugin,
    DocumentPlugin: DocumentPlugin,
};

});
