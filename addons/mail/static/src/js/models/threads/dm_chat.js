odoo.define('mail.model.DMChat', function (require) {
"use strict";

var core = require('web.core');
var TwoUserChannel = require('mail.model.TwoUserChannel');
var _t = core._t;

/**
 * Any piece of code in JS that make use of DMs must ideally interact with
 * such objects, instead of direct data from the server.
 */
var DMChat = TwoUserChannel.extend({
    /**
     * @override
     * @param {Object} params
     * @param {Object} params.data
     * @param {string|undefined} [params.custom_channel_name] if set, use this
     *   custom name for this DM
     * @param {Object[]} params.data.direct_partner
     * @param {integer} params.data.direct_partner[0].id
     * @param {string} params.data.direct_partner[0].im_status
     * @param {string} params.data.direct_partner[0].name
     * @param {string} [params.data.direct_partner[0].out_of_office_message='']
     * @param {string} [params.data.direct_partner[0].out_of_office_date_end='']
     */
    init: function (params) {
        this._super.apply(this, arguments);

        var data = params.data;

        this._directPartnerID = data.direct_partner[0].id;
        this._name = data.custom_channel_name || data.direct_partner[0].name;
        this.call('mail_service', 'updateImStatus', [{
            id: this._directPartnerID,
            im_status: data.direct_partner[0].im_status
        }]);
        this._outOfOfficeMessage = data.direct_partner[0].out_of_office_message || '';
        this._outOfOfficeDateEnd = data.direct_partner[0].out_of_office_date_end || '';
        this._type = 'dm_chat';
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Get the direct partner ID linked to the DM, i.e. the partner ID of the
     * user at the other end of the DM conversation. All DM chats do have a
     * direct partner iD.
     *
     * @returns {integer}
     */
    getDirectPartnerID: function () {
        return this._directPartnerID;
    },
    /**
    * Get the out of office info
    *
    * @returns {string}
    */
    getOutOfOfficeInfo: function () {
        if (this.getStatus().indexOf('leave') === -1) {
            return undefined;
        }
        var date = moment(this._outOfOfficeDateEnd);
        var formated_date = date.format('ll');
        if (moment().format('ll') === formated_date) {
            formated_date = date.format("HH:mm");
        } else {
            var current_year = (new Date()).getFullYear();
            if (formated_date.endsWith(current_year)) { // Dummy logic to remove year (only if current year), we will maybe need to improve it
                formated_date = formated_date.slice(0, -4);
                formated_date = formated_date.replace(/( |,)*$/g, "");
            }
        }
        return _.str.sprintf(_t("Out of office until %s"), formated_date);
    },
    /**
    * Get the out of office message of the thread
    *
    * @returns {string}
    */
   getOutOfOfficeMessage: function () {
        if (this._outOfOfficeMessage === '') {
            return undefined;
        }
        return this._outOfOfficeMessage;
    },
    /**
     * @override
     */
    getPreview: function () {
        var result = this._super.apply(this, arguments);
        result.imageSRC = '/web/image/res.partner/' + this.getDirectPartnerID() + '/image_small';
        return result;
    },
    /**
     * @override
     * return {string}
     */
    getStatus: function () {
        return this.call('mail_service', 'getImStatus', this._directPartnerID);
    },
});

return DMChat;

});
