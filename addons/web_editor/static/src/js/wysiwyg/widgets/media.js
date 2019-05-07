odoo.define('wysiwyg.widgets.media', function (require) {
'use strict';

var concurrency = require('web.concurrency');
var core = require('web.core');
var Dialog = require('web.Dialog');
var fonts = require('wysiwyg.fonts');
var session = require('web.session');
var utils = require('web.utils');
var Widget = require('web.Widget');

var QWeb = core.qweb;
var _t = core._t;

var ImagePreviewDialog = require('wysiwyg.widgets.image_preview_dialog').ImagePreviewDialog;

var MediaWidget = Widget.extend({
    xmlDependencies: ['/web_editor/static/src/xml/wysiwyg.xml'],

    /**
     * @constructor
     * @param {Element} media: the target Element for which we select a media
     * @param {Object} options: useful parameters such as res_id, res_model,
     *  context, user_id, ...
     */
    init: function (parent, media, options) {
        options = options || {};
        this._super.apply(this, arguments);
        this.media = media;
        this.$media = $(media);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @todo comment
     */
    clear: function () {
        if (!this.media) {
            return;
        }
        this._clear();
    },
    /**
     * Saves the currently configured media on the target media.
     *
     * @abstract
     * @returns {*}
     */
    save: function () {},

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @abstract
     */
    _clear: function () {},
});

var SearchWidget = MediaWidget.extend({
    events: _.extend({}, MediaWidget.prototype.events || {}, {
        'input input.o_we_search': '_onSearchInput',
    }),

    /**
     * @constructor
     */
    init: function () {
        this._super.apply(this, arguments);
        this._onSearchInput = _.debounce(this._onSearchInput, 500);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Finds and displays existing attachments related to the target media.
     *
     * @abstract
     * @param {string} needle: only return attachments matching this parameter
     * @returns {Deferred}
     */
    search: function (needle) {},

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onSearchInput: function (ev) {
        this.search($(ev.currentTarget).val() || '');
    },
});

/**
 * Let users choose a file, including uploading a new file in odoo.
 */
var FileWidget = SearchWidget.extend({
    events: _.extend({}, SearchWidget.prototype.events || {}, {
        'change .o_file_input': '_onChangeFileInput',
        'click .o_existing_attachment_cell': '_onImageClick',
        'click .o_existing_attachment_remove': '_onRemoveClick',
        'click .o_load_more': '_onLoadMoreClick',
        'click .o_upload_media_button': '_onUploadButtonClick',
        'click .o_upload_media_url_button': '_onUploadURLButtonClick',
        'click .o_we_advanced_upload': '_onClickAdvancedUpload',
        'dblclick .o_existing_attachment_cell': '_onImageDblClick',
        'input .o_we_url_input': '_onInputUrl',
    }),

    IMAGES_PER_ROW: 6,
    IMAGES_ROWS: 5,
    // This factor is used to take into account that an image displayed in a BS
    // column might get bigger when displayed on a smaller breakpoint if that
    // breakpoint leads to have less columns.
    // Eg. col-lg-6 -> 480px per column -> col-md-12 -> 720px per column -> 1.5
    // However this will not be enough if going from 3 or more columns to 1, but
    // in that case, we consider it a snippet issue.
    OPTIMIZE_WIDTH_FACTOR: 1.5,

    // TODO SEB test the resulting page with google page rank / page optimize

    /**
     * @constructor
     */
    init: function (parent, media, options) {

        this._super.apply(this, arguments);
        this._mutex = new concurrency.Mutex();

        this.imagesRows = this.IMAGES_ROWS;

        options = options || {};
        this.options = options;
        this.context = options.context;
        this.accept = options.accept;

        this.multiImages = options.multiImages;

        this.firstFilters = options.firstFilters || [];
        this.lastFilters = options.lastFilters || [];

        this.records = [];
        this.selectedImages = [];
    },
    /**
     * Loads all the existing images related to the target media.
     *
     * @override
     */
    willStart: function () {
        return Promise.all([
            this._super.apply(this, arguments),
            this.search('', true)
        ]);
    },
    /**
     * @override
     */
    start: function () {
        var def = this._super.apply(this, arguments);
        var self = this;
        this.$urlInput = this.$('.o_we_url_input');
        this.$form = this.$('form');
        this.$fileInput = this.$('.o_file_input');
        this.$uploadButton = this.$('.o_upload_media_button');
        this.$addUrlButton = this.$('.o_upload_media_url_button');
        this.$urlSuccess = this.$('.o_we_url_warning');
        this.$urlWarning = this.$('.o_we_url_success');
        this.$urlError = this.$('.o_we_url_error');
        this.$formText = this.$('.form-text');

        this._renderImages(true);

        // If there is already an image on the target, select by default that
        // image if it is among the loaded images.
        // TODO SEB improve this to also work for product image for example,
        // or any image where the url is not the attachment url but a field
        // for example based on res_id, checksum, etc.
        var o = {
            url: null,
            alt: null,
        };
        if (this.$media.is('img')) {
            o.url = this.$media.attr('src');
        } else if (this.$media.is('a.o_image')) {
            o.url = this.$media.attr('href').replace(/[?].*/, '');
            o.id = +o.url.match(/\/web\/content\/(\d+)/, '')[1];
        }
        if (o.url) {
            self._toggleImage(_.find(self.records, function (record) {
                return record.url === o.url;
            }) || o);
            this.search('');
        }

        return def;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Saves the currently selected image on the target media. If new files are
     * currently being added, delays the save until all files have been added.
     *
     * @override
     */
    save: function () {
        return this._mutex.exec(this._save.bind(this));
    },
    /**
     * @override
     * @param {boolean} noRender: if true, do not render the found attachments
     */
    search: function (needle, noRender) {
        var self = this;
        return this._rpc({
            model: 'ir.attachment',
            method: 'search_read',
            args: [],
            kwargs: {
                domain: this._getAttachmentsDomain(needle),
                fields: ['name', 'datas_fname', 'mimetype', 'checksum', 'url', 'type', 'res_id', 'res_model', 'access_token'],
                order: [{name: 'id', asc: false}],
                context: this.context,
            },
        }).then(function (records) {
            self.records = _.chain(records)
                .filter(function (r) {
                    // TODO SEB do this in the domain
                    return (r.type === "binary" || r.url && r.url.length > 0);
                })
                .uniq(function (r) {
                    // TODO SEB try to do this in the domain
                    return (r.url || r.id);
                })
                .sortBy(function (r) {
                    // TODO SEB maybe we should make a route that takes care of this
                    if (_.any(self.firstFilters, function (filter) {
                        var regex = new RegExp(filter, 'i');
                        return r.name.match(regex) || r.datas_fname && r.datas_fname.match(regex);
                    })) {
                        return -1;
                    }
                    if (_.any(self.lastFilters, function (filter) {
                        var regex = new RegExp(filter, 'i');
                        return r.name.match(regex) || r.datas_fname && r.datas_fname.match(regex);
                    })) {
                        return 1;
                    }
                    return 0;
                })
                .value();

            _.each(self.records, function (record) {
                record.src = record.url || _.str.sprintf('/web/image/%s/%s', record.id, encodeURI(record.name)); // Name is added for SEO purposes
                record.isDocument = !(/gif|jpe|jpg|png/.test(record.mimetype));
            });
            if (!noRender) {
                self._renderImages();
            }
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _clear: function () {
        if (!this.$media.is('img')) {
            return;
        }
        var allImgClasses = /(^|\s+)((img(\s|$)|img-(?!circle|rounded|thumbnail))[^\s]*)/g;
        var allImgClassModifiers = /(^|\s+)(rounded-circle|shadow|rounded|img-thumbnail|mx-auto)([^\s]*)/g;
        this.media.className = this.media.className && this.media.className
            .replace('o_we_custom_image', '')
            .replace(allImgClasses, ' ')
            .replace(allImgClassModifiers, ' ');
    },
    /**
     * Returns the domain for attachments used in media dialog.
     * We look for attachments related to the current document. If there is a value for the model
     * field, it is used to search attachments, and the attachments from the current document are
     * filtered to display only user-created documents.
     * In the case of a wizard such as mail, we have the documents uploaded and those of the model
     *
     * @private
     * @params {string} needle
     * @returns {Array} "ir.attachment" odoo domain.
     */
    _getAttachmentsDomain: function (needle) {
        var domain = this.options.attachmentIDs && this.options.attachmentIDs.length ? ['|', ['id', 'in', this.options.attachmentIDs]] : [];

        var attachedDocumentDomain = [
            '&',
            ['res_model', '=', this.options.res_model],
            ['res_id', '=', this.options.res_id|0]
        ];
        // if the document is not yet created, do not see the documents of other users
        if (!this.options.res_id) {
            attachedDocumentDomain.unshift('&');
            attachedDocumentDomain.push(['create_uid', '=', this.options.user_id]);
        }
        if (this.options.data_res_model) {
            var relatedDomain = ['&',
                ['res_model', '=', this.options.data_res_model],
                ['res_id', '=', this.options.data_res_id|0]];
            if (!this.options.data_res_id) {
                relatedDomain.unshift('&');
                relatedDomain.push(['create_uid', '=', session.uid]);
            }
            domain = domain.concat(['|'], attachedDocumentDomain, relatedDomain);
        } else {
            domain = domain.concat(attachedDocumentDomain);
        }
        domain = ['|', ['public', '=', true]].concat(domain);

        domain.push('|',
            ['mimetype', '=', false],
            this.options.mimetypeDomain);
        if (needle && needle.length) {
            domain.push('|', ['datas_fname', 'ilike', needle], ['name', 'ilike', needle]);
        }
        domain.push('|', ['datas_fname', '=', false], '!', ['datas_fname', '=like', '%.crop'], '!', ['name', '=like', '%.crop']);
        return domain;
    },
    /**
     * Returns the total number of images that should be displayed, depending
     * on the number of images per row and the current number of rows.
     *
     * @private
     * @returns {integer} the number of images to display
     */
    _getNumberOfImagesToDisplay: function () {
        return this.IMAGES_PER_ROW * this.imagesRows;
    },
    /**
     * @private
     */
    _highlightSelectedImages: function () {
        var self = this;
        this.$('.o_existing_attachment_cell.o_selected').removeClass("o_selected");
        _.each(this.selectedImages, function (image) {
            self.$('.o_existing_attachment_cell[data-id=' + image.id + ']').addClass("o_selected");
        });
    },
    /**
     * @private
     */
    _loadMoreImages: function (forceSearch) {
        this.imagesRows += 2;
        if (!forceSearch) {
            this._renderImages();
        } else {
            this.search(this.$('.o_we_search').val() || '');
        }
    },
    /**
     * Renders the existing attachments and returns the result as a string.
     *
     * @abstract
     * @param {Array} attachments
     * @param {boolean} withEffect
     * @returns {string}
     */
    _renderExisting: function (attachments, withEffect) {},
    /**
     * @private
     */
    _renderImages: function (withEffect) {
        // TODO SEB filter out mimetype in the image widget: /gif|jpe|jpg|png/.test($div.data('mimetype'))
        var attachments = _(this.records).slice(0, this._getNumberOfImagesToDisplay());

        this.$('.form-text').empty();

        // Render menu & content
        this.$('.existing-attachments').replaceWith(
            this._renderExisting(attachments, withEffect)
        );

        this._highlightSelectedImages();

        // adapt load more
        var noMoreImgToLoad = this._getNumberOfImagesToDisplay() >= this.records.length;
        this.$('.o_load_more').toggleClass('d-none', noMoreImgToLoad);
        this.$('.o_load_done_msg').toggleClass('d-none', !noMoreImgToLoad);
    },
    /**
     * @private
     */
    _save: function () {
        var self = this;
        if (this.multiImages) {
            return this.selectedImages;
        }

        // TODO SEB move this check above multi images and don't allow to save
        // if it's empty, should display error instead.
        // User should click discard if he doesn't want a change.
        var img = this.selectedImages[0];
        if (!img) {
            return this.media;
        }

        var prom;
        if (!img.access_token) {
            prom = this._rpc({
                model: 'ir.attachment',
                method: 'generate_access_token',
                args: [[img.id]]
            }).then(function (access_token) {
                img.access_token = access_token[0];
            });
        }

        return Promise.resolve(prom).then(function () {
            if (!img.isDocument) {
                if (img.access_token && self.options.res_model !== 'ir.ui.view') {
                    img.src += _.str.sprintf('?access_token=%s', img.access_token);
                }
                if (!self.$media.is('img')) {
                    // Note: by default the images receive the bootstrap opt-in
                    // img-fluid class. We cannot make them all responsive
                    // by design because of libraries and client databases img.
                    self.$media = $('<img/>', {class: 'img-fluid o_we_custom_image'});
                    self.media = self.$media[0];
                }
                self.$media.attr('src', img.src);

            } else {
                if (!self.$media.is('a')) {
                    $('.note-control-selection').hide();
                    self.$media = $('<a/>');
                    self.media = self.$media[0];
                }
                var href = '/web/content/' + img.id + '?';
                if (img.access_token && self.options.res_model !== 'ir.ui.view') {
                    href += _.str.sprintf('access_token=%s&', img.access_token);
                }
                href += 'unique=' + img.checksum + '&download=true';
                self.$media.attr('href', href);
                self.$media.addClass('o_image').attr('title', img.name).attr('data-mimetype', img.mimetype);
            }

            self.$media.attr('alt', img.alt);
            var style = self.style;
            if (style) {
                self.$media.css(style);
            }

            // Remove crop related attributes
            if (self.$media.attr('data-aspect-ratio')) {
                var attrs = ['aspect-ratio', 'x', 'y', 'width', 'height', 'rotate', 'scale-x', 'scale-y'];
                _.each(attrs, function (attr) {
                    self.$media.removeData(attr);
                    self.$media.removeAttr('data-' + attr);
                });
            }
            return self.media;
        });
    },
    /**
     * @privatee
     */
    _toggleImage: function (attachment, forceSelect) {
        if (this.multiImages) {
            // if the clicked image is already selected, then unselect it
            // unless it was a double click
            var index = this.selectedImages.indexOf(attachment);
            if (index !== -1) {
                if (!forceSelect) {
                    this.selectedImages.splice(index, 1);
                }
            } else {
                // if the clicked image is not selected, then select it
                this.selectedImages.push(attachment);
            }
        } else {
            // select the clicked image
            this.selectedImages = [attachment];
        }
        this._highlightSelectedImages();
    },
    /**
     * Updates the add by URL UI.
     *
     * @private
     * @param {boolean} emptyValue
     * @param {boolean} isURL
     * @param {boolean} isImage
     */
    _updateAddUrlUi(emptyValue, isURL, isImage) {
        this.$addUrlButton.toggleClass('btn-secondary', emptyValue)
            .toggleClass('btn-primary', !emptyValue)
            .prop('disabled', !isURL);
        this.$urlSuccess.toggleClass('d-none', !isURL);
        this.$urlError.toggleClass('d-none', emptyValue || isURL);
    },
    /**
     * Create an attachment for each new file, and then open the Preview dialog
     * for one image at a time.
     *
     * @private
     */
    _uploadImageFiles: function () {
        var self = this;
        var uploadMutex = new concurrency.Mutex();
        var previewMutex = new concurrency.Mutex();
        var promises = [];
        // upload the smallest file first to block the user the least possible
        var files = _.sortBy(this.$fileInput[0].files, 'size');
        for (var file of files) {
            // upload one file at a time
            var promiseUpload = uploadMutex.exec(function () {
                // TODO SEB create a placeholder while it is uploading
                // TODO SEB remove the placeholder if the upload fails
                var $placeholder = $(QWeb.render('wysiwyg.widgets.image.existing.attachment', {
                    attachment: {
                        src: '',
                        url: '',
                        res_model: self.options.res_model,
                        name: 'Placeholder',
                    }
                }));
                $placeholder.prependTo(self.$('.existing-attachments'));
                // TODO SEB the last image of a multi is uploaded in place of all the others sometimes
                return self._uploadImageFile(file).then(function (attachment) {
                    if (self.advancedUpload) {
                        // TODO SEB maybe hide the big modal while we show the previews
                        // show only one preview at a time
                        previewMutex.exec(function () {
                            return self._previewAttachment(attachment).then(function (updatedAttachment) {
                                self._handleNewAttachment(updatedAttachment || attachment);
                            });
                        });
                    } else {
                        self._handleNewAttachment(attachment);
                    }
                });
            });
            promises.push(promiseUpload);
        }

        self.$fileInput.val('');

        var promiseUploads = Promise.all(promises).guardedCatch(function () {
            // at least one upload failed
            // TODO SEB show the text with error style
            self.$el.find('.form-text').text(
                // TODO SEB improve this message: list the failed files
                // Add the reason if possible per file, or a generic reason: wrong file type or file too large
                _("At least one of the files you selected could not be saved.")
            );
        });

        return $.when(promiseUploads, previewMutex.getUnlockedDef()).then(function () {
            self.advancedUpload = false;
        });

        // TODO SEB when all done:
        // if (!self.multiImages) {
        //     self.trigger_up('save_request');
        // }
        // also : this.selectedImages = attachments;
    },
    /**
     * Open the image preview dialog for the given attachment.
     *
     * @private
     */
    _previewAttachment: function (attachment) {
        var def = $.Deferred();
        new ImagePreviewDialog(this, {}, attachment, def, this._computeOptimizedWidth()).open();
        return def;
    },
    /**
     * Creates an attachment for the given file.
     *
     * @private
     * @param {Blob|File} file
     * @returns {Deferred} resolved with the attachment
     */
    _uploadImageFile: function (file) {
        var self = this;

        return utils.getDataURLFromFile(file).then(function (dataURL) {
            return self._rpc({
                route: '/web_editor/attachment/add_image_base64',
                params: {
                    'res_id': self.options.res_id,
                    'image_base64': dataURL.split(',')[1],
                    'filename': file.name,
                    'res_model': self.options.res_model,
                    'filters': self.firstFilters.join('_'),
                    'width': self.advancedUpload ? 0 : self._computeOptimizedWidth(),
                },
            });
        });
    },
    _computeOptimizedWidth: function () {
        return Math.min(1920, parseInt(this.mediaWidth * this.OPTIMIZE_WIDTH_FACTOR));
    },
    _handleNewAttachment: function (attachment) {
        this._toggleImage(attachment);
        this.search('');
    },
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onImageClick: function (ev, force_select) {
        var $target = $(ev.currentTarget);
        var attachment = _.find(this.records, {id: $target.data('id')});
        this._toggleImage(attachment, force_select);
    },
    /**
     * @private
     */
    _onImageDblClick: function (ev) {
        this._onImageClick(ev, true);
        this.trigger_up('save_request');
    },
    /**
     * Handles change of the file input: create attachments with the new files
     * and open the Preview dialog for each of them. Locks the save button until
     * all new files have been processed.
     *
     * @private
     */
    _onChangeFileInput: function () {
        this.$form.removeClass('o_has_error').find('.form-control, .custom-select').removeClass('is-invalid');
        this.$formText.empty();
        return this._mutex.exec(this._uploadImageFiles.bind(this));
    },
    /**
     * @private
     */
    _onClickAdvancedUpload: function () {
        this.advancedUpload = true;
        this.$uploadButton.trigger('click');
    },
    /**
     * @private
     */
    _onRemoveClick: function (ev) {
        var self = this;
        ev.stopPropagation();
        Dialog.confirm(this, _t("Are you sure you want to delete this file ?"), {
            confirm_callback: function () {
                self.$formText.empty();
                var $a = $(ev.currentTarget);
                var id = parseInt($a.data('id'), 10);
                var attachment = _.findWhere(self.records, {id: id});
                 return self._rpc({
                    route: '/web_editor/attachment/remove',
                    params: {
                        ids: [id],
                    },
                }).then(function (prevented) {
                    if (_.isEmpty(prevented)) {
                        self.records = _.without(self.records, attachment);
                        self._renderImages();
                        return;
                    }
                    self.$formText.replaceWith(QWeb.render('wysiwyg.widgets.image.existing.error', {
                        views: prevented[id],
                    }));
                });
            }
        });
    },
    /**
     * @private
     */
    _onInputUrl: function () {
        var inputValue = this.$urlInput.val();
        var emptyValue = (inputValue === '');

        var isURL = /^.+\..+$/.test(inputValue); // TODO improve
        var isImage = _.any(['.gif', '.jpeg', '.jpe', '.jpg', '.png'], function (format) {
            return inputValue.endsWith(format);
        });

        this._updateAddUrlUi(emptyValue, isURL, isImage);
    },
    /**
     * @private
     */
    _onUploadButtonClick: function () {
        this.$('input[type=file]').click();
    },
    /**
     * @private
     */
    _onUploadURLButtonClick: function () {
        var self = this;
        return this._rpc({
            route: '/web_editor/attachment/add_url',
            params: {
                'res_id': this.options.res_id,
                'url': this.$urlInput.val(),
                'res_model': this.options.res_model,
                'filters': this.firstFilters.join('_'),
            },
        }).then(function (attachment) {
            self.$urlInput.val('');
            self._handleNewAttachment(attachment);
        });
        // TODO SEB handle error
    },
    /**
     * @private
     */
    _onLoadMoreClick: function () {
        this._loadMoreImages();
    },
    /**
     * @override
     */
    _onSearchInput: function () {
        this.imagesRows = this.IMAGES_ROWS;
        this._super.apply(this, arguments);
    },
});

/**
 * Let users choose an image, including uploading a new image in odoo.
 */
var ImageWidget = FileWidget.extend({
    template: 'wysiwyg.widgets.image',

    /**
     * @constructor
     */
    init: function (parent, media, options) {
        options = options || {};
        this._super.apply(this, [parent, media, _.extend({}, options, {
            accept: options.accept || 'image/*',
            mimetypeDomain: options.mimetypeDomain || ['mimetype', 'in',
                ['image/gif', 'image/jpe', 'image/jpeg', 'image/jpg', 'image/gif', 'image/png']
            ],
        })]);
        this.mediaWidth = options.mediaWidth;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _renderExisting: function (attachments, withEffect) {
        return QWeb.render('wysiwyg.widgets.image.existing.attachments', {
            attachments: attachments,
            withEffect: withEffect,
        });
    },
    /**
     * @override
     */
    _updateAddUrlUi: function (emptyValue, isURL, isImage) {
        this._super.apply(this, arguments);
        this.$addUrlButton.text((isURL && !isImage) ? _t("Add as document") : _t("Add image"));
        this.$urlWarning.toggleClass('d-none', !isURL || isImage);
    },
});


/**
 * Let users choose a document, including uploading a new document in odoo.
 */
var DocumentWidget = FileWidget.extend({
    template: 'wysiwyg.widgets.document',

    /**
     * @constructor
     */
    init: function (parent, media, options) {
        options = options || {};
        this._super.apply(this, [parent, media, _.extend({}, options, {
            accept: options.accept || '*/*',
            mimetypeDomain: options.mimetypeDomain || ['mimetype', 'not in',
                ['image/gif', 'image/jpe', 'image/jpeg', 'image/jpg', 'image/gif', 'image/png']
            ],
        })]);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _renderExisting: function (attachments, withEffect) {
        return QWeb.render('wysiwyg.widgets.document.existing.attachments', {
            attachments: attachments,
            withEffect: withEffect,
        });
    },
    /**
     * @override
     */
    _updateAddUrlUi: function (emptyValue, isURL, isImage) {
        this._super.apply(this, arguments);
        this.$addUrlButton.text((isURL && isImage) ? _t("Add as image") : _t("Add document"));
        this.$urlWarning.toggleClass('d-none', !isURL || !isImage);
    },
});

/**
 * Let users choose a font awesome icon, support all font awesome loaded in the
 * css files.
 */
var IconWidget = SearchWidget.extend({
    template: 'wysiwyg.widgets.font-icons',
    events: _.extend({}, SearchWidget.prototype.events || {}, {
        'click .font-icons-icon': '_onIconClick',
        'dblclick .font-icons-icon': '_onIconDblClick',
    }),

    /**
     * @constructor
     */
    init: function (parent, media) {
        this._super.apply(this, arguments);

        fonts.computeFonts();
        this.iconsParser = fonts.fontIcons;
        this.alias = _.flatten(_.map(this.iconsParser, function (data) {
            return data.alias;
        }));
    },
    /**
     * @override
     */
    start: function () {
        this.$icons = this.$('.font-icons-icon');
        var classes = (this.media && this.media.className || '').split(/\s+/);
        for (var i = 0; i < classes.length; i++) {
            var cls = classes[i];
            if (_.contains(this.alias, cls)) {
                this.selectedIcon = cls;
                this._highlightSelectedIcon();
            }
        }
        this.nonIconClasses = _.without(classes, 'media_iframe_video', this.selectedIcon);

        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    save: function () {
        var style = this.$media.attr('style') || '';
        var iconFont = this._getFont(this.selectedIcon) || {base: 'fa', font: ''};
        var finalClasses = _.uniq(this.nonIconClasses.concat([iconFont.base, iconFont.font]));
        if (!this.$media.is('span')) {
            var $span = $('<span/>');
            $span.data(this.$media.data());
            this.$media = $span;
            this.media = this.$media[0];
            style = style.replace(/\s*width:[^;]+/, '');
        }
        this.$media.attr({
            class: _.compact(finalClasses).join(' '),
            style: style || null,
        });
        return this.media;
    },
    /**
     * @override
     */
    search: function (needle) {
        var iconsParser = this.iconsParser;
        if (needle && needle.length) {
            iconsParser = [];
            _.filter(this.iconsParser, function (data) {
                var cssData = _.filter(data.cssData, function (cssData) {
                    return _.find(cssData.names, function (alias) {
                        return alias.indexOf(needle) >= 0;
                    });
                });
                if (cssData.length) {
                    iconsParser.push({
                        base: data.base,
                        cssData: cssData,
                    });
                }
            });
        }
        this.$('div.font-icons-icons').html(
            QWeb.render('wysiwyg.widgets.font-icons.icons', {iconsParser: iconsParser})
        );
        return Promise.resolve();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _clear: function () {
        var allFaClasses = /(^|\s)(fa(\s|$)|fa-[^\s]*)/g;
        this.media.className = this.media.className && this.media.className.replace(allFaClasses, ' ');
    },
    /**
     * @private
     */
    _getFont: function (classNames) {
        if (!(classNames instanceof Array)) {
            classNames = (classNames || "").split(/\s+/);
        }
        var fontIcon, cssData;
        for (var k = 0; k < this.iconsParser.length; k++) {
            fontIcon = this.iconsParser[k];
            for (var s = 0; s < fontIcon.cssData.length; s++) {
                cssData = fontIcon.cssData[s];
                if (_.intersection(classNames, cssData.names).length) {
                    return {
                        base: fontIcon.base,
                        parser: fontIcon.parser,
                        font: cssData.names[0],
                    };
                }
            }
        }
        return null;
    },
    /**
     * @private
     */
    _highlightSelectedIcon: function () {
        var self = this;
        this.$icons.removeClass('o_selected');
        this.$icons.filter(function (i, el) {
            return _.contains($(el).data('alias').split(','), self.selectedIcon);
        }).addClass('o_selected');
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onIconClick: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();

        this.selectedIcon = $(ev.currentTarget).data('id');
        this._highlightSelectedIcon();
    },
    /**
     * @private
     */
    _onIconDblClick: function () {
        this.trigger_up('save_request');
    },
});

/**
 * Let users choose a video, support all summernote video, and embed iframe.
 */
var VideoWidget = MediaWidget.extend({
    template: 'wysiwyg.widgets.video',
    events: _.extend({}, MediaWidget.prototype.events || {}, {
        'change .o_video_dialog_options input': '_onUpdateVideoOption',
        'input textarea#o_video_text': '_onVideoCodeInput',
        'change textarea#o_video_text': '_onVideoCodeChange',
    }),

    /**
     * @constructor
     */
    init: function (parent, media) {
        this._super.apply(this, arguments);
        this._onVideoCodeInput = _.debounce(this._onVideoCodeInput, 1000);
    },
    /**
     * @override
     */
    start: function () {
        this.$content = this.$('.o_video_dialog_iframe');

        if (this.media) {
            var $media = $(this.media);
            var src = $media.data('oe-expression') || $media.data('src') || '';
            this.$('textarea#o_video_text').val(src);

            this.$('input#o_video_autoplay').prop('checked', src.indexOf('autoplay=1') >= 0);
            this.$('input#o_video_hide_controls').prop('checked', src.indexOf('controls=0') >= 0);
            this.$('input#o_video_loop').prop('checked', src.indexOf('loop=1') >= 0);
            this.$('input#o_video_hide_fullscreen').prop('checked', src.indexOf('fs=0') >= 0);
            this.$('input#o_video_hide_yt_logo').prop('checked', src.indexOf('modestbranding=1') >= 0);
            this.$('input#o_video_hide_dm_logo').prop('checked', src.indexOf('ui-logo=0') >= 0);
            this.$('input#o_video_hide_dm_share').prop('checked', src.indexOf('sharing-enable=0') >= 0);

            this._updateVideo();
        }

        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    save: function () {
        this._updateVideo();
        if (this.$('.o_video_dialog_iframe').is('iframe')) {
            this.$media = $(
                '<div class="media_iframe_video" data-oe-expression="' + this.$content.attr('src') + '">' +
                    '<div class="css_editable_mode_display">&nbsp;</div>' +
                    '<div class="media_iframe_video_size" contenteditable="false">&nbsp;</div>' +
                    '<iframe src="' + this.$content.attr('src') + '" frameborder="0" contenteditable="false"></iframe>' +
                '</div>'
            );
            this.media = this.$media[0];
        }
        return this.media;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _clear: function () {
        if (this.media.dataset.src) {
            try {
                delete this.media.dataset.src;
            } catch (e) {
                this.media.dataset.src = undefined;
            }
        }
        var allVideoClasses = /(^|\s)media_iframe_video(\s|$)/g;
        this.media.className = this.media.className && this.media.className.replace(allVideoClasses, ' ');
        this.media.innerHTML = '';
    },
    /**
     * Creates a video node according to the given URL and options. If not
     * possible, returns an error code.
     *
     * @private
     * @param {string} url
     * @param {Object} options
     * @returns {Object}
     *          $video -> the created video jQuery node
     *          type -> the type of the created video
     *          errorCode -> if defined, either '0' for invalid URL or '1' for
     *              unsupported video provider
     */
    _createVideoNode: function (url, options) {
        options = options || {};

        // Video url patterns(youtube, instagram, vimeo, dailymotion, youku, ...)
        var ytRegExp = /^(?:(?:https?:)?\/\/)?(?:www\.)?(?:youtu\.be\/|youtube(-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((?:\w|-){11})(?:\S+)?$/;
        var ytMatch = url.match(ytRegExp);

        var insRegExp = /(.*)instagram.com\/p\/(.[a-zA-Z0-9]*)/;
        var insMatch = url.match(insRegExp);

        var vinRegExp = /\/\/vine.co\/v\/(.[a-zA-Z0-9]*)/;
        var vinMatch = url.match(vinRegExp);

        var vimRegExp = /\/\/(player.)?vimeo.com\/([a-z]*\/)*([0-9]{6,11})[?]?.*/;
        var vimMatch = url.match(vimRegExp);

        var dmRegExp = /.+dailymotion.com\/(video|hub|embed)\/([^_]+)[^#]*(#video=([^_&]+))?/;
        var dmMatch = url.match(dmRegExp);

        var ykuRegExp = /(.*).youku\.com\/(v_show\/id_|embed\/)(.+)/;
        var ykuMatch = url.match(ykuRegExp);

        var $video = $('<iframe>').width(1280).height(720).attr('frameborder', 0).addClass('o_video_dialog_iframe');
        var videoType = 'yt';

        if (!/^(http:\/\/|https:\/\/|\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i.test(url)){
            return {errorCode: 0};
        }

        var autoplay = options.autoplay ? '?autoplay=1' : '?autoplay=0';

        if (ytMatch && ytMatch[2].length === 11) {
            $video.attr('src', '//www.youtube' + (ytMatch[1] || '') + '.com/embed/' + ytMatch[2] + autoplay);
        } else if (insMatch && insMatch[2].length) {
            $video.attr('src', '//www.instagram.com/p/' + insMatch[2] + '/embed/');
            videoType = 'ins';
        } else if (vinMatch && vinMatch[0].length) {
            $video.attr('src', vinMatch[0] + '/embed/simple');
            videoType = 'vin';
        } else if (vimMatch && vimMatch[3].length) {
            $video.attr('src', '//player.vimeo.com/video/' + vimMatch[3] + autoplay);
            videoType = 'vim';
        } else if (dmMatch && dmMatch[2].length) {
            var justId = dmMatch[2].replace('video/', '');
            $video.attr('src', '//www.dailymotion.com/embed/video/' + justId + autoplay);
            videoType = 'dm';
        } else if (ykuMatch && ykuMatch[3].length) {
            var ykuId = ykuMatch[3].indexOf('.html?') >= 0 ? ykuMatch[3].substring(0, ykuMatch[3].indexOf('.html?')) : ykuMatch[3];
            $video.attr('src', '//player.youku.com/embed/' + ykuId);
            videoType = 'yku';
        } else {
            return {errorCode: 1};
        }

        if (ytMatch) {
            $video.attr('src', $video.attr('src') + '&rel=0');
        }
        if (options.loop && (ytMatch || vimMatch)) {
            $video.attr('src', $video.attr('src') + '&loop=1');
        }
        if (options.hide_controls && (ytMatch || dmMatch)) {
            $video.attr('src', $video.attr('src') + '&controls=0');
        }
        if (options.hide_fullscreen && ytMatch) {
            $video.attr('src', $video.attr('src') + '&fs=0');
        }
        if (options.hide_yt_logo && ytMatch) {
            $video.attr('src', $video.attr('src') + '&modestbranding=1');
        }
        if (options.hide_dm_logo && dmMatch) {
            $video.attr('src', $video.attr('src') + '&ui-logo=0');
        }
        if (options.hide_dm_share && dmMatch) {
            $video.attr('src', $video.attr('src') + '&sharing-enable=0');
        }

        return {$video: $video, type: videoType};
    },
    /**
     * Updates the video preview according to video code and enabled options.
     *
     * @private
     */
    _updateVideo: function () {
        // Reset the feedback
        this.$content.empty();
        this.$('#o_video_form_group').removeClass('o_has_error o_has_success').find('.form-control, .custom-select').removeClass('is-invalid is-valid');
        this.$('.o_video_dialog_options div').addClass('d-none');

        // Check video code
        var $textarea = this.$('textarea#o_video_text');
        var code = $textarea.val().trim();
        if (!code) {
            return;
        }

        // Detect if we have an embed code rather than an URL
        var embedMatch = code.match(/(src|href)=["']?([^"']+)?/);
        if (embedMatch && embedMatch[2].length > 0 && embedMatch[2].indexOf('instagram')) {
            embedMatch[1] = embedMatch[2]; // Instagram embed code is different
        }
        var url = embedMatch ? embedMatch[1] : code;

        var query = this._createVideoNode(url, {
            autoplay: this.$('input#o_video_autoplay').is(':checked'),
            hide_controls: this.$('input#o_video_hide_controls').is(':checked'),
            loop: this.$('input#o_video_loop').is(':checked'),
            hide_fullscreen: this.$('input#o_video_hide_fullscreen').is(':checked'),
            hide_yt_logo: this.$('input#o_video_hide_yt_logo').is(':checked'),
            hide_dm_logo: this.$('input#o_video_hide_dm_logo').is(':checked'),
            hide_dm_share: this.$('input#o_video_hide_dm_share').is(':checked'),
        });

        var $optBox = this.$('.o_video_dialog_options');

        // Show / Hide preview elements
        this.$el.find('.o_video_dialog_preview_text, .media_iframe_video_size').add($optBox).toggleClass('d-none', !query.$video);
        // Toggle validation classes
        this.$el.find('#o_video_form_group')
            .toggleClass('o_has_error', !query.$video).find('.form-control, .custom-select').toggleClass('is-invalid', !query.$video)
            .end()
            .toggleClass('o_has_success', !!query.$video).find('.form-control, .custom-select').toggleClass('is-valid', !!query.$video);

        // Individually show / hide options base on the video provider
        $optBox.find('div.o_' + query.type + '_option').removeClass('d-none');

        // Hide the entire options box if no options are available
        $optBox.toggleClass('d-none', $optBox.find('div:not(.d-none)').length === 0);

        if (query.type === 'yt') {
            // Youtube only: If 'hide controls' is checked, hide 'fullscreen'
            // and 'youtube logo' options too
            this.$('input#o_video_hide_fullscreen, input#o_video_hide_yt_logo').closest('div').toggleClass('d-none', this.$('input#o_video_hide_controls').is(':checked'));
        }

        var $content = query.$video;
        if (!$content) {
            switch (query.errorCode) {
                case 0:
                    $content = $('<div/>', {
                        class: 'alert alert-danger o_video_dialog_iframe mb-2 mt-2',
                        text: _t("The provided url is not valid"),
                    });
                    break;
                case 1:
                    $content = $('<div/>', {
                        class: 'alert alert-warning o_video_dialog_iframe mb-2 mt-2',
                        text: _t("The provided url does not reference any supported video"),
                    });
                    break;
            }
        }
        this.$content.replaceWith($content);
        this.$content = $content;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when a video option changes -> Updates the video preview.
     *
     * @private
     */
    _onUpdateVideoOption: function () {
        this._updateVideo();
    },
    /**
     * Called when the video code (URL / Iframe) change is confirmed -> Updates
     * the video preview immediately.
     *
     * @private
     */
    _onVideoCodeChange: function () {
        this._updateVideo();
    },
    /**
     * Called when the video code (URL / Iframe) changes -> Updates the video
     * preview (note: this function is automatically debounced).
     *
     * @private
     */
    _onVideoCodeInput: function () {
        this._updateVideo();
    },
});

return {
    MediaWidget: MediaWidget,
    SearchWidget: SearchWidget,
    FileWidget: FileWidget,
    ImageWidget: ImageWidget,
    DocumentWidget: DocumentWidget,
    IconWidget: IconWidget,
    VideoWidget: VideoWidget,
};
});
