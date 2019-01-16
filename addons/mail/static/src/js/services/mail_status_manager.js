odoo.define('mail.Manager.Status', function (require) {
"use strict";

var core = require('web.core');
var MailManager = require('mail.Manager');
var QWeb = core.qweb;

/**
 * Mail Manager: IM Status
 *
 * This component handles im status of partners, which is useful for DM Chats,
 * partner mention suggestions, and chatter messages that display the user icon.
 */
MailManager.include({
    _UPDATE_INTERVAL: 50,

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Returns the uin cache im status, and triggers an asynchronous throttled
     * update of im_status cache for missings
     *
     * @param {Object} data
     * @param {integer} data.partnerID
     * @return {String}
     */
    getImStatus: function (data) {
        var partnerID = data.partnerID;
        var self = this;
        if (!this._imStatus[partnerID]) {
            // Add to list to call it in next bus update or _fetchMissingImStatus
            this._imStatus[partnerID] = undefined;
            // fetch after some time if no other getImStatus occurs
            clearTimeout(this._fetchStatusTimeout);
            this._fetchStatusTimeout = setTimeout(function () {
                self._fetchMissingImStatus();
            }, 500);
        }
        return this._imStatus[partnerID];
    },
    /**
     * Update status manually, to avoid to do a rpc and an asynchronous update
     * after getImStatus. Can be done by any caller knowing the last im_status
     * state.
     *
     * @param {Object[]} statusList, A list of {id, im_status}
     */
    updateImStatus: function (statusList) {
        var updatedIDs = [];
        var self = this;
        _.each(statusList, function (status) {
            if (self._imStatus[status.id] === status.im_status) {
                return;
            }
            updatedIDs.push(status.id);
            self._imStatus[status.id] = status.im_status;
        });
        if (! _.isEmpty(updatedIDs)) {
            this._mailBus.trigger('updated_im_status', updatedIDs); // useful for thread window header
            this._renderImStatus(updatedIDs);
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Fetch the list of im_status for partner with id in ids list and triggers
     * an update.
     *
     * @private
     * @param {Object} data
     * @param {integer[]} data.partnerIDs
     * @return {Deferred}
     */
    _fetchImStatus: function (data) {
        var self = this;
        var partnerIDs = data.partnerIDs;
        if (_.isEmpty(partnerIDs)) {
            return $.when();
        }
        return this._rpc({
            model: 'res.partner',
            method: 'read',
            args: [partnerIDs, ['id', 'im_status']],
        }).then( function (results) {
            self.updateImStatus(results);
        });
    },
    /**
     * Fetch the list of im_status for partner with an unknown im_status and
     * triggers an update.
     *
     * @private
     * @return {Deferred}
     */
    _fetchMissingImStatus: function () {
        var missing = [];
        _.each(this._imStatus, function (value, key) {
            if (value === undefined) {
                missing.push(key);
            }
        });
        return this._fetchImStatus(missing);
    },
    /**
     * @private
     * @return {integer[]} a list of partner ids that needs update
     */
    _getImStatusToUpdate: function () {
        var toUpdate = [];
        _.each(this._imStatus,function (status, key) {
            //filter on im_partner and bot: useless to update them, status won't change
            if (['im_partner', 'bot'].indexOf(status) === -1) {
                toUpdate.push(key);
            }
        });
        return toUpdate;
    },
    /**
     * @private
     * @override
     */
    _initializeInternalState: function () {
        this._super.apply(this, arguments);
        this._fetchStatusTimeout = undefined;
        this._imStatus = {};
        this._isTabFocused = true;
        this._updateLoop();
    },
    /**
     * @private
     * @override
     */
    _listenOnBuses: function () {
        this._super.apply(this, arguments);
        $(window).on("focus", this._onFocusChange.bind(this, true));
        $(window).on("blur", this._onFocusChange.bind(this, false));
        $(window).on("unload", this._onFocusChange.bind(this, false));
    },
    /**
     * @private
     * @param {boolean} updatedIds
     */
    _renderImStatus: function (updatedIds) {
        var self = this;
        $('.o_updatable_im_status').each(function () {
            var id = $(this).data('partner-id');
            if (id !== undefined && updatedIds.indexOf(id) !== -1) { // todo instead add id on o_updatable_im_status and select only concerned ones
                var status = QWeb.render('mail.UserStatus', {
                    status: self.getImStatus({ partnerID: id }),
                    partnerID: id,
                });
                $(this).replaceWith(status);
            }
        });
    },
    /**
     * Once initialised, this loop will update the im_status of registered
     * users.
     *
     * @private
     * @param {integer} [counter=0] The recursion loop counter
     */
    _updateLoop: function (counter) {
        if (!_.isNumber(counter)) {
            counter = 0;
        }
        var self = this;
        setTimeout(function () {
            if (counter >= self._UPDATE_INTERVAL && self._isTabFocused) {
                self._fetchImStatus(self._getImStatusToUpdate());
                counter = 0;
            }
            self._updateLoop(counter+1);
        }, 1000);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {boolean} focused
     */
    _onFocusChange: function (focused) {
        this._isTabFocused = focused;
    },
});

});
