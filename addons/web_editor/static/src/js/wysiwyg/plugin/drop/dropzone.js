odoo.define('web_editor.wysiwyg.plugin.dropzone', function (require) {
'use strict';

var core = require('web.core');
var Dialog = require('web.Dialog');
var Plugins = require('web_editor.wysiwyg.plugins');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var _t = core._t;

var DropzonePlugin = Plugins.dropzone.extend({
    dependencies: [],
    //--------------------------------------------------------------------------
    // Public summernote module API
    //--------------------------------------------------------------------------

    /**
     * Disable Summernote's handling of drop events.
     */
    attachDragAndDropEvent: function () {
        this._super.apply(this, arguments);
        this.$dropzone.off('drop');
        this.$dropzone.on('drop', this._onDrop.bind(this));
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Clean up then drops HTML or plain text into the editor.
     *
     * @private
     * @param {String} html
     * @param {Boolean} textOnly true to allow only dropping plain text
     */
    _dropHTML: function (html, textOnly) {
        this.context.invoke('editor.beforeCommand');

        // Clean up
        var nodes = this.context.invoke('ClipboardPlugin.prepareClipboardData', html);

        // Delete selection
        var point = this.dom.deleteSelection(this.dependencies.Arch.getRange(), true);
        var range = this.dependencies.Arch.setRange({
            sc: point.node,
            so: point.offset,
        });

        // Insert the nodes
        this.context.invoke('ClipboardPlugin.pasteNodes', nodes, textOnly);
        range = this.dependencies.Arch.getRange().normalize();

        this.context.invoke('editor.afterCommand');
    },
    /**
     * Drop images into the editor: save them as attachments.
     *
     * @private
     * @param {File[]]} files (images only)
     */
    _dropImages: function (files) {
        var self = this;
        this.context.invoke('editor.beforeCommand');
        var range = this.dependencies.Arch.getRange();

        var spinners = [];
        var images = [];
        var defs = [];
        _.each(files, function (file) {
            // Add spinner
            var spinner = $('<span class="fa fa-spinner fa-spin">').attr('data-filename', file.name)[0];
            self.context.invoke('editor.hidePopover');
            if (range.sc.tagName) {
                if (range.so >= self.utils.nodeLength(range.sc)) {
                    $(range.sc).append(spinner);
                } else {
                    $(range.sc).before(range.sc.childNodes[range.so]);
                }
            } else {
                range.sc.splitText(range.so);
                $(range.sc).after(spinner);
            }
            spinners.push(spinner);

            // save images as attachments
            var def = new Promise(function (resolve) {
                // Get image's Base64 string
                var reader = new FileReader();
                reader.addEventListener('load', function (e) {
                    self._uploadImage(e.target.result, file.name).then(function (attachment) {
                        // Make the HTML
                        var image = document.createElement('img');
                        image.setAttribute('style', 'width: 100%;');
                        image.src = '/web/content/' + attachment.id + '/' + attachment.name;
                        image.alt = attachment.name;
                        $(spinner).replaceWith(image);
                        images.push(image);
                        resolve(image);
                        $(image).trigger('dropped');
                    });
                });
                reader.readAsDataURL(file);
            });
            defs.push(def);
        });

        this.trigger_up('drop_images', {
            spinners: spinners,
            promises: defs,
        });

        Promise.all(defs).then(function () {
            var defs = [];
            $(images).each(function () {
                if (!this.height) {
                    var def = new Promise(function (resolve) {
                        $(this).one('load error abort', resolve);
                    });
                    defs.push(def);
                }
            });
            Promise.all(defs).then(function () {
                if (images.length === 1) {
                    var range = self.dependencies.Arch.setRange({
                        sc: _.last(images),
                        so: 0,
                    });
                    self.dependencies.Arch.setRange(range);
                    self.context.invoke('editor.afterCommand');
                    self.context.invoke('MediaPlugin.updatePopoverAfterEdit', images[0]);
                } else {
                    self.context.invoke('editor.afterCommand');
                }
            });
        });
    },
    /**
     * Simulate a do_notify by notifying the user through a dialog.
     *
     * @private
     * @param {String} title
     * @param {String} content
     */
    _notify: function (title, content) {
        var $notif = $('<p>' + content + '</p>');
        new Dialog(this, {
            title: title,
            size: 'medium',
            $content: $notif,
        }).open();
    },
    /**
     * Upload an image from its Base64 representation.
     *
     * @private
     * @param {String} imageBase64
     * @param {String} fileName
     * @returns {Promise}
     */
    _uploadImage: function (imageBase64, fileName) {
        var options = {};
        this.trigger_up('getRecordInfo', {
            recordInfo: options,
            type: 'media',
            callback: function (recordInfo) {
                _.defaults(options, recordInfo);
            },
        });

        return this._rpc({
            route: '/web_editor/add_image_base64',
            params: {
                res_model: options.res_model,
                res_id: options.res_id,
                image_base64: imageBase64.split(';base64,').pop(),
                filename: fileName,
            },
        });
    },
    /**
     * @private
     * @param {JQueryEvent} e
     */
    _onDrop: function (e) {
        e.preventDefault();

        if (this.options.disableDragAndDrop) {
            return;
        }
        var dataTransfer = e.originalEvent.dataTransfer;

        if (!this._canDropHere()) {
            this._notify(_t("Not a dropzone"), _t("Dropping is prohibited in this area."));
            return;
        }

        if (dataTransfer.getData('text/html')) {
            this._dropHTML(dataTransfer.getData('text/html'));
            return;
        }
        if (dataTransfer.files.length) {
            var images = [];
            _.each(dataTransfer.files, function (file) {
                if (file.type.indexOf('image') !== -1) {
                    images.push(file);
                }
            });
            if (!images.length || images.length < dataTransfer.files.length) {
                this._notify(_t("Unsupported file type"), _t("Images are the only file types that can be dropped."));
            }
            if (images.length) {
                this._dropImages(images);
            }
        }
    },
    /**
     * Return true if dropping is allowed at the current range.
     *
     * @private
     * @returns {Boolean}
     */
    _canDropHere: function () {
        var range = this.dependencies.Arch.getRange();
        return this.dependencies.Arch.isEditableNode(range.sc);
    },
});

Manager.addPlugin('dropzone', DropzonePlugin);

return DropzonePlugin;

});
