# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.exceptions import AccessError, MissingError
from odoo.http import request
from odoo.addons.sale.controllers.portal import CustomerPortal


class CustomerPortal(CustomerPortal):

    @http.route(['/my/orders/<int:order_id>/update_line'], type='json', auth="public", website=True)
    def update(self, line_id, remove=False, unlink=False, order_id=None, access_token=None, **post):
        try:
            order_sudo = self._document_check_access('sale.order', order_id, access_token=access_token)
        except (AccessError, MissingError):
            return request.redirect('/my')

        if order_sudo.state not in ('draft', 'sent'):
            return False
        order_line = request.env['sale.order.line'].sudo().browse(int(line_id))
        if order_line.order_id != order_sudo:
            return False
        if unlink:
            order_line.unlink()
            template = request.env['ir.ui.view'].render_template("sale.sale_order_portal_content", {
                'sale_order': order_sudo, 'report_type': "html",
            })
            return {'amount': str(order_sudo.amount_total), 'sale_order_portal_content': template}
        number = 0 if order_line.product_uom_qty == 1 and remove else -1 if remove else 1
        quantity = order_line.product_uom_qty + number
        order_line.write({'product_uom_qty': quantity})
        value = {
                'quantity': str(quantity),
                'amount': str(order_sudo.amount_total),
                'price_subtotal': str(order_line.price_subtotal)
                }
        return value

    @http.route(["/my/orders/add_option"], type='json', auth="public", website=True)
    def add(self, order_id, option_id, access_token=None, **post):
        try:
            order_sudo = self._document_check_access('sale.order', order_id, access_token=access_token)
        except (AccessError, MissingError):
            return request.redirect('/my')

        option_sudo = request.env['sale.order.option'].sudo().browse(option_id)

        if order_sudo != option_sudo.order_id:
            return False
        option_sudo.add_option_to_order()
        value = {}
        value['sale_order_portal_content'] = request.env['ir.ui.view'].render_template("sale.sale_order_portal_content", {
            'sale_order': option_sudo.order_id, 'report_type': "html",
        })
        value['amount'] = option_sudo.order_id.amount_total
        return value
