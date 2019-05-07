odoo.define('wysiwyg.widgets.image_preview_dialog', function (require) {
'use strict';

var core = require('web.core');
var Dialog = require('web.Dialog');
var utils = require('web.utils');

var _t = core._t;

var ImagePreviewDialog = Dialog.extend({
    template: 'wysiwyg.widgets.image.preview',
    xmlDependencies: ['/web_editor/static/src/xml/wysiwyg.xml'],

    events: _.extend({}, Dialog.prototype.events, {
        'click .o_we_width_preset': '_onClickWidthPreset',
        'input #o_we_quality_input': '_onInputQuality',
        'input #o_we_width': '_updatePreview',
        'input .js_quality_range': '_updatePreview',
    }),
    /**
     * @constructor
     */
    init: function (parent, options, attachment, def, optimizedWidth) {
        var self = this;
        this._super(parent, _.extend({}, {
            title: _t("Improve your Image"),
            size: 'large',
            buttons: [
                {text: _t("Optimize"), classes: 'btn-primary', close: false, click: this._onSave.bind(this)},
                {text: _t("Keep Original"), close: true}
            ],
        }, options));
        this.on('closed', this, this._onClosed);

        this.attachment = attachment;
        this.defaultQuality = 80;
        this.def = def;
        this.optimizedWidth = Math.min(optimizedWidth || attachment.width, attachment.width);

        this.widthRadios = _.sortBy([
            {'width': this.optimizedWidth, 'text': _('Default')},
            {'width': 64, 'text': _('Small')},
            {'width': 128, 'text': _('Medium')},
            {'width': 256, 'text': _('Large')},
            {'width': 1024, 'text': _('Big')},
            {'width': this.attachment.width, 'text': _('Original')},
        ], 'width');
        this.widthRadios = _.map(this.widthRadios, function (el) {
            el.disabled = el.width > self.attachment.width;
            return el;
        });
        // TODO SEB check with SBU for how to handle quality setting for png, svg, ...
        this._updatePreview = _.debounce(this._updatePreview.bind(this), 300);
    },
    /**
     * @override
     */
    start: function () {
        var defParent = this._super.apply(this, arguments);
        this.$previewImage = this.$('.js_preview_image');
        this.$qualityRange = this.$('.js_quality_range');
        this.$qualityInput = this.$('#o_we_quality_input');
        this.$currentSize = this.$('.js_current_size');
        this.$filename = this.$('#o_we_filename');
        this.$widthInput = this.$('#o_we_width');
        this.$configColumn = this.$('#o_we_config_column');
        this.$previewColumn = this.$('#o_we_preview_column');
        this.$previewError = this.$('#o_we_preview_error');
        this._updatePreview();
        return defParent;
    },
    /**
     * Requests a preview for the current settings and displays it.
     *
     * @private
     * @returns {Deferred}
     */
    _updatePreview: function () {
        var self = this;
        var quality = parseInt(this.$qualityRange.val());
        this.$qualityInput.val(quality);

        return this._rpc({
            route: _.str.sprintf('/web_editor/attachment/%d/preview', this.attachment.id),
            params: {
                'quality': quality,
                'width': parseInt(this.$widthInput.val()),
            }
        }).then(function (res) {
            self.$currentSize.text(utils.binaryToBinsize(res.image.split(',')[1]));
            self.$previewImage.attr('src', res.image);
        }).guardedCatch(function () {
            self.$previewError.text(_t("An error occured while loading the preview.")).removeClass('d-none');
        });
    },
    _onInputQuality: function () {
        var quality = parseInt(this.$qualityInput.val());
        this.$qualityRange.val(quality);
        this._updatePreview();
    },
    /**
     * Handles clicking on the save button, which is resolving the deferred with
     * the current settings.
     */
    _onSave: function () {
        var self = this;
        var filename = this.$filename.val();
        if (!filename || this.$widthInput.val() > this.attachment.width || this.$widthInput.val() < 0) {
            return $.Deferred.reject();
        }
        return this._rpc({
            route: _.str.sprintf('/web_editor/attachment/%d/update', this.attachment.id),
            params: {
                'quality': parseInt(this.$qualityRange.val()),
                'filename': filename,
                'width': parseInt(this.$widthInput.val()),
            },
        }).then(function (attachment) {
            self.def.resolve(attachment);
            self.close();
        }).guardedCatch(function () {
            self.$previewError.text(_t("An error occured while saving the settings.")).removeClass('d-none');
        });
    },
    /**
     * Does nothing if called after save, otherwise resolves with the original
     * attachment.
     */
    _onClosed: function () {
        if (this.def.state() === 'pending') {
            this.def.resolve(this.attachment);
        }
    },
    _onClickWidthPreset: function (ev) {
        ev.preventDefault();
        this.$widthInput.val(parseInt($(ev.target).data('width')));
        this._updatePreview();
    },

});

return {
    ImagePreviewDialog: ImagePreviewDialog,
};
});
