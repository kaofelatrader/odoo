# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.addons import decimal_precision as dp
from odoo.exceptions import UserError, ValidationError
from odoo.osv import expression
from odoo.tools import float_utils, float_compare


class Inventory(models.Model):
    _name = "stock.inventory"
    _description = "Inventory"
    _order = "date desc, id desc"

    @api.model
    def _default_location_ids(self):
        # No default location if multilocations setting is active
        if not self.user_has_groups('stock.group_stock_multi_locations'):
            company_user = self.env.user.company_id
            warehouse = self.env['stock.warehouse'].search([('company_id', '=', company_user.id)], limit=1)
            if warehouse:
                return [(4, warehouse.lot_stock_id.id, None)]
            else:
                raise UserError(_('You must define a warehouse for the company: %s.') % (company_user.name,))

    def _domain_location_ids(self):
        company_user = self.env.user.company_id.id
        return ['&',
                ('company_id', '=', company_user),
                ('usage', 'not in', ['supplier', 'production'])]

    name = fields.Char(
        'Inventory Reference', default="Inventory",
        readonly=True, required=True,
        states={'draft': [('readonly', False)]})
    date = fields.Datetime(
        'Inventory Date',
        readonly=True, required=True,
        default=fields.Datetime.now,
        help="If the inventory adjustment is not validated, date at which the theoritical quantities have been checked.\n"
             "If the inventory adjustment is validated, date at which the inventory adjustment has been validated.")
    line_ids = fields.One2many(
        'stock.inventory.line', 'inventory_id', string='Inventories',
        copy=True, readonly=False,
        states={'done': [('readonly', True)]})
    move_ids = fields.One2many(
        'stock.move', 'inventory_id', string='Created Moves',
        states={'done': [('readonly', True)]})
    state = fields.Selection(string='Status', selection=[
        ('draft', 'Draft'),
        ('cancel', 'Cancelled'),
        ('confirm', 'In Progress'),
        ('done', 'Validated')],
        copy=False, index=True, readonly=True,
        default='draft')
    company_id = fields.Many2one(
        'res.company', 'Company',
        readonly=True, index=True, required=True,
        states={'draft': [('readonly', False)]},
        default=lambda self: self.env['res.company']._company_default_get('stock.inventory'))
    location_ids = fields.Many2many(
        'stock.location', string='Inventoried Location(s)',
        readonly=True,
        states={'draft': [('readonly', False)]},
        default=lambda self: self._default_location_ids(),
        domain=lambda self: self._domain_location_ids())
    product_ids = fields.Many2many(
        'product.product', string='Inventoried Product(s)',
        readonly=True,
        states={'draft': [('readonly', False)]},
        help="Specify Products to focus your inventory on particular Products.")
    start_empty = fields.Boolean('Empty Inventory', default=False,
        help="Allows to start with an empty inventory.")

    @api.multi
    def unlink(self):
        for inventory in self:
            if inventory.state == 'done':
                raise UserError(_('You cannot delete a validated inventory adjustement.'))
        return super(Inventory, self).unlink()

    def action_validate(self):
        inventory_lines = self.line_ids.filtered(lambda l: l.product_id.tracking in ['lot', 'serial'] and not l.prod_lot_id and l.theoretical_qty != l.product_qty)
        lines = self.line_ids.filtered(lambda l: float_compare(l.product_qty, 1, precision_rounding=l.product_uom_id.rounding) > 0 and l.product_id.tracking == 'serial' and l.prod_lot_id)
        if inventory_lines and not lines:
            wiz_lines = [(0, 0, {'product_id': product.id, 'tracking': product.tracking}) for product in inventory_lines.mapped('product_id')]
            wiz = self.env['stock.track.confirmation'].create({'inventory_id': self.id, 'tracking_line_ids': wiz_lines})
            return {
                    'name': _('Tracked Products in Inventory Adjustment'),
                    'type': 'ir.actions.act_window',
                    'view_mode': 'form',
                    'res_model': 'stock.track.confirmation',
                    'target': 'new',
                    'res_id': wiz.id,
                }
        else:
            self._action_done()

    def _action_done(self, cancel_backorder=False):
        negative = next((line for line in self.mapped('line_ids') if line.product_qty < 0 and line.product_qty != line.theoretical_qty), False)
        if negative:
            raise UserError(_('You cannot set a negative product quantity in an inventory line:\n\t%s - qty: %s') % (negative.product_id.name, negative.product_qty))
        self.action_check()
        self.write({'state': 'done'})
        self.post_inventory()
        return True

    def post_inventory(self):
        # The inventory is posted as a single step which means quants cannot be moved from an internal location to another using an inventory
        # as they will be moved to inventory loss, and other quants will be created to the encoded quant location. This is a normal behavior
        # as quants cannot be reuse from inventory location (users can still manually move the products before/after the inventory if they want).
        self.mapped('move_ids').filtered(lambda move: move.state != 'done')._action_done()

    def action_check(self):
        """ Checks the inventory and computes the stock move to do """
        # tde todo: clean after _generate_moves
        for inventory in self.filtered(lambda x: x.state not in ('done','cancel')):
            # first remove the existing stock moves linked to this inventory
            inventory.mapped('move_ids').unlink()
            inventory.line_ids._generate_moves()

    def action_cancel_draft(self):
        self.mapped('move_ids')._action_cancel()
        self.write({
            'line_ids': [(5,)],
            'state': 'draft'
        })

    def action_start(self):
        # Confirms the inventory adjustment and generates its lines if inventory
        # state is draft
        self.ensure_one()
        if self.state == 'draft':
            vals = {
                'state': 'confirm',
                'date': fields.Datetime.now()
            }
            if not self.line_ids and not self.start_empty:
                vals['line_ids'] = [(0, 0, line_values) for line_values in self._get_inventory_lines_values()]
            self.write(vals)
        return self.action_open_inventory_lines()

    def action_open_inventory_lines(self):
        self.ensure_one()
        action = {
            'type': 'ir.actions.act_window',
            'views': [(self.env.ref('stock.stock_inventory_line_tree2').id, 'tree')],
            'view_mode': 'tree',
            'name': _('Inventory Lines'),
            'res_model': 'stock.inventory.line',
        }
        context = {
            'active_id': self.id,
            'default_is_editable': True,
        }
        # Define domains
        domain = [
            ('inventory_id', '=', self.id),
            ('location_id.usage', 'in', ['internal', 'transit'])]
        if self.location_ids:
            context['default_location_id'] = self.location_ids[0].id
            if len(self.location_ids) == 1:
                if not self.location_ids[0].child_ids:
                    context['readonly_location_id'] = True

        if self.product_ids:
            if len(self.product_ids) == 1:
                context['default_product_id'] = self.product_ids[0].id

        context['active_inventory'] = self.id
        action['context'] = context
        action['domain'] = domain
        return action

    def action_view_related_move_lines(self):
        self.ensure_one()
        domain = [('move_id', 'in', self.move_ids.ids)]
        action = {
            'name': _('Product Moves'),
            'type': 'ir.actions.act_window',
            'res_model': 'stock.move.line',
            'view_type': 'list',
            'view_mode': 'list,form',
            'domain': domain,
        }
        return action

    def _get_inventory_lines_values(self):
        # TDE CLEANME: is sql really necessary ? I don't think so
        locations = self.env['stock.location']
        if len(self.location_ids) > 0:
            locations = self.env['stock.location'].search([('id', 'child_of', self.location_ids.ids)])
        else:
            locations = self.env['stock.location'].search(self._domain_location_ids())
        domain = ' location_id in %s AND quantity != 0 AND active = TRUE'
        args = (tuple(locations.ids),)

        vals = []
        Product = self.env['product.product']
        # Empty recordset of products available in stock_quants
        quant_products = self.env['product.product']

        # If inventory by company
        if self.company_id:
            domain += ' AND company_id = %s'
            args += (self.company_id.id,)
        if self.product_ids:
            domain += ' AND product_id in %s'
            args += (tuple(self.product_ids.ids),)

        self.env.cr.execute("""SELECT product_id, sum(quantity) as product_qty, location_id, lot_id as prod_lot_id, package_id, owner_id as partner_id
            FROM stock_quant
            LEFT JOIN product_product
            ON product_product.id = stock_quant.product_id
            WHERE %s
            GROUP BY product_id, location_id, lot_id, package_id, partner_id """ % domain, args)

        for product_data in self.env.cr.dictfetchall():
            # replace the None the dictionary by False, because falsy values are tested later on
            for void_field in [item[0] for item in product_data.items() if item[1] is None]:
                product_data[void_field] = False
            product_data['theoretical_qty'] = product_data['product_qty']
            if product_data['product_id']:
                product_data['product_uom_id'] = Product.browse(product_data['product_id']).uom_id.id
                quant_products |= Product.browse(product_data['product_id'])
            vals.append(product_data)
        return vals



class InventoryLine(models.Model):
    _name = "stock.inventory.line"
    _description = "Inventory Line"
    _order = "product_id, inventory_id, location_id, prod_lot_id"

    def _default_inventory_id(self):
        return self._context.get('active_inventory', None)

    def _domain_location_id(self):
        domain = [('usage', 'in', ['internal', 'transit'])]
        if self._context.get('active_inventory', False):
            inventory = self.env['stock.inventory'].browse(self._context.get('active_inventory'))
            if inventory.exists():
                if len(inventory.location_ids) >= 1:
                    domain = expression.AND([
                        domain,
                        [('id', 'child_of', inventory.location_ids.ids)]
                    ])
        return domain

    def _domain_product_id(self):
        domain = [('type', '=', 'product')]
        if self._context.get('active_inventory', False):
            inventory = self.env['stock.inventory'].browse(self._context.get('active_inventory'))
            if inventory.exists():
                # In case user set multiple products for the inventory, we constrain domain for
                # those products. We don't need to precise the domain with only one product because
                # in this case, the `product_id` field has a default value and is readonly.
                if len(inventory.product_ids) > 1:
                    domain = expression.AND([
                        domain,
                        [('id', 'in', inventory.product_ids.ids)]
                    ])
        return domain

    is_editable = fields.Boolean(default=False)
    inventory_id = fields.Many2one(
        'stock.inventory', 'Inventory',
        index=True, ondelete='cascade',
        default=lambda self: self._default_inventory_id())
    partner_id = fields.Many2one('res.partner', 'Owner')
    product_id = fields.Many2one(
        'product.product', 'Product',
        domain=lambda self: self._domain_product_id(),
        index=True, required=True)
    product_uom_id = fields.Many2one(
        'uom.uom', 'Product Unit of Measure',
        required=True)
    product_uom_category_id = fields.Many2one(string='Uom category', related='product_uom_id.category_id', readonly=True)
    product_qty = fields.Float(
        'Counted Quantity',
        digits=dp.get_precision('Product Unit of Measure'), default=0)
    location_id = fields.Many2one(
        'stock.location', 'Location',
        index=True, required=True,
        domain=lambda self: self._domain_location_id())
    package_id = fields.Many2one(
        'stock.quant.package', 'Pack', index=True)
    prod_lot_id = fields.Many2one(
        'stock.production.lot', 'Lot/Serial Number',
        domain="[('product_id','=',product_id)]")
    company_id = fields.Many2one(
        'res.company', 'Company', related='inventory_id.company_id',
        index=True, readonly=True, store=True)
    # TDE FIXME: necessary ? -> replace by location_id
    state = fields.Selection(
        'Status',  related='inventory_id.state', readonly=True)
    theoretical_qty = fields.Float(
        'Theoretical Quantity', compute='_compute_theoretical_qty',
        digits=dp.get_precision('Product Unit of Measure'), readonly=True, store=True)
    difference_qty = fields.Float('Difference', compute='_compute_difference',
        help="Indicates the gap between the product's theoretical quantity and its newest quantity.",
        readonly=True, digits=dp.get_precision('Product Unit of Measure'))
    inventory_date = fields.Datetime('Inventory Date', readonly=True,
        default=fields.Datetime.now(),
        help="Last date at which the On Hand Quantity has been computed.")
    outdated = fields.Boolean(String='Quantity oudated',
        compute='_compute_outdated', search='_search_outdated')
    product_tracking = fields.Selection('Tracking', related='product_id.tracking', readonly=True)

    @api.depends('product_qty', 'theoretical_qty')
    def _compute_difference(self):
        for line in self:
            line.difference_qty = line.product_qty - line.theoretical_qty

    @api.depends('product_id.stock_move_ids')
    def _compute_outdated(self):
        for line in self:
            quants = self.env['stock.quant']._gather(line.product_id, line.location_id, lot_id=line.prod_lot_id, package_id=line.package_id, strict=True)
            qty = sum(quants.mapped(lambda q: q.quantity))
            if qty != line.theoretical_qty:
                line.outdated = True
            else:
                line.outdated = False

    @api.one
    @api.depends('location_id', 'product_id', 'package_id', 'product_uom_id', 'company_id', 'prod_lot_id', 'partner_id')
    def _compute_theoretical_qty(self):
        if not self.product_id:
            self.theoretical_qty = 0
            return
        theoretical_qty = self.product_id.get_theoretical_quantity(
            self.product_id.id,
            self.location_id.id,
            lot_id=self.prod_lot_id.id,
            package_id=self.package_id.id,
            owner_id=self.partner_id.id,
            to_uom=self.product_uom_id.id,
        )
        self.theoretical_qty = theoretical_qty

    @api.onchange('product_id')
    def _onchange_product(self):
        res = {}
        # If no UoM or incorrect UoM put default one from product
        if self.product_id:
            self.product_uom_id = self.product_id.uom_id
            res['domain'] = {'product_uom_id': [('category_id', '=', self.product_id.uom_id.category_id.id)]}
        return res

    @api.onchange('product_id', 'location_id', 'product_uom_id', 'prod_lot_id', 'partner_id', 'package_id')
    def _onchange_quantity_context(self):
        if self.product_id and self.location_id and self.product_id.uom_id.category_id == self.product_uom_id.category_id:  # TDE FIXME: last part added because crash
            self._compute_theoretical_qty()
            self.product_qty = self.theoretical_qty

    @api.model_create_multi
    def create(self, vals_list):
        for values in vals_list:
            if 'product_id' in values and 'product_uom_id' not in values:
                values['product_uom_id'] = self.env['product.product'].browse(values['product_id']).uom_id.id
        res = super(InventoryLine, self).create(vals_list)
        res._check_no_duplicate_line()
        return res

    @api.multi
    def write(self,vals):
        res = super(InventoryLine, self).write(vals)
        self._check_no_duplicate_line()
        return res

    def _check_no_duplicate_line(self):
        for line in self:
            domain = [
                ('id', '!=', line.id),
                ('product_id', '=', line.product_id.id),
                ('location_id', '=', line.location_id.id),
                ('partner_id', '=', line.partner_id.id),
                ('package_id', '=', line.package_id.id),
                ('prod_lot_id', '=', line.prod_lot_id.id),
                ('inventory_id', '=', line.inventory_id.id)]
            existings = self.search_count(domain)
            if existings:
                raise UserError(_("There is already one inventory adjustment line for this product,"
                                  " you should rather modify this one instead of creating a new one."))

    @api.constrains('product_id')
    def _check_product_id(self):
        """ As no quants are created for consumable products, it should not be possible do adjust
        their quantity.
        """
        for line in self:
            if line.product_id.type != 'product':
                raise ValidationError(_("You can only adjust storable products.") + '\n\n%s -> %s' % (line.product_id.display_name, line.product_id.type))

    def _get_move_values(self, qty, location_id, location_dest_id, out):
        self.ensure_one()
        return {
            'name': _('INV:') + (self.inventory_id.name or ''),
            'product_id': self.product_id.id,
            'product_uom': self.product_uom_id.id,
            'product_uom_qty': qty,
            'date': self.inventory_id.date,
            'company_id': self.inventory_id.company_id.id,
            'inventory_id': self.inventory_id.id,
            'state': 'confirmed',
            'restrict_partner_id': self.partner_id.id,
            'location_id': location_id,
            'location_dest_id': location_dest_id,
            'move_line_ids': [(0, 0, {
                'product_id': self.product_id.id,
                'lot_id': self.prod_lot_id.id,
                'product_uom_qty': 0,  # bypass reservation here
                'product_uom_id': self.product_uom_id.id,
                'qty_done': qty,
                'package_id': out and self.package_id.id or False,
                'result_package_id': (not out) and self.package_id.id or False,
                'location_id': location_id,
                'location_dest_id': location_dest_id,
                'owner_id': self.partner_id.id,
            })]
        }

    def _generate_moves(self):
        vals_list = []
        for line in self:
            if float_utils.float_compare(line.theoretical_qty, line.product_qty, precision_rounding=line.product_id.uom_id.rounding) == 0:
                continue
            if line.difference_qty > 0:  # found more than expected
                vals = line._get_move_values(line.difference_qty, line.product_id.property_stock_inventory.id, line.location_id.id, False)
            else:
                vals = line._get_move_values(abs(line.difference_qty), line.location_id.id, line.product_id.property_stock_inventory.id, True)
            vals_list.append(vals)
        return self.env['stock.move'].create(vals_list)

    def _refresh_inventory(self):
        return self[0].inventory_id.action_open_inventory_lines()

    def action_refresh_quantity(self):
        for line in self:
            if line.outdated:
                quants = self.env['stock.quant']._gather(line.product_id, line.location_id, lot_id=line.prod_lot_id, package_id=line.package_id, strict=True)
                if quants.exists():
                    quantity = sum(quants.mapped('quantity'))
                    if line.theoretical_qty != quantity:
                        line.theoretical_qty = quantity
                line.inventory_date = fields.Datetime.now()
                line.outdated = False
        self._refresh_inventory()

    def action_reset_product_qty(self):
        self.write({'product_qty': 0})
        self._refresh_inventory()

    @api.model
    def action_validate_inventory(self, inventory_id):
        if not self.user_has_groups('stock.group_stock_manager'):
            raise UserError(_(
                "Only a stock manager can validate an inventory adjustment."))
        inventory = self.env['stock.inventory'].browse(inventory_id)
        if inventory.exists() and inventory.state == 'confirm':
            res = inventory.action_validate()
            if res:
                res['views'] = [(False, 'form')]
                return res
        else:
            raise UserError(_(
                "You can't validate this inventory, maybe this inventory " +
                "doesn't exist anymore or has been already validated."))

    def _search_outdated(self, operator, value):
        lines = self.env['stock.inventory.line'].search([
            ('inventory_id', '=', self.env.context.get('active_id'))
        ])
        line_ids = lines.filtered(lambda line: line.outdated == value).ids
        return [('id', 'in', line_ids)]
