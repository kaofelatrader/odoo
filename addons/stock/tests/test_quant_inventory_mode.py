# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import SavepointCase


class TestEditableQuant(SavepointCase):
    @classmethod
    def setUpClass(cls):
        super(TestEditableQuant, cls).setUpClass()

        cls.Quant = cls.env['stock.quant'].with_context(inventory_mode=True)

        Product = cls.env['product.product']
        Location = cls.env['stock.location']
        cls.product = Product.create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })
        cls.product_tracked_sn = Product.create({
            'name': 'Product tracked by SN',
            'type': 'product',
            'tracking': 'serial',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })
        cls.warehouse = Location.create({
            'name': 'Warehouse',
            'usage': 'internal',
        })
        cls.stock = Location.create({
            'name': 'Stock',
            'usage': 'internal',
            'location_id': cls.warehouse.id,
        })
        cls.room1 = Location.create({
            'name': 'Room A',
            'usage': 'internal',
            'location_id': cls.stock.id,
        })
        cls.room2 = Location.create({
            'name': 'Room B',
            'usage': 'internal',
            'location_id': cls.stock.id,
        })
        cls.inventory_loss = cls.product.property_stock_inventory

    def test_create_quant_1(self):
        """ Create a new quant who don't exist yet.
        """
        # Checks we don't have any quant for this product.
        quants = self.env['stock.quant'].search([('product_id', '=', self.product.id)])
        self.assertEqual(len(quants), 0)
        self.Quant.create({
            'product_id': self.product.id,
            'location_id': self.stock.id,
            'inventory_quantity': 24
        })
        quants = self.env['stock.quant'].search([
            ('product_id', '=', self.product.id),
            ('quantity', '>', 0),
        ])
        # Checks we have now a quant, and also checks the quantity is equals to
        # what we set in `inventory_quantity` field.
        self.assertEqual(len(quants), 1)
        self.assertEqual(quants.quantity, 24)

        stock_move = self.env['stock.move'].search([
            ('product_id', '=', self.product.id),
        ])
        self.assertEqual(stock_move.location_id.id, self.inventory_loss.id)
        self.assertEqual(stock_move.location_dest_id.id, self.stock.id)

    def test_create_quant_2(self):
        """ Try to create a quant who already exist.
            Must update the existing quant instead of creating a new one.
        """
        # Creates a quants...
        first_quant = self.Quant.create({
            'product_id': self.product.id,
            'location_id': self.room1.id,
            'quantity': 12,
        })
        quants = self.env['stock.quant'].search([
            ('product_id', '=', self.product.id),
            ('quantity', '>', 0),
        ])
        self.assertEqual(len(quants), 1)
        # ... then try to create an another quant for the same product/location.
        second_quant = self.Quant.create({
            'product_id': self.product.id,
            'location_id': self.room1.id,
            'inventory_quantity': 24,
        })
        quants = self.env['stock.quant'].search([
            ('product_id', '=', self.product.id),
            ('quantity', '>', 0),
        ])
        # Checks we still have only one quant, and first quant quantity was
        # updated, and second quant had the same ID than the first quant.
        self.assertEqual(len(quants), 1)
        self.assertEqual(first_quant.quantity, 24)
        self.assertEqual(first_quant.id, second_quant.id)
        stock_move = self.env['stock.move'].search([
            ('product_id', '=', self.product.id),
        ])
        self.assertEqual(len(stock_move), 1)

    def test_edit_quant_1(self):
        """ Increases manually quantity of a quant.
        """
        quant = self.Quant.create({
            'product_id': self.product.id,
            'location_id': self.room1.id,
            'quantity': 12,
        })
        quant.inventory_quantity = 24
        self.assertEqual(quant.quantity, 24)
        stock_move = self.env['stock.move'].search([
            ('product_id', '=', self.product.id),
        ])
        self.assertEqual(stock_move.location_id.id, self.inventory_loss.id)
        self.assertEqual(stock_move.location_dest_id.id, self.room1.id)

    def test_edit_quant_2(self):
        """ Decreases manually quantity of a quant.
        """
        quant = self.Quant.create({
            'product_id': self.product.id,
            'location_id': self.room1.id,
            'quantity': 12,
        })
        quant.inventory_quantity = 8
        self.assertEqual(quant.quantity, 8)
        stock_move = self.env['stock.move'].search([
            ('product_id', '=', self.product.id),
        ])
        self.assertEqual(stock_move.location_id.id, self.room1.id)
        self.assertEqual(stock_move.location_dest_id.id, self.inventory_loss.id)
