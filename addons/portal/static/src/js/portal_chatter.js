odoo.define('portal.chatter', function (require) {
'use strict';

var core = require('web.core');
var publicWidget = require('web.public.widget');
var session = require('web.session');
var time = require('web.time');

var qweb = core.qweb;
var _t = core._t;

/**
 * Widget PortalComposer
 *
 * Display the composer (according to access right)
 *
 */
var PortalComposer = publicWidget.Widget.extend({
    template: 'portal.Composer',
    xmlDependencies: ['/portal/static/src/xml/portal_chatter.xml'],
    events: {
        'click .o_portal_chatter_composer_btn': 'async _onSubmitButtonClick',
        'change input[type=file]': '_onAttachmentChange',
        'click .o_attachment_delete': '_onAttachmentDelete',
        'click .o_portal_chatter_attachment_btn': '_onClickFilePicker',
    },

    /**
     * @constructor
     */
    init: function (parent, options) {
        this._super.apply(this, arguments);
        this.options = _.defaults(options || {}, {
            'allow_composer': true,
            'display_composer': false,
            'csrf_token': odoo.csrf_token,
            'token': false,
            'res_model': false,
            'res_id': false,
        });
        this.set('attachmentIDs', []);
        this.fileuploadID = _.uniqueId('o_chat_fileupload');
    },
    /**
     * @override
     */
    start: function () {
        //portal chatter
        this.$attachmentButton = this.$('.o_portal_chatter_attachment_btn');
        this.$composerSendButton = this.$(".o_portal_chatter_composer_btn");
        $(window).on(this.fileuploadID, this._onAttachmentLoaded.bind(this));
        this.on("change:attachmentIDs", this, this._renderAttachments);

        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onSubmitButtonClick: function () {
        return new Promise(function() {});
    },
     /**
     * @private
     */
    _renderAttachments: function () {
        this.$('.o_portal_chatter_attachment').html(qweb.render('portal.Chatter.Attachments', {attachment_ids: this.get('attachmentIDs')}));
    },
    /**
     * @private
     */
    _onAttachmentChange: function (ev) {
        var files = ev.target.files,
            attachments = this.get('attachmentIDs');

        if (attachments.length + files.length > 10) {
            this.display_alert(_t("Oops! You can not upload more than 10 files."));
        }
        else if (!_.isEmpty(_.filter(files, function (file) { 
                return (file.size / 1024 / 1024) > 25;
            } ))) {
            this.display_alert(_t("Oops! You can not upload a file larger than 25MB."));
        }
        else {
            _.each(files, function (file) {
                var duplicateAttachment = _.findWhere(attachments, {name: file.name});
                if (duplicateAttachment) {
                    attachments = _.without(attachments, duplicateAttachment);
                }
            });
            this.$('form.o_form_binary_form').submit();
            this.$attachmentButton.prop('disabled', true);
            this.$composerSendButton.prop('disabled', true);
            var uploadAttachments = _.map(files, function (file) {
                return {
                    'id': 0,
                    'name': file.name,
                    'filename': file.name,
                    'url': '',
                    'upload': true,
                    'mimetype': '',
                };
            });
            attachments = attachments.concat(uploadAttachments);
            this.set('attachmentIDs', attachments);
            this.$('.o_portal_chatter_warning').remove();
        }
    },
    /**
     * @private
     */
    _onAttachmentDelete: function (ev) {
        ev.stopPropagation();
        var attachmentID = $(ev.currentTarget).data("id");

        if (attachmentID) {
            var attachments = this.get('attachmentIDs');
            this._rpc({
                model: 'ir.attachment',
                method: 'unlink',
                args: [attachmentID],
            });
            attachments = _.reject(attachments, {'id': attachmentID});
            this.set('attachmentIDs', attachments);
            document.getElementById('attachment_ids').setAttribute("value", _.pluck(attachments, 'id'));
            this.$('.o_portal_chatter_warning').remove();
            this.$('input.o_input_file').val('');
        }
    },
    /**
     * @private
     */
    _onAttachmentLoaded: function (ev) {
        var attachments = this.get('attachmentIDs'),
            files = Array.prototype.slice.call(arguments, 1);

        _.each(files, function (file) {
            if (file.error || !file.id) {
                this.display_alert(file.error);
                attachments = _.filter(attachments, function (attachment) { 
                    return !attachment.upload;
                });
            } else {
                var attachment = _.findWhere(attachments, {filename: file.filename, upload: true});
                if (attachment) {
                    attachments = _.without(attachments, attachment);
                    attachments.push({
                        'id': file.id,
                        'name': file.name || file.filename,
                        'filename': file.filename,
                        'mimetype': file.mimetype,
                        'url': session.url('/web/content', {'id': file.id, download: true}),
                    });
                }
            }
        }.bind(this));

        this.set('attachmentIDs', attachments);
        document.getElementById('attachment_ids').setAttribute("value", _.pluck(attachments, 'id'));
        this.$attachmentButton.prop('disabled', false);
        this.$composerSendButton.prop('disabled', false);
    },
    /**
     * @private
     * @param {MouseEvent} event
     */
    _onClickFilePicker: function (ev) {
        var filePicker = this.$('input[type=file]');
        if (this.get('attachmentIDs').length >= 10) {
            this.display_alert(_t("Oops! You can not upload more than 10 files."));
            return;
        }
        if (!_.isEmpty(filePicker)) {
            filePicker[0].click();
        }
    },
    /**
     * Display error message on file upload
     *
     * @param {string<message>}
     */
    display_alert: function (message) {
        this.$('.o_portal_chatter_warning').remove();
        $('<div>', {
            class: 'alert alert-warning o_portal_chatter_warning',
            text: message,
        }).insertBefore(this.$('.o_portal_chatter_attachment'));
    },
});



/**
 * Widget PortalChatter
 *
 * - Fetch message fron controller
 * - Display chatter: pager, total message, composer (according to access right)
 * - Provider API to filter displayed messages
 */
var PortalChatter = publicWidget.Widget.extend({
    template: 'portal.Chatter',
    xmlDependencies: ['/portal/static/src/xml/portal_chatter.xml', '/mail/static/src/xml/attachment.xml'],
    events: {
        "click .o_portal_chatter_pager_btn": '_onClickPager',
    },

    /**
     * @constructor
     */
    init: function (parent, options) {
        var self = this;
        this.options = {};
        this._super.apply(this, arguments);

        // underscorize the camelcased option keys
        _.each(options, function (val, key) {
            self.options[_.str.underscored(key)] = val;
        });
        // set default options
        this.options = _.defaults(this.options, {
            'allow_composer': true,
            'display_composer': false,
            'csrf_token': odoo.csrf_token,
            'message_count': 0,
            'pager_step': 10,
            'pager_scope': 5,
            'pager_start': 1,
            'is_user_public': true,
            'is_user_publisher': false,
            'hash': false,
            'pid': false,
            'domain': [],
        });

        this.set('messages', []);
        this.set('message_count', this.options['message_count']);
        this.set('pager', {});
        this.set('domain', this.options['domain']);
        this._currentPage = this.options['pager_start'];
    },
    /**
     * @override
     */
    willStart: function () {
        return Promise.all([
            this._super.apply(this, arguments),
            this._chatterInit()
        ]);
    },
    /**
     * @override
     */
    start: function () {
        // bind events
        this.on("change:messages", this, this._renderMessages);
        this.on("change:message_count", this, function () {
            this._renderMessageCount();
            this.set('pager', this._pager(this._currentPage));
        });
        this.on("change:pager", this, this._renderPager);
        this.on("change:domain", this, this._onChangeDomain);
        // set options and parameters
        this.set('message_count', this.options['message_count']);
        this.set('messages', this.preprocessMessages(this.result['messages']));


        var defs = [];
        defs.push(this._super.apply(this, arguments));

        // instanciate and insert composer widget
        if (this.options['display_composer']) {
            this._composer = new PortalComposer(this, this.options);
            defs.push(this._composer.replace(this.$('.o_portal_chatter_composer')));
        }

        return Promise.all(defs);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Fetch the messages and the message count from the server for the
     * current page and current domain.
     *
     * @param {Array} domain
     * @returns {Promise}
     */
    messageFetch: function (domain) {
        var self = this;
        return this._rpc({
            route: '/mail/chatter_fetch',
            params: self._messageFetchPrepareParams(),
        }).then(function (result) {
            self.set('messages', self.preprocessMessages(result['messages']));
            self.set('message_count', result['message_count']);
        });
    },
    /**
     * Update the messages format
     *
     * @param {Array<Object>}
     * @returns {Array}
     */
    preprocessMessages: function (messages) {
        _.each(messages, function (m) {
            m['author_avatar_url'] = _.str.sprintf('/web/image/%s/%s/author_avatar/50x50', 'mail.message', m.id);
            m['published_date_str'] = _.str.sprintf(_t('Published on %s'), moment(time.str_to_datetime(m.date)).format('MMMM Do YYYY, h:mm:ss a'));
        });
        return messages;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @returns {Deferred}
     */
    _chatterInit: function () {
        var self = this;
        return this._rpc({
            route: '/mail/chatter_init',
            params: this._messageFetchPrepareParams()
        }).then(function (result) {
            self.result = result;
            self.options = _.extend(self.options, self.result['options'] || {});
            return result;
        });
    },
    /**
     * Change the current page by refreshing current domain
     *
     * @private
     * @param {Number} page
     * @param {Array} domain
     */
    _changeCurrentPage: function (page, domain) {
        this._currentPage = page;
        var d = domain ? domain : _.clone(this.get('domain'));
        this.set('domain', d); // trigger fetch message
    },
    _messageFetchPrepareParams: function () {
        var self = this;
        var data = {
            'res_model': this.options['res_model'],
            'res_id': this.options['res_id'],
            'limit': this.options['pager_step'],
            'offset': (this._currentPage - 1) * this.options['pager_step'],
            'allow_composer': this.options['allow_composer'],
        };
        // add token field to allow to post comment without being logged
        if (self.options['token']) {
            data['token'] = self.options['token'];
        }
        // add domain
        if (this.get('domain')) {
            data['domain'] = this.get('domain');
        }
        return data;
    },
    /**
     * Generate the pager data for the given page number
     *
     * @private
     * @param {Number} page
     * @returns {Object}
     */
    _pager: function (page) {
        page = page || 1;
        var total = this.get('message_count');
        var scope = this.options['pager_scope'];
        var step = this.options['pager_step'];

        // Compute Pager
        var pageCount = Math.ceil(parseFloat(total) / step);

        page = Math.max(1, Math.min(parseInt(page), pageCount));
        scope -= 1;

        var pmin = Math.max(page - parseInt(Math.floor(scope / 2)), 1);
        var pmax = Math.min(pmin + scope, pageCount);

        if (pmax - scope > 0) {
            pmin = pmax - scope;
        } else {
            pmin = 1;
        }

        var pages = [];
        _.each(_.range(pmin, pmax + 1), function (index) {
            pages.push(index);
        });

        return {
            "page_count": pageCount,
            "offset": (page - 1) * step,
            "page": page,
            "page_start": pmin,
            "page_previous": Math.max(pmin, page - 1),
            "page_next": Math.min(pmax, page + 1),
            "page_end": pmax,
            "pages": pages
        };
    },
    _renderMessages: function () {
        this.$('.o_portal_chatter_messages').html(qweb.render("portal.chatter_messages", {widget: this}));
    },
    _renderMessageCount: function () {
        this.$('.o_message_counter').replaceWith(qweb.render("portal.chatter_message_count", {widget: this}));
    },
    _renderPager: function () {
        this.$('.o_portal_chatter_pager').replaceWith(qweb.render("portal.pager", {widget: this}));
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onChangeDomain: function () {
        var self = this;
        this.messageFetch().then(function () {
            var p = self._currentPage;
            self.set('pager', self._pager(p));
        });
    },
    /**
     * @private
     * @param {MouseEvent} event
     */
    _onClickPager: function (ev) {
        ev.preventDefault();
        var page = $(ev.currentTarget).data('page');
        this._changeCurrentPage(page);
    },
});

publicWidget.registry.portalChatter = publicWidget.Widget.extend({
    selector: '.o_portal_chatter',

    /**
     * @override
     */
    start: function () {
        var defs = [this._super.apply(this, arguments)];
        var chatter = new PortalChatter(this, this.$el.data());
        defs.push(chatter.appendTo(this.$el));
        return Promise.all(defs);
    },
});

return {
    PortalComposer: PortalComposer,
    PortalChatter: PortalChatter,
};
});
