# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models
from . import controllers
from . import report
from . import wizard

from odoo import api, SUPERUSER_ID


def _create_and_assign_picking_types(cr, registry):
    _create_sequences_and_picking_types(cr, registry)
    _assign_picking_types(cr, registry)


def _create_sequences_and_picking_types(cr, registry):
    """ Add a PoS picking type on every existing warehouse which don't have one yet.
    
    It is necessary if the point_of_sale module is installed after some warehouses were already created.
    """
    with api.Environment.manage():
        env = api.Environment(cr, SUPERUSER_ID, {})
        warehouses = env['stock.warehouse'].search([('pos_type_id', '=', False)])
        for warehouse in warehouses:
            new_vals = warehouse._create_or_update_sequences_and_picking_types()
            warehouse.write(new_vals)


def _assign_picking_types(cr, registry):
    """ Assign a picking type to PoS configs which don't have one yet.

    As some picking types are created in the post_init_hook, PoS configs loaded from data don't have a picking type yet.
    """
    with api.Environment.manage():
        env = api.Environment(cr, SUPERUSER_ID, {})
        pos_configs = env['pos.config'].search([('picking_type_id', '=', False)])
        for pos_config in pos_configs:
            default_picking_type_id = env['stock.warehouse'].search([('company_id', '=', pos_config.company_id.id)], limit=1).pos_type_id.id
            pos_config.picking_type_id = default_picking_type_id
