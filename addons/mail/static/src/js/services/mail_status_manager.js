odoo.define('mail.Manager.Status', function (require) {
"use strict";

/**
 * Mail Status Manager
 */

var core = require('web.core');
var MailManager = require('mail.Manager');
var QWeb = core.qweb;

MailManager.include({
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------
    /**
    * Returns the uin cache im status, and triggers an asynchronous throttled update of im_status cache for missings
    * @param {integer[]} ids
    * @return {String}
    */
    getImStatus: function (id) {
        var self = this;
        if (!this._imStatusDict[id]) {
            // Add to list to call it in next bus update or fetchMissingImStatus
            this._imStatusDict[id] = undefined;
            // fetch after some time if no other getImStatus occurs
            clearTimeout(this.fetchStatusTimeout);
            this.fetchStatusTimeout = setTimeout(function () {
                self.fetchMissingImStatus();
            },500);
        }
        return this._imStatusDict[id];
    },
    /**
    * Fetch the list of im_status for partner with an unknow im_status and triggers un update.
    * @return {Deferred}
    */
    fetchMissingImStatus: function () {
        var missing = [];
        _.each(this._imStatusDict, function (value, key) {
            if (value === undefined) {
                missing.push(Number(key));
            }
        });
        return this.fetchImStatus(missing);
    },
    /**
    * Fetch the list of im_status for partner with id in ids list and triggers un update.
    * @param {integer[]} ids
    * @return {Deferred}
    */
    fetchImStatus: function (ids) {
        var self = this;
        if (_.isEmpty(ids)) {
            return $.when();
        }
        return this._rpc({
            model: 'res.partner',
            method: 'read',
            args: [ids, ['id', 'im_status']],
        }).then( function (results) {
            self.updateImStatus(results);
        });
    },
    /**
     * Update status manually, to avoid to do a rpc and an asynchronous update after getImStatus.
     * Can be done by any caller knowing the last im_status state.
     * @param {Object[]} statusList, A list of {id, im_status}
     */
    updateImStatus: function (statusList) {
        var updatedIds = [];
        var self = this;
        _.each(statusList, function (status) {
            if (self._imStatusDict[status.id] === status.im_status) {
                return;
            }
            updatedIds.push(status.id);
            self._imStatusDict[status.id] = status.im_status;
        });
        if (! _.isEmpty(updatedIds)) {
            this._mailBus.trigger('update_im_status', updatedIds); // usefull for thread window header
            this._renderImStatus(updatedIds);
        }
    },
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    /**
     * @private
     * @return {integer[]} a list of partner ids that needs update
     */
    _getImStatusToUpdate: function () {
        var toUpdate = [];
        _.each(this._imStatusDict,function (status, key) {
            //filter on im_partner and bot: useless to update them, status won't change
            if (['im_partner', 'bot'].indexOf(status) === -1) {
                toUpdate.push(Number(key));
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
        this._imStatusDict = {};
        this.fetchStatusTimeout = undefined;
        this._updateLoop();
        this.isTabFocused = true;
        this._updateInterval = 50;
    },
    /**
     * @private
     * @override
     */
    _listenOnBuses: function () {
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
                    status: self.getImStatus(id),
                    partnerID: id,
                });
                $(this).replaceWith(status);
            }
        });
    },
    /**
    * Once initialised, this loop will update the im_status of registered users.
    * @private
    * @param {integer} counter, The recurtion loop counter, should be called at 0 or undefined.
    */
    _updateLoop: function (counter) {
        if (counter === undefined) {
            counter = 0;
        }
        var self = this;
        setTimeout(function () {
            //should we do some gc here?
            //unaccessed partner for some time could be removed?
            //(after checking in dom that no o_updatable_im_status is still displayed)
            if (counter >= self._updateInterval && self.isTabFocused) {
                self.fetchImStatus(self._getImStatusToUpdate());
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
        this.isTabFocused = focused;
    },
});

return MailManager;

});
