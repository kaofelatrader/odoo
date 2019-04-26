# -*- coding: utf-8 -*-

from odoo import models, fields, api, _


class Warehouse(models.Model):
    _inherit = "stock.warehouse"
    
    pos_type_id = fields.Many2one('stock.picking.type', string="PoS type")
    
    def _get_sequence_values(self):
        sequence_values = super(Warehouse, self)._get_sequence_values()
        sequence_values.update({
            'pos_type_id': {
                'name': self.name + ' ' + _('Picking POS'),
                'prefix': self.code + '/POS/',
                'padding': 5,
                'company_id': self.company_id.id,
            }
        })
        return sequence_values

    def _get_picking_type_update_values(self):
        picking_type_update_values = super(Warehouse, self)._get_picking_type_update_values()
        input_loc, output_loc = self._get_input_output_locations(self.reception_steps, self.delivery_steps)
        picking_type_update_values.update({
            'pos_type_id': {'default_location_src_id': output_loc.id}
        })
        return picking_type_update_values
    
    def _get_picking_type_create_values(self, max_sequence):
        picking_type_create_values, max_sequence = super(Warehouse, self)._get_picking_type_create_values(max_sequence)
        picking_type_create_values.update({
            'pos_type_id': {
                'name': _('PoS Orders'),
                'code': 'outgoing',
                'default_location_src_id': self.lot_stock_id.id,
                'default_location_dest_id': self.env.ref('stock.stock_location_customers').id,
                'sequence': max_sequence + 1,
            }
        })
        return picking_type_create_values, max_sequence + 2
