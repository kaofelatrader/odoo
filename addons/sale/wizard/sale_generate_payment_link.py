# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class SalePaymentLink(models.TransientModel):
    _name = "sale.payment.link"
    _description = "Generate Sales Payment Link"

    @api.model
    def default_get(self, fields):
        res = super(SalePaymentLink, self).default_get(fields)
        active_id = self._context.get('active_id')
        active_model = self._context.get('active_model')
        record = self.env[active_model].browse(active_id)
        invoiced_amount = sum(record.invoice_ids.mapped('amount_total'))
        res['order_id'] = active_id
        res['description'] = record.name
        res['amount'] = record.amount_total - invoiced_amount
        return res

    order_id = fields.Many2one("sale.order", string="Sales order", require=True)
    amount = fields.Float(required=True)
    link = fields.Char(string="Payment link")
    description = fields.Char(string="Payment Ref")

    def generate_payment_link(self):
        self.ensure_one()
        if self.order_id.state in ['draft', 'cancel']:
            raise UserError(_("Link cannot be generated for draft and cancel state"))
        if self.order_id.amount_total >= self.amount > 0:
            base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
            self.link = '%s/website_payment/pay?reference=%s&amount=%s&currency_id=%s&partner_id=%s' % (base_url, self.description, self.amount, self.order_id.currency_id.id, self.order_id.partner_id.id)
        else:
            raise UserError(_("Please set an amount smaller than %s. Please set a positive amount") % (self.order_id.amount_total))
        return {
            'name': _('Payment Link'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'sale.payment.link',
            'res_id': self.id,
            'target': 'new',
        }
