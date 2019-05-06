# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

""" Implementation of "INVENTORY VALUATION TESTS (With valuation layers)" spreadsheet. """

from unittest import skip

from odoo.tests import Form
from odoo.tests.common import SavepointCase, TransactionCase


class TestStockValuationCommon(SavepointCase):
    @classmethod
    def setUpClass(cls):
        super(TestStockValuationCommon, cls).setUpClass()
        cls.stock_location = cls.env.ref('stock.stock_location_stock')
        cls.customer_location = cls.env.ref('stock.stock_location_customers')
        cls.supplier_location = cls.env.ref('stock.stock_location_suppliers')
        cls.uom_unit = cls.env.ref('uom.product_uom_unit')
        cls.product1 = cls.env['product.product'].create({
            'name': 'product1',
            'type': 'product',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })
        cls.picking_type_in = cls.env.ref('stock.picking_type_in')
        cls.picking_type_out = cls.env.ref('stock.picking_type_out')

    def setUp(self):
        super(TestStockValuationCommon, self).setUp()
        # Counter automatically incremented by `_make_in_move` and `_make_out_move`.
        self.days = 0

    def _make_in_move(self, product, quantity, unit_cost=None, create_picking=False):
        """ Helper to create and validate a receipt move.
        """
        unit_cost = unit_cost or product.standard_price
        in_move = self.env['stock.move'].create({
            'name': 'in %s units @ %s per unit' % (str(quantity), str(unit_cost)),
            'product_id': product.id,
            'location_id': self.supplier_location.id,
            'location_dest_id': self.stock_location.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': quantity,
            'price_unit': unit_cost,
            'picking_type_id': self.picking_type_in.id,
        })

        if create_picking:
            picking = self.env['stock.picking'].create({
                'picking_type_id': in_move.picking_type_id.id,
                'location_id': in_move.location_id.id,
                'location_dest_id': in_move.location_dest_id.id,
            })
            in_move.write({'picking_id': picking.id})

        in_move._action_confirm()
        in_move._action_assign()
        in_move.move_line_ids.qty_done = quantity
        in_move._action_done()

        self.days += 1
        return in_move

    def _make_out_move(self, product, quantity, force_assign=None, create_picking=False):
        """ Helper to create and validate a delivery move.
        """
        out_move = self.env['stock.move'].create({
            'name': 'out %s units' % str(quantity),
            'product_id': product.id,
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': quantity,
            'picking_type_id': self.picking_type_out.id,
        })

        if create_picking:
            picking = self.env['stock.picking'].create({
                'picking_type_id': out_move.picking_type_id.id,
                'location_id': out_move.location_id.id,
                'location_dest_id': out_move.location_dest_id.id,
            })
            out_move.write({'picking_id': picking.id})

        out_move._action_confirm()
        out_move._action_assign()
        if force_assign:
            self.env['stock.move.line'].create({
                'move_id': out_move.id,
                'product_id': out_move.product_id.id,
                'product_uom_id': out_move.product_uom.id,
                'location_id': out_move.location_id.id,
                'location_dest_id': out_move.location_dest_id.id,
            })
        out_move.move_line_ids.qty_done = quantity
        out_move._action_done()

        self.days += 1
        return out_move

    def _make_return(self, move, quantity_to_return):
        stock_return_picking = Form(self.env['stock.return.picking']\
            .with_context(active_ids=[move.picking_id.id], active_id=move.picking_id.id, active_model='stock.picking'))
        stock_return_picking = stock_return_picking.save()
        stock_return_picking.product_return_moves.quantity = quantity_to_return
        stock_return_picking_action = stock_return_picking.create_returns()
        return_pick = self.env['stock.picking'].browse(stock_return_picking_action['res_id'])
        return_pick.move_lines[0].move_line_ids[0].qty_done = quantity_to_return
        return_pick.action_done()
        return return_pick.move_lines


class TestStockValuationStandard(TestStockValuationCommon):
    def setUp(self):
        super(TestStockValuationStandard, self).setUp()
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.product1.product_tmpl_id.standard_price = 10

    def test_normal_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'

        move1 = self._make_in_move(self.product1, 10)
        move2 = self._make_in_move(self.product1, 10)
        move3 = self._make_out_move(self.product1, 15)

        self.assertEqual(self.product1.value_svl, 50)
        self.assertEqual(self.product1.quantity_svl, 5)

    def test_change_in_past_increase_in_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'

        move1 = self._make_in_move(self.product1, 10)
        move2 = self._make_in_move(self.product1, 10)
        move3 = self._make_out_move(self.product1, 15)
        move1.move_line_ids.qty_done = 15

        self.assertEqual(self.product1.value_svl, 100)
        self.assertEqual(self.product1.quantity_svl, 10)

    def test_change_in_past_decrease_in_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'

        move1 = self._make_in_move(self.product1, 10)
        move2 = self._make_in_move(self.product1, 10)
        move3 = self._make_out_move(self.product1, 15)
        move1.move_line_ids.qty_done = 5

        self.assertEqual(self.product1.value_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 0)

    def test_change_in_past_add_ml_in_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'

        move1 = self._make_in_move(self.product1, 10)
        move2 = self._make_in_move(self.product1, 10)
        move3 = self._make_out_move(self.product1, 15)
        self.env['stock.move.line'].create({
            'move_id': move1.id,
            'product_id': move1.product_id.id,
            'qty_done': 5,
            'product_uom_id': move1.product_uom.id,
            'location_id': move1.location_id.id,
            'location_dest_id': move1.location_dest_id.id,
        })

        self.assertEqual(self.product1.value_svl, 100)
        self.assertEqual(self.product1.quantity_svl, 10)

    def test_change_standard_price_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'

        move1 = self._make_in_move(self.product1, 10)
        move2 = self._make_in_move(self.product1, 10)
        move3 = self._make_out_move(self.product1, 15)

        # change cost from 10 to 15
        self.product1.standard_price = 15

        self.assertEqual(self.product1.value_svl, 75)
        self.assertEqual(self.product1.quantity_svl, 5)


class TestStockValuationAVCO(TestStockValuationCommon):
    def setUp(self):
        super(TestStockValuationAVCO, self).setUp()
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'average'

    def test_normal_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'

        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        self.assertEqual(self.product1.standard_price, 10)
        self.assertEqual(move1.stock_valuation_layer_ids.value, 100)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        self.assertEqual(self.product1.standard_price, 15)
        self.assertEqual(move2.stock_valuation_layer_ids.value, 200)
        move3 = self._make_out_move(self.product1, 15)
        self.assertEqual(self.product1.standard_price, 15)
        self.assertEqual(move3.stock_valuation_layer_ids.value, -225)

        self.assertEqual(self.product1.value_svl, 75)
        self.assertEqual(self.product1.quantity_svl, 5)

    def test_change_in_past_increase_in_1(self):
        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        move3 = self._make_out_move(self.product1, 15)
        move1.move_line_ids.qty_done = 15

        self.assertEqual(self.product1.value_svl, 125)
        self.assertEqual(self.product1.quantity_svl, 10)

    def test_change_in_past_decrease_in_1(self):
        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        move3 = self._make_out_move(self.product1, 15)
        move1.move_line_ids.qty_done = 5

        self.assertEqual(self.product1.value_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 0)

    def test_change_in_past_add_ml_in_1(self):
        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        move3 = self._make_out_move(self.product1, 15)
        self.env['stock.move.line'].create({
            'move_id': move1.id,
            'product_id': move1.product_id.id,
            'qty_done': 5,
            'product_uom_id': move1.product_uom.id,
            'location_id': move1.location_id.id,
            'location_dest_id': move1.location_dest_id.id,
        })

        self.assertEqual(self.product1.value_svl, 125)
        self.assertEqual(self.product1.quantity_svl, 10)
        self.assertEqual(self.product1.standard_price, 12.5)

    def test_change_in_past_add_move_in_1(self):
        move1 = self._make_in_move(self.product1, 10, unit_cost=10, create_picking=True)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        move3 = self._make_out_move(self.product1, 15)
        self.env['stock.move.line'].create({
            'product_id': move1.product_id.id,
            'qty_done': 5,
            'product_uom_id': move1.product_uom.id,
            'location_id': move1.location_id.id,
            'location_dest_id': move1.location_dest_id.id,
            'state': 'done',
            'picking_id': move1.picking_id.id,
        })

        self.assertEqual(self.product1.value_svl, 150)
        self.assertEqual(self.product1.quantity_svl, 10)
        self.assertEqual(self.product1.standard_price, 15)

    def test_negative_1(self):
        """ Ensures that, in AVCO, the `remaining_qty` field is computed and the vacuum is ran
        when necessary.
        """
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        move3 = self._make_out_move(self.product1, 30)
        self.assertEqual(move3.stock_valuation_layer_ids.remaining_qty, -10)
        move4 = self._make_in_move(self.product1, 10, unit_cost=30)
        self.assertEqual(move3.stock_valuation_layer_ids.remaining_qty, 0)
        move5 = self._make_in_move(self.product1, 10, unit_cost=40)

        self.assertEqual(self.product1.value_svl, 400)
        self.assertEqual(self.product1.quantity_svl, 10)

    def test_negative_2(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        self.product1.standard_price = 10
        move1 = self._make_out_move(self.product1, 1, force_assign=True)
        move2 = self._make_in_move(self.product1, 1, unit_cost=15)

        self.assertEqual(self.product1.value_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 0)


class TestStockValuationFIFO(TestStockValuationCommon):
    def setUp(self):
        super(TestStockValuationFIFO, self).setUp()
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'fifo'

    def test_negative_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        move3 = self._make_out_move(self.product1, 30)
        self.assertEqual(move3.stock_valuation_layer_ids.remaining_qty, -10)
        move4 = self._make_in_move(self.product1, 10, unit_cost=30)
        self.assertEqual(move3.stock_valuation_layer_ids.remaining_qty, 0)
        move5 = self._make_in_move(self.product1, 10, unit_cost=40)

        self.assertEqual(self.product1.value_svl, 400)
        self.assertEqual(self.product1.quantity_svl, 10)

    def test_change_in_past_decrease_in_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        move1 = self._make_in_move(self.product1, 20, unit_cost=10)
        move2 = self._make_out_move(self.product1, 10)
        move1.move_line_ids.qty_done = 10

        self.assertEqual(self.product1.value_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 0)

    def test_change_in_past_decrease_in_2(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        move1 = self._make_in_move(self.product1, 20, unit_cost=10)
        move2 = self._make_out_move(self.product1, 10)
        move3 = self._make_out_move(self.product1, 10)
        move1.move_line_ids.qty_done = 10
        move1 = self._make_in_move(self.product1, 20, unit_cost=15)

        self.assertEqual(self.product1.value_svl, 150)
        self.assertEqual(self.product1.quantity_svl, 10)

    def test_change_in_past_increase_in_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_in_move(self.product1, 10, unit_cost=15)
        move3 = self._make_out_move(self.product1, 20)
        move1.move_line_ids.qty_done = 20

        self.assertEqual(self.product1.value_svl, 100)
        self.assertEqual(self.product1.quantity_svl, 10)

    def test_change_in_past_increase_in_2(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_in_move(self.product1, 10, unit_cost=12)
        move3 = self._make_out_move(self.product1, 15)
        move4 = self._make_out_move(self.product1, 20)
        move5 = self._make_in_move(self.product1, 100, unit_cost=15)
        move1.move_line_ids.qty_done = 20

        self.assertEqual(self.product1.value_svl, 1375)
        self.assertEqual(self.product1.quantity_svl, 95)

    def test_return_delivery_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_out_move(self.product1, 10, create_picking=True)
        move3 = self._make_in_move(self.product1, 10, unit_cost=20)
        move4 = self._make_return(move2, 10)

        self.assertEqual(self.product1.value_svl, 300)
        self.assertEqual(self.product1.quantity_svl, 20)

    def test_return_receipt_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        move1 = self._make_in_move(self.product1, 10, unit_cost=10, create_picking=True)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        move3 = self._make_return(move1, 2)

        self.assertEqual(self.product1.value_svl, 280)
        self.assertEqual(self.product1.quantity_svl, 18)


class TestStockValuationChangeCostMethod(TestStockValuationCommon):
    def test_standard_to_fifo_1(self):
        """ The accounting impact of this cost method change is neutral.
        """
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        self.product1.product_tmpl_id.standard_price = 10

        move1 = self._make_in_move(self.product1, 10)
        move2 = self._make_in_move(self.product1, 10)
        move3 = self._make_out_move(self.product1, 1)

        self.product1.product_tmpl_id.categ_id.property_cost_method = 'fifo'
        self.assertEqual(self.product1.value_svl, 190)
        self.assertEqual(self.product1.quantity_svl, 19)

        self.assertEqual(len(self.product1.stock_valuation_layer_ids), 5)

    def test_standard_to_fifo_2(self):
        """ We want the same result as `test_standard_to_fifo_1` but by changing the category of
        `self.product1` to another one, not changing the current one.
        """
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        self.product1.product_tmpl_id.standard_price = 10

        move1 = self._make_in_move(self.product1, 10)
        move2 = self._make_in_move(self.product1, 10)
        move3 = self._make_out_move(self.product1, 1)

        cat2 = self.env['product.category'].create({'name': 'fifo'})
        cat2.property_cost_method = 'fifo'
        self.product1.product_tmpl_id.categ_id = cat2
        self.assertEqual(self.product1.value_svl, 190)
        self.assertEqual(self.product1.quantity_svl, 19)
        self.assertEqual(len(self.product1.stock_valuation_layer_ids), 5)

    def test_avco_to_fifo(self):
        """ The accounting impact of this cost method change is neutral.
        """
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'average'
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'

        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        move3 = self._make_out_move(self.product1, 1)

        self.product1.product_tmpl_id.categ_id.property_cost_method = 'fifo'
        self.assertEqual(self.product1.value_svl, 285)
        self.assertEqual(self.product1.quantity_svl, 19)

    def test_fifo_to_standard(self):
        """ The accounting impact of this cost method change is not neutral as we will use the last
        fifo price as the new standard price.
        """
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'fifo'
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'

        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        move3 = self._make_out_move(self.product1, 1)

        self.product1.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.assertEqual(self.product1.value_svl, 380)
        self.assertEqual(self.product1.quantity_svl, 19)

    def test_fifo_to_avco(self):
        """ The accounting impact of this cost method change is not neutral as we will use the last
        fifo price as the new AVCO.
        """
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'fifo'
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'

        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        move3 = self._make_out_move(self.product1, 1)

        self.product1.product_tmpl_id.categ_id.with_context(debug=True).property_cost_method = 'average'
        self.assertEqual(self.product1.value_svl, 380)
        self.assertEqual(self.product1.quantity_svl, 19)

    def test_avco_to_standard(self):
        """ The accounting impact of this cost method change is neutral.
        """
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'average'
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'

        move1 = self._make_in_move(self.product1, 10, unit_cost=10)
        move2 = self._make_in_move(self.product1, 10, unit_cost=20)
        move3 = self._make_out_move(self.product1, 1)

        self.product1.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.assertEqual(self.product1.value_svl, 285)
        self.assertEqual(self.product1.quantity_svl, 19)

    def test_standard_to_avco(self):
        """ The accounting impact of this cost method change is neutral.
        """
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        self.product1.product_tmpl_id.standard_price = 10

        move1 = self._make_in_move(self.product1, 10)
        move2 = self._make_in_move(self.product1, 10)
        move3 = self._make_out_move(self.product1, 1)

        self.product1.product_tmpl_id.categ_id.property_cost_method = 'average'
        self.assertEqual(self.product1.value_svl, 190)
        self.assertEqual(self.product1.quantity_svl, 19)


# -----------------------------------------------------------------------------
# /!\ NOT PART OF THE SPREADSHEET /!\
# -----------------------------------------------------------------------------

@skip('write on standard price triggers 50 sql queries wtf')
class TestBatch(TransactionCase):
    def setUp(self):
        super(TestBatch, self).setUp()
        # Create 5 diffeent products
        self.product1 = self.env['product.product'].create({
            'name': 'product1',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.product2 = self.env['product.product'].create({
            'name': 'product2',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.product3 = self.env['product.product'].create({
            'name': 'product3',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.product4 = self.env['product.product'].create({
            'name': 'product4',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.product5 = self.env['product.product'].create({
            'name': 'product5',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.products = self.product1 + self.product2 + self.product3 + self.product4 + self.product5

        self.supplier_location = self.env.ref('stock.stock_location_suppliers')
        self.stock_location = self.env.ref('stock.stock_location_stock')
        self.customer_location = self.env.ref('stock.stock_location_customers')
        self.uom_unit = self.env.ref('uom.product_uom_unit')
        self.picking_type_in = self.env.ref('stock.picking_type_in')
        self.picking_type_out = self.env.ref('stock.picking_type_out')

    def test_batch_fifo_1(self):
        self.product1.product_tmpl_id.categ_id.property_valuation = 'manual_periodic'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'fifo'

        receipt = self.env['stock.picking'].create({
            'picking_type_id': self.picking_type_in.id,
            'location_id': self.supplier_location.id,
            'location_dest_id': self.stock_location.id,
        })

        receipt_moves = self.env['stock.move']
        for product in self.products:
            receipt_moves |= self.env['stock.move'].create({
                'name': 'in',
                'product_id': product.id,
                'location_id': self.supplier_location.id,
                'location_dest_id': self.stock_location.id,
                'product_uom': self.uom_unit.id,
                'product_uom_qty': 20,
                'price_unit': 10,
                'picking_type_id': self.picking_type_in.id,
                'picking_id': receipt.id,
            })
        receipt.action_confirm()
        receipt_moves.write({'quantity_done': 20})
        # ~150 without valuation
        # ~170 standard valuation
        with self.assertQueryCount(170):
            receipt.button_validate()
        self.assertEqual(receipt.state, 'done')

        delivery = self.env['stock.picking'].create({
            'picking_type_id': self.picking_type_in.id,
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
        })

        delivery_moves = self.env['stock.move']
        for product in self.products:
            delivery_moves |= self.env['stock.move'].create({
                'name': 'in',
                'product_id': product.id,
                'location_id': self.stock_location.id,
                'location_dest_id': self.customer_location.id,
                'product_uom': self.uom_unit.id,
                'product_uom_qty': 20,
                'picking_type_id': self.picking_type_out.id,
                'picking_id': delivery.id,
            })
        delivery.action_confirm()
        delivery.action_assign()
        self.assertEqual(delivery.state, 'assigned')
        delivery_moves.write({'quantity_done': 20})

        # ~150 without valuation
        # ~170 standard valuation
        with self.assertQueryCount(170):
            delivery.button_validate()
        self.assertEqual(receipt.state, 'done')
