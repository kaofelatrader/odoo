odoo.define('stock.InventoryValidationController', function (require) {
"use strict";

var core = require('web.core');
var ListController = require('web.ListController');

var _t = core._t;
var qweb = core.qweb;

var InventoryValidationController = ListController.extend({

    /**
     * @override
     */
    init: function (parent, model, renderer, params) {
        var context = renderer.state.getContext();
        this.inventory_id = context.active_id;
        return this._super.apply(this, arguments);
    },

    // -------------------------------------------------------------------------
    // Public
    // -------------------------------------------------------------------------

    /**
     * @override
     */
    renderButtons: function ($node) {
        this._super.apply(this, arguments);
        var $validationButton = $(qweb.render('InventoryLines.Buttons'));
        $validationButton.on('click', this._onValidateInventory.bind(this));
        $validationButton.appendTo($node.find('.o_list_buttons'));
    },

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    /**
     * Handler called when user click on validation button in inventory lines
     * view. Makes an rpc to try to validate the inventory, then will go back on
     * the inventory view form if it was validated.
     * This method could also open a wizard in case something was missing.
     *
     * @private
     */
    _onValidateInventory: function () {
        var self = this;
        this._rpc({
            model: 'stock.inventory.line',
            method: 'action_validate_inventory',
            args: [this.inventory_id]
        }).then(function (res) {
            var exitCallback = function (infos) {
                // In case we discarded a wizard, we do nothing to stay on
                // the same view...
                if (infos === 'special') {
                    return;
                }
                // ... but in any other cases, we go back on the inventory form.
                self.do_notify(
                    _t("Success"),
                    _t("The inventory has been validated"));
                self.do_action({
                    type: 'ir.actions.act_window',
                    res_model: 'stock.inventory',
                    res_id: self.inventory_id,
                    views: [[false, 'form']],
                    target: 'main'
                });
            };

            if (_.isObject(res)) {
                self.do_action(res, { on_close: exitCallback });
            } else {
                return exitCallback();
            }
        });
    },
});

return InventoryValidationController;

});
