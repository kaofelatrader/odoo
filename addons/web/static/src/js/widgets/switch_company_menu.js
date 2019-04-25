odoo.define('web.SwitchCompanyMenu', function(require) {
"use strict";

/**
 * When Odoo is configured in multi-company mode, users should obviously be able
 * to switch their interface from one company to the other.  This is the purpose
 * of this widget, by displaying a dropdown menu in the systray.
 */

var config = require('web.config');
var core = require('web.core');
var session = require('web.session');
var SystrayMenu = require('web.SystrayMenu');
var Widget = require('web.Widget');

var _t = core._t;

var SwitchCompanyMenu = Widget.extend({
    template: 'SwitchCompanyMenu',
    events: {
        'click .dropdown-item[data-menu] .fa-sign-in': '_onSwitchCompanyClick',
        'click .dropdown-item[data-menu] span.company_label': '_onSwitchCompanyClick',
        'click .dropdown-item[data-menu] .company-check': '_onToggleCompanyClick',
        "mouseenter span[data-menu='company']": '_onDropdownCompanyHover', 
        "mouseleave span[data-menu='company']": '_onDropdownCompanyHover', 
    },
    /**
     * @override
     */
    init: function () {
        var self = this;
        this._super.apply(this, arguments);
        this.isMobile = config.device.isMobile;
        this._onSwitchCompanyClick = _.debounce(this._onSwitchCompanyClick, 1500, true);
        this.allowed_company_ids = String(session.user_context.allowed_company_ids).split(',');
        this.user_companies = session.user_companies.allowed_companies;

        var hash = $.bbq.getState()
        if (!hash.cids || hash.cids === undefined) {
            hash.cids = String(session.user_companies.current_company[0]);
        }
        this.current_company = parseInt(hash.cids.split(',')[0]);
        this.current_company_name = _.find(session.user_companies.allowed_companies, function (company) {
            return company[0] === self.current_company;
        })[1];
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onSwitchCompanyClick: function (ev) {
        ev.preventDefault();
        var companyID = $(ev.currentTarget).parent().data('company-id');
        var hash = $.bbq.getState()
        var allowed_company_ids = _.map(hash.cids.split(','), function(company_id) {return parseInt(company_id);});
        if ($($(ev.currentTarget).parent()).find('.fa-plus').length) {
            allowed_company_ids.push(companyID);
        }
        session.setCompanies(companyID, [companyID]);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onToggleCompanyClick: function (ev) {
        var companyID = $(ev.currentTarget).parent().parent().data('company-id');
        var hash = $.bbq.getState()
        var allowed_company_ids = _.map(hash.cids.split(','), function(company_id) {return parseInt(company_id);});
        var current_company_id = allowed_company_ids[0];
        if ($(ev.currentTarget).hasClass('fa-plus')) {
            allowed_company_ids.push(companyID);
        } else {
            allowed_company_ids.splice(allowed_company_ids.indexOf(companyID), 1);
        }
        session.setCompanies(current_company_id, allowed_company_ids);
    },

    _onDropdownCompanyHover: function (ev) {
        var dropdownItem = $(ev.currentTarget)
        if (ev.type === 'mouseenter') {
            dropdownItem.find('i.fa-sign-in').removeClass('invisible');
            dropdownItem.find('i.fa-plus').removeClass('invisible');
            if (dropdownItem.find('i.fa-check-square')) {
                dropdownItem.find('i.fa-check-square').removeClass('fa-check-square').addClass('fa-minus');
            } else {
                dropdownItem.find('i.company-check').removeClass('invisible');
            }
        } else {
            dropdownItem.find('i.fa-sign-in').addClass('invisible');
            dropdownItem.find('i.fa-plus').addClass('invisible');
            if (dropdownItem.find('i.fa-minus')) {
                dropdownItem.find('i.fa-minus').removeClass('fa-minus').addClass('fa-check-square');
            } else {
                dropdownItem.find('i.company-check').addClass('invisible');
            }
        }
    },

});
if (session.display_switch_company_menu) {
    SystrayMenu.Items.push(SwitchCompanyMenu);
}
return SwitchCompanyMenu;

});
