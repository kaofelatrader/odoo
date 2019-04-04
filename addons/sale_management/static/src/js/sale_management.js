odoo.define('sale_management.sale_management', function (require) {
'use strict';

var publicWidget = require('web.public.widget');

publicWidget.registry.SaleUpdateLineButton = publicWidget.Widget.extend({
    selector: '.o_portal_sale_sidebar',
    events: {
        'click a.js_update_line_json': '_onClick',
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onClick: function (ev) {
        ev.preventDefault();
        var self = this;
        var $input = $(ev.currentTarget);
        this.$input = $input;
        var orderID = $input.data('order-id');
        var lineID = $input.data('line-id');
        var params = {
            'line_id': parseInt(lineID),
            'remove': $input.data('remove'),
            'unlink': $input.data('unlink'),
        };
        var url = "/my/orders/" + parseInt(orderID) + "/update_line";
        this._rpc({
            route: url,
            params: params,
        }).then(function (data) {
            if (!data['quantity']) {
                self.$el.find('.sale_order_portal').empty();
                self.$el.find('.sale_order_portal').append($(data['sale_order_portal_content']).children());
                if ($('#optional_product').length){
                    self.$('.Options').show();
                }
            }
            else {
                self.$input.closest('.input-group').find('.js_quantity').val(data['quantity']);
                self.$input.closest('tr').find($('[data-id="price_subtotal"] > span')).html(data['price_subtotal']);
            }
            $('[data-id="total_amount"] > span').html(data['amount']);
        });
    },
});

publicWidget.registry.SaleAddOptionalProduct = publicWidget.Widget.extend({
    selector: '.o_portal_sale_sidebar .sale_order_portal',
    events: {
        'click a.js_add_optional_products': '_onClickOptionalProduct',
    },
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
    */
    _onClickOptionalProduct: function (ev) {
        ev.preventDefault();
        var self = this;
        var $input = $(ev.currentTarget);
        var orderID = $input.data('order-id');
        var optionIDs = parseInt($input.data('option-id'));
        this._rpc({
            route: "/my/orders/add_option",
            params: {
                order_id: orderID,
                option_id: optionIDs
            },
        }).then(function (data) {
            self.$el.empty();
            self.$el.append($(data['sale_order_portal_content']).children());
            if (!$('#optional_product').length){
                $('.bs-sidenav').find('.Options').hide();
            }
            $('[data-id="total_amount"] > span').html(data['amount']);
        });
    },
});
});
