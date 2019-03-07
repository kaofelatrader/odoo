# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class StockQuantityHistory(models.TransientModel):
    _name = 'stock.quantity.history'
    _description = 'Stock Quantity History'

    date = fields.Datetime('Inventory at Date', help="Choose a date to get the inventory at that date", default=fields.Datetime.now)

    def open_at_date(self):
        self.ensure_one()
        str_date = fields.Datetime.to_string(self.date)[:10]
        if str_date != str(fields.Date.today()):
            return {
                'name': str(self.date),
                'type': 'ir.actions.act_window',
                'res_model': 'stock.inventory.report',
                'view_type': 'tree',
                'view_mode': 'tree,pivot,graph',
                'context': {
                    'search_default_internal_loc': 1,
                    'search_default_productgroup': 1,
                    'search_default_locationgroup': 1,
                },
                'domain': [('date', '<=', self.date)],
            }
        else:
            return self._open_product_inventory()

    def _open_product_inventory(self):
        self.env['stock.quant']._merge_quants()
        self.env['stock.quant']._unlink_zero_quants()
        return self.env.ref('stock.quantsact').read()[0]
