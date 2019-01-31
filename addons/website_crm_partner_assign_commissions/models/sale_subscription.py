# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class SaleSubscription(models.Model):
    _inherit = "sale.subscription"

    reseller_id = fields.Many2one('res.partner', 'Reseller', help='This field is used to track the reseller in order to generate commisions')

    def _prepare_invoice_data(self):
        res = super(SaleSubscription, self)._prepare_invoice_data()
        res.update({
            'reseller_id': self.reseller_id,
        })
        return res
