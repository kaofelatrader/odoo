# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import common
from odoo.exceptions import except_orm
from odoo.tests import Form


class TestWarehouse(common.TestMrpCommon):

    def test_manufacturing_route(self):
        warehouse_1_stock_manager = self.warehouse_1.sudo(self.user_stock_manager)
        manu_rule = self.env['stock.rule'].search([
            ('action', '=', 'manufacture'),
            ('warehouse_id', '=', self.warehouse_1.id)])
        self.assertIn(self.warehouse_1.manufacture_pull_id, manu_rule)
        manu_route = self.env.ref('mrp.route_warehouse0_manufacture', raise_if_not_found=False)
        self.assertIn(manu_route, warehouse_1_stock_manager._get_all_routes())
        warehouse_1_stock_manager.write({
            'manufacture_to_resupply': False
        })
        self.assertFalse(self.warehouse_1.manufacture_pull_id.active)
        self.assertFalse(self.warehouse_1.manu_type_id.active)
        self.assertNotIn(manu_route, warehouse_1_stock_manager._get_all_routes())
        warehouse_1_stock_manager.write({
            'manufacture_to_resupply': True
        })
        manu_rule = self.env['stock.rule'].search([
            ('action', '=', 'manufacture'),
            ('warehouse_id', '=', self.warehouse_1.id)])
        self.assertIn(self.warehouse_1.manufacture_pull_id, manu_rule)
        self.assertTrue(self.warehouse_1.manu_type_id.active)
        self.assertIn(manu_route, warehouse_1_stock_manager._get_all_routes())

    def test_manufacturing_scrap(self):
        """
            Testing to do a scrap of consumed material.
        """

        # Update demo products
        (self.product_4 | self.product_2).write({
            'tracking': 'lot',
        })

        # Update Bill Of Material to remove product with phantom bom.
        self.bom_3.bom_line_ids.filtered(lambda x: x.product_id == self.product_5).unlink()

        # Create Inventory Adjustment For Stick and Stone Tools with lot.
        lot_product_4 = self.env['stock.production.lot'].create({
            'name': '0000000000001',
            'product_id': self.product_4.id,
        })
        lot_product_2 = self.env['stock.production.lot'].create({
            'name': '0000000000002',
            'product_id': self.product_2.id,
        })

        stock_inv_product_4 = self.env['stock.inventory'].create({
            'name': 'Stock Inventory for Stick',
            'filter': 'product',
            'product_id': self.product_4.id,
            'line_ids': [
                (0, 0, {'product_id': self.product_4.id, 'product_uom_id': self.product_4.uom_id.id, 'product_qty': 8, 'prod_lot_id': lot_product_4.id, 'location_id': self.ref('stock.stock_location_14')}),
            ]})

        stock_inv_product_2 = self.env['stock.inventory'].create({
            'name': 'Stock Inventory for Stone Tools',
            'filter': 'product',
            'product_id': self.product_2.id,
            'line_ids': [
                (0, 0, {'product_id': self.product_2.id, 'product_uom_id': self.product_2.uom_id.id, 'product_qty': 12, 'prod_lot_id': lot_product_2.id, 'location_id': self.ref('stock.stock_location_14')})
            ]})
        (stock_inv_product_4 | stock_inv_product_2).action_start()
        stock_inv_product_2.action_validate()
        stock_inv_product_4.action_validate()

        #Create Manufacturing order.
        production_form = Form(self.env['mrp.production'])
        production_form.product_id = self.product_6
        production_form.bom_id = self.bom_3
        production_form.product_qty = 12
        production_form.product_uom_id = self.product_6.uom_id
        production_3 = production_form.save()
        production_3.action_confirm()
        production_3.action_assign()

        # Check Manufacturing order's availability.
        self.assertEqual(production_3.reservation_state, 'assigned', "Production order's availability should be Available.")

        location_id = production_3.move_raw_ids.filtered(lambda x: x.state not in ('done', 'cancel')) and production_3.location_src_id.id or production_3.location_dest_id.id,

        # Scrap Product Wood without lot to check assert raise ?.
        scrap_id = self.env['stock.scrap'].with_context(active_model='mrp.production', active_id=production_3.id).create({'product_id': self.product_2.id, 'scrap_qty': 1.0, 'product_uom_id': self.product_2.uom_id.id, 'location_id': location_id, 'production_id': production_3.id})
        with self.assertRaises(except_orm):
            scrap_id.do_scrap()

        # Scrap Product Wood with lot.
        self.env['stock.scrap'].with_context(active_model='mrp.production', active_id=production_3.id).create({'product_id': self.product_2.id, 'scrap_qty': 1.0, 'product_uom_id': self.product_2.uom_id.id, 'location_id': location_id, 'lot_id': lot_product_2.id, 'production_id': production_3.id})

        #Check scrap move is created for this production order.
        #TODO: should check with scrap objects link in between

#        scrap_move = production_3.move_raw_ids.filtered(lambda x: x.product_id == self.product_2 and x.scrapped)
#        self.assertTrue(scrap_move, "There are no any scrap move created for production order.")


class TestKitPicking(common.TestMrpCommon):
    def setUp(self):
        super(TestKitPicking, self).setUp()

        def create_product(name):
            p = Form(self.env['product.product'])
            p.name = name
            p.type = 'product'
            return p.save()

        # Create a kit 'kit_parent' :
        # ---------------------------
        #
        # kit_parent --|- kit_2 x2 --|- component_d x1
        #              |             |- kit_1 x2 -------|- component_a   x2
        #              |                                |- component_b   x1
        #              |                                |- component_c   x3
        #              |
        #              |- kit_3 x1 --|- component_f x1
        #              |             |- component_g x2
        #              |
        #              |- component_e x1
        # Creating all components
        component_a = create_product('Comp A')
        component_b = create_product('Comp B')
        component_c = create_product('Comp C')
        component_d = create_product('Comp D')
        component_e = create_product('Comp E')
        component_f = create_product('Comp F')
        component_g = create_product('Comp G')
        # Creating all kits
        kit_1 = create_product('Kit 1')
        kit_2 = create_product('Kit 2')
        kit_3 = create_product('kit 3')
        self.kit_parent = create_product('Kit Parent')
        # Linking the kits and the components via some 'phantom' BoMs
        bom_kit_1 = self.env['mrp.bom'].create({
            'product_tmpl_id': kit_1.product_tmpl_id.id,
            'product_qty': 1.0,
            'type': 'phantom'})
        BomLine = self.env['mrp.bom.line']
        BomLine.create({
            'product_id': component_a.id,
            'product_qty': 2.0,
            'bom_id': bom_kit_1.id})
        BomLine.create({
            'product_id': component_b.id,
            'product_qty': 1.0,
            'bom_id': bom_kit_1.id})
        BomLine.create({
            'product_id': component_c.id,
            'product_qty': 3.0,
            'bom_id': bom_kit_1.id})
        bom_kit_2 = self.env['mrp.bom'].create({
            'product_tmpl_id': kit_2.product_tmpl_id.id,
            'product_qty': 1.0,
            'type': 'phantom'})
        BomLine.create({
            'product_id': component_d.id,
            'product_qty': 1.0,
            'bom_id': bom_kit_2.id})
        BomLine.create({
            'product_id': kit_1.id,
            'product_qty': 2.0,
            'bom_id': bom_kit_2.id})
        bom_kit_parent = self.env['mrp.bom'].create({
            'product_tmpl_id': self.kit_parent.product_tmpl_id.id,
            'product_qty': 1.0,
            'type': 'phantom'})
        BomLine.create({
            'product_id': component_e.id,
            'product_qty': 1.0,
            'bom_id': bom_kit_parent.id})
        BomLine.create({
            'product_id': kit_2.id,
            'product_qty': 2.0,
            'bom_id': bom_kit_parent.id})
        bom_kit_3 = self.env['mrp.bom'].create({
            'product_tmpl_id': kit_3.product_tmpl_id.id,
            'product_qty': 1.0,
            'type': 'phantom'})
        BomLine.create({
            'product_id': component_f.id,
            'product_qty': 1.0,
            'bom_id': bom_kit_3.id})
        BomLine.create({
            'product_id': component_g.id,
            'product_qty': 2.0,
            'bom_id': bom_kit_3.id})
        BomLine.create({
            'product_id': kit_3.id,
            'product_qty': 1.0,
            'bom_id': bom_kit_parent.id})

        # We create an 'immediate transfer' receipt for x3 kit_parent
        self.test_partner = self.env['res.partner'].create({
            'name': 'Notthat Guyagain',
            'supplier': True,
            'customer': True,
        })
        self.test_supplier = self.env['stock.location'].create({
            'name': 'supplier',
            'usage': 'supplier',
            'location_id': self.env.ref('stock.stock_location_stock').id,
        })

        self.expected_quantities = {
            component_a: 24,
            component_b: 12,
            component_c: 36,
            component_d: 6,
            component_e: 3,
            component_f: 3,
            component_g: 6
        }

    def test_kit_immediate_transfer(self):
        """ Make sure a kit is split in the corrects quantity_done by components in case of an
        immediate transfer.
        """
        picking = self.env['stock.picking'].create({
            'location_id': self.test_supplier.id,
            'location_dest_id': self.warehouse_1.wh_input_stock_loc_id.id,
            'partner_id': self.test_partner.id,
            'picking_type_id': self.env.ref('stock.picking_type_in').id,
            'immediate_transfer': True
        })
        move_receipt_1 = self.env['stock.move'].create({
            'name': self.kit_parent.name,
            'product_id': self.kit_parent.id,
            'quantity_done': 3,
            'product_uom': self.kit_parent.uom_id.id,
            'picking_id': picking.id,
            'picking_type_id': self.env.ref('stock.picking_type_in').id,
            'location_id':  self.test_supplier.id,
            'location_dest_id': self.warehouse_1.wh_input_stock_loc_id.id,
        })
        picking.button_validate()

        # We check that the picking has the correct quantities after its move were splitted.
        self.assertEquals(len(picking.move_lines), 7)
        for move_line in picking.move_lines:
            self.assertEquals(move_line.quantity_done, self.expected_quantities[move_line.product_id])

    def test_kit_planned_transfer(self):
        """ Make sure a kit is split in the corrects product_qty by components in case of a
        planned transfer.
        """
        picking = self.env['stock.picking'].create({
            'location_id': self.test_supplier.id,
            'location_dest_id': self.warehouse_1.wh_input_stock_loc_id.id,
            'partner_id': self.test_partner.id,
            'picking_type_id': self.env.ref('stock.picking_type_in').id,
            'immediate_transfer': False,
        })
        move_receipt_1 = self.env['stock.move'].create({
            'name': self.kit_parent.name,
            'product_id': self.kit_parent.id,
            'product_uom_qty': 3,
            'product_uom': self.kit_parent.uom_id.id,
            'picking_id': picking.id,
            'picking_type_id': self.env.ref('stock.picking_type_in').id,
            'location_id':  self.test_supplier.id,
            'location_dest_id': self.warehouse_1.wh_input_stock_loc_id.id,
        })
        picking.action_confirm()

        # We check that the picking has the correct quantities after its move were splitted.
        self.assertEquals(len(picking.move_lines), 7)
        for move_line in picking.move_lines:
            self.assertEquals(move_line.product_qty, self.expected_quantities[move_line.product_id])
