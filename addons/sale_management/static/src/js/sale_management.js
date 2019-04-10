odoo.define('sale_management.sale_management', function (require) {
'use strict';

var SalePortalSidebar = require('sale.SalePortalSidebar');

SalePortalSidebar.include({
    events: {
        'click a.js_update_line_json': '_onClick',
        'click a.js_add_optional_products': '_onClickOptionalProduct'
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * trigger when update the quantity of optional products.
     *
     * @private
     * @param {Event} ev
     */
    _onClick: function (ev) {
        ev.preventDefault();
        var self = this;
        var $input = $(ev.currentTarget);
        var params = {
            line_id: parseInt($input.data('line-id')),
            remove: $input.data('remove'),
            unlink: $input.data('unlink'),
            order_id: $input.data('order-id'),
        };
        var token = $input.data('token');
        if (token) {
            params['access_token'] = token;
        }
        this._rpc({
            route: "/my/orders/update_line",
            params: params
        }).then(function (data) {
            if (data) {
                var $template = $(data['sale_template']);
                self.$('#portal_sale_content').empty();
                self.$('#portal_sale_content').append($template);
                self.$('.o_portal_sale_total_amount span').text(data['total_amount']);
                self.$('#o_portal_sale_sidebar_nav').empty();
                self._generateMenu();
            }
        });
    },

    /**
     * trigger when optional product added to order from portal.
     *
     * @private
     * @param {Event} ev
     */
    _onClickOptionalProduct: function (ev) {
        ev.preventDefault();
        var self = this;
        var $input = $(ev.currentTarget);
        var params = {
            order_id: $input.data('order-id'),
            option_id: $input.data('option-id'),
        };
        var token = $input.data('token');
        if (token) {
            params['access_token'] = token;
        }
        this._rpc({
            route: "/my/orders/add_option",
            params: params
        }).then(function (data) {
            if (data) {
                var $template = $(data['sale_template']);
                self.$('#portal_sale_content').empty();
                self.$('#portal_sale_content').append($template);
                self.$('.o_portal_sale_total_amount span').text(data['total_amount']);
                self.$('#o_portal_sale_sidebar_nav').empty();
                self._generateMenu();
            }
        });
    },
});
});
