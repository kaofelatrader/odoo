odoo.define('web_mobile.relational_fields', function (require) {
"use strict";

var config = require('web.config');
var relational_fields = require('web.relational_fields');


if (!config.device.isMobile) {
    return;
}

/**
 * Override the Many2One to prevent autocomplete and open kanban view in mobile for search.
 */

relational_fields.FieldMany2One.include({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Don't bind autocomplete in the mobile as it uses a different mechanism
     * On clicking Many2One will directly open popup with kanban view
     *
     * @private
     * @override
     */
    _bindAutoComplete: function () {},

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * We always open Many2One search dialog for select/update field value on click of Many2One element
     *
     * @override
     * @private
     */
    _onInputClick: function () {
        return this._searchCreatePopup("search");
    },
});

});
