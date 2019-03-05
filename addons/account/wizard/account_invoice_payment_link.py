# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class InvoicePaymentLink(models.TransientModel):
    _name = "account.invoice.payment.link"
    _description = "Generate Invoice Payment Link"

    @api.model
    def default_get(self, fields):
        res = super(InvoicePaymentLink, self).default_get(fields)
        active_id = self._context.get('active_id')
        active_model = self._context.get('active_model')
        record = self.env[active_model].browse(active_id)
        res['description'] = record.reference
        res['invoice_id'] = active_id
        res['amount'] = record.amount_total
        return res

    invoice_id = fields.Many2one("account.invoice", string="Invoice order", require=True)
    amount = fields.Float(required=True)
    link = fields.Char(string="Payment link")
    description = fields.Char("Payment Ref")

    def generate_payment_link(self):
        self.ensure_one()
        if self.invoice_id.state != 'open':
            raise UserError(_("Link can be generated only for open invoices."))
        if self.invoice_id.amount_total >= self.amount > 0:
            base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
            currency = self.invoice_id.currency_id or self.invoice_id.company_id.currency_id
            self.link = '%s/website_payment/pay?reference=%s&amount=%s&currency_id=%s&partner_id=%s' % (base_url, self.description, self.amount, currency.id, self.invoice_id.partner_id.id)
        else:
            raise UserError(_("Please set an amount smaller than %s. Please set a positive amount") % (self.invoice_id.amount_total))
        return {
            'name': _('Payment Link'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'account.invoice.payment.link',
            'res_id': self.id,
            'target': 'new',
        }
