odoo.define('web_mobile.relational_fields', function (require) {
"use strict";

var config = require('web.config');
var relational_fields = require('web.relational_fields');


if (!config.device.isMobile) {
    return;
}

/**
 * Override the Many2One to open a dialog in mobile.
 */

relational_fields.FieldMany2One.include({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Don't bind autocomplete in the mobile app as it uses a different mechanism
     * see @_invokeMobileDialog
     *
     * @private
     * @override
     */
    _bindAutoComplete: function () {},

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * We always open ManyToOne native dialog for select/update field value
     *
     * @override
     * @private
     */
    _onInputClick: function () {
        return this._searchCreatePopup("search");
    },
});

});
