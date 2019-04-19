# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class PosOrder(models.Model):
    _inherit = 'pos.order'

    table_id = fields.Many2one('restaurant.table', string='Table', help='The table where this order was served')
    customer_count = fields.Integer(string='Guests', help='The amount of customers that have been served by this order.')
    tip_amount = fields.Float(compute='_compute_tip_amount', inverse='_set_tip_amount', help='The total amount tipped, this is computed using the configured tip product.')

    def _compute_tip_amount(self):
        for order in self:
            tip_product = order.config_id.tip_product_id
            lines = order.lines.filtered(lambda line: line.product_id == tip_product)
            order.tip_amount = sum(lines.mapped('price_subtotal_incl'))

    def _set_tip_amount(self):
        for order in self:
            tip_product = order.config_id.tip_product_id
            tip_line = order.lines.filtered(lambda line: line.product_id == tip_product)
            tip_line = tip_line[0] if tip_line else False

            if not tip_line:
                tip_line = self.env['pos.order.line'].create({
                    'name': 'Tip',
                    'product_id': tip_product.id,
                    'price_unit': order.tip_amount,
                    'price_subtotal': 0,  # will be calculated by _compute_amount_line_all
                    'price_subtotal_incl': 0,  # will be calculated by _compute_amount_line_all
                    'tax_ids': [(6, 0, [tip_product.taxes_id.id])] if tip_product.taxes_id else []
                })
                order.lines |= tip_line

            if tip_line.qty != 1:
                # TODO what do i do
                pass

            tip_line.price_unit = order.tip_amount

            new_amounts = tip_line._compute_amount_line_all()
            tip_line.write({
                'price_subtotal_incl': new_amounts['price_subtotal_incl'],
                'price_subtotal': new_amounts['price_subtotal']
            })

            order._onchange_amount_all()

    @api.model
    def _order_fields(self, ui_order):
        order_fields = super(PosOrder, self)._order_fields(ui_order)
        order_fields['table_id'] = ui_order.get('table_id', False)
        order_fields['customer_count'] = ui_order.get('customer_count', 0)
        return order_fields

    @api.model
    def set_tip(self, pos_reference, new_tip):
        order = self.search([('pos_reference', '=', pos_reference)], limit=1)
        if not order:
            raise ValidationError(_('Reference %s does not exist.') % pos_reference)

        order.tip_amount = new_tip
        return True
