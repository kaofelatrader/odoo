odoo.define('website_mass_mailing.editor', function (require) {
'use strict';

var core = require('web.core');
var rpc = require('web.rpc');
var WysiwygMultizone = require('web_editor.wysiwyg.multizone');
var options = require('web_editor.snippets.options');
var wUtils = require('website.utils');
var _t = core._t;


var mass_mailing_common = options.Class.extend({
    popup_template_id: "editor_new_mailing_list_subscribe_button",
    popup_title: _t("Add a Newsletter Subscribe Button"),
    select_mailing_list: function (previewMode, value) {
        var self = this;
        var def = wUtils.prompt({
            'id': this.popup_template_id,
            'window_title': this.popup_title,
            'select': _t("Newsletter"),
            'init': function (field) {
                return rpc.query({
                        model: 'mail.mass_mailing.list',
                        method: 'name_search',
                        args: ['', [['is_public', '=', true]]],
                        context: self.options.recordInfo.context,
                    }).then(function (data) {
                    if (!data.length) {
                        self.$dialog.find('.btn-primary').prop('disabled', true);
                    }
                    return data;
                });
            },
        });
        def.then(function (result) {
            self.$target.attr("data-list-id", result.val);
        });
        return def;
    },
    onBuilt: function () {
        var self = this;
        this._super();
        this.select_mailing_list('click').guardedCatch(function () {
            self.getParent()._onRemoveClick($.Event( "click" ));
        });
    },
});

options.registry.mailing_list_subscribe = mass_mailing_common.extend({
    cleanForSave: function () {
        this.$target.addClass('d-none');
    },
});

options.registry.newsletter_popup = mass_mailing_common.extend({
    popup_template_id: "editor_new_mailing_list_subscribe_popup",
    popup_title: _t("Add a Newsletter Subscribe Popup"),
    /**
     * @override
     */
    start: function () {
        var self = this;

        this.$target.on('shown.bs.modal', function () {
            self.trigger_up('deactivate_snippet');
        });
        return this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    cleanForSave: function () {
        this.$('.o_newsletter_modal').modal('hide');
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    select_mailing_list: function (previewMode, value) {
        var self = this;
        return this._super(previewMode, value).then(function () {
            self.$target.attr('quick-open', true);
            self._refreshPublicWidgets();
        });
    },
});

WysiwygMultizone.include({
    _saveEditable: function (editable) {
        var self = this;
        var $editable = $(editable);
        var $modal = $editable.find('.o_newsletter_modal');
        var defs = [];
        if ($modal) {
            _.each($modal, function (modal) {
                var $popup = $(modal);
                $popup.find('.o_subscribe_mailing_input').remove();
                var content = $popup.find('.modal-body').html();
                var newsletterID = $popup.closest('.o_newsletter_popup').attr('data-list-id');
                $popup.remove();
                defs.push(self._rpc({
                    route: '/website_mass_mailing/set_content',
                    params: {
                        'newsletter_id': parseInt(newsletterID),
                        'content': content,
                    },
                }));
            });
        }
        defs.push(this._super.apply(this, arguments));
        return Promise.all(defs);
    },
});
});
