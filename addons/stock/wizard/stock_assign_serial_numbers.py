# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import re

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError


class StockAssignSerialNumbers(models.TransientModel):
    _name = 'stock.assign.serial.numbers'
    _description = 'Stock Assign Serial Numbers'

    product_id = fields.Many2one('product.product', 'Product', required=True)
    move_id = fields.Many2one('stock.move', required=True)
    initial_prod_lot_name = fields.Char('From Serial Number', required=True)

    def generate_serial_numbers(self):
        caught_initial_number = re.search("\d+", self.initial_prod_lot_name)
        if caught_initial_number:
            initial_number = caught_initial_number.group()
            padding = len(initial_number)
            splitted = re.split(initial_number, self.initial_prod_lot_name)
            prefix = splitted[0]
            suffix = splitted[1]

            initial_number = int(initial_number)

            sequence = self.env['ir.sequence'].create({
                'name': _('Automatique Sequence'),
                'number_next': initial_number,
                'padding': padding,
                'prefix': prefix or None,
                'suffix': suffix or None,
            })

            for move_line in self.move_id.move_line_ids:
                if not move_line.lot_id and not move_line.lot_name:
                    move_line.write({
                        'lot_name': sequence._next(),
                        'qty_done': 1})
            return True
        raise ValidationError(_('The serial numbers must contain at least one digit.'))
