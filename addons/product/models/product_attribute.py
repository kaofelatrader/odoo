# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.addons import decimal_precision as dp
from odoo.exceptions import UserError, ValidationError
from odoo.osv import expression


# In the context of product attributes, the following abbreviations might be
# used in local variables for the sake of simplicity:
#   pa = Product Attribute
#   pav = Product Attribute Value
#   ptal = Product Template Attribute Line
#   ptav = Product Template Attribute Value

class ProductAttribute(models.Model):
    _name = 'product.attribute'
    _description = "Product Attribute"
    # if you change this _order, keep it in sync with the method
    # `_sort_key_attribute_value` in `product.template`
    _order = 'sequence, id'

    name = fields.Char(string="Attribute", required=True, translate=True, index=True)
    sequence = fields.Integer(string="Sequence", help="Determine the display order", index=True)
    create_variant = fields.Selection(
        selection=[
            ('no_variant', 'Never'),
            ('always', 'Always'),
            ('dynamic', 'Only when the product is added to a sales order')
        ],
        required=True, default='always', states={'on_product': [('readonly', True)]},
        string="Create Variants", help="This cannot be changed after the attribute has been set on products."
    )
    value_ids = fields.One2many('product.attribute.value', 'attribute_id', string="Values", copy=True)

    # computed and related fields:
    product_template_attribute_line_ids = fields.One2many('product.template.attribute.line', 'attribute_id',
        help="Technical field to associate attributes to products.")
    state = fields.Selection(compute='_compute_products',
        selection=[
            ('draft', "Draft"),
            ('on_product', "Used on products")
        ]
    )
    product_tmpl_ids = fields.Many2many('product.template', string="Used on products", compute='_compute_products')

    @api.multi
    def _compute_products(self):
        for pa in self:
            lines = pa.with_context(active_test=False).product_template_attribute_line_ids
            pa.state = 'on_product' if lines else 'draft'
            pa.product_tmpl_ids = lines.mapped('product_tmpl_id')

    @api.multi
    def write(self, vals):
        """Override to make sure attribute type can't be changed if it's used on
        a product template.

        This is important to prevent because changing the type would make
        existing combinations invalid without recomputing them, and recomputing
        them might take too long and we don't want to change products without
        the user knowing about it."""
        if 'create_variant' in vals:
            for pa in self:
                if vals['create_variant'] != pa.create_variant and pa.product_template_attribute_line_ids:
                    raise UserError(
                        _("You cannot change the variant creation of the attribute %s because it is used on at least one product: %s") %
                        (pa.name, ', '.join(pa.product_tmpl_ids.mapped('name')))
                    )
        invalidate_cache = 'sequence' in vals and any(pa.sequence != vals['sequence'] for pa in self)
        res = super(ProductAttribute, self).write(vals)
        if invalidate_cache:
            # prefetched o2m have to be resequenced
            # (eg. product.template: attribute_line_ids)
            self.env['product.template'].invalidate_cache(fnames=['attribute_line_ids'])
        return res

    @api.multi
    def unlink(self):
        for pa in self:
            if pa.product_template_attribute_line_ids:
                raise UserError(
                    _("You cannot delete the attribute %s because it is used on at least one product: %s") %
                    (pa.name, ', '.join(pa.product_tmpl_ids.mapped('name')))
                )
        return super(ProductAttribute, self).unlink()

    @api.multi
    def _without_no_variant_attributes(self):
        return self.filtered(lambda pa: pa.create_variant != 'no_variant')


class ProductAttributeValue(models.Model):
    _name = 'product.attribute.value'
    _description = "Product Attribute Value"
    # if you change this _order, keep it in sync with the method
    # `_sort_key_variant` in `product.template'
    _order = 'attribute_id, sequence, id'

    name = fields.Char(string="Value", required=True, translate=True, index=True)
    sequence = fields.Integer(string="Sequence", help="Determine the display order", index=True)
    attribute_id = fields.Many2one('product.attribute', string="Attribute",
        required=True, ondelete='cascade', index=True,
        states={'created': [('readonly', True)], 'on_product': [('readonly', True)]}
    )

    # computed and related fields:
    product_template_attribute_value_ids = fields.One2many('product.template.attribute.value', 'product_attribute_value_id',
        help="Technical field to associate attribute values to products.")
    state = fields.Selection(compute='_compute_products',
        selection=[
            ('draft', "Draft"),
            ('created', "Created"),
            ('on_product', "Used on products")
        ]
    )
    product_tmpl_ids = fields.Many2many('product.template', string="Used on products", compute='_compute_products')

    _sql_constraints = [
        ('value_company_uniq', 'unique (name, attribute_id)', "You cannot create two attribute values with the same name for the same attribute.")
    ]

    @api.multi
    def _compute_products(self):
        for record in self:
            values = record.with_context(active_test=False).product_template_attribute_value_ids
            record.state = 'on_product' if values else 'created' if record.exists() else 'draft'
            record.product_tmpl_ids = values.mapped('product_tmpl_id')

    @api.multi
    def name_get(self):
        if not self._context.get('show_attribute', True):  # TDE FIXME: not used
            return super(ProductAttributeValue, self).name_get()
        return [(value.id, "%s: %s" % (value.attribute_id.name, value.name)) for value in self]

    @api.multi
    def _variant_name(self, variable_attributes):
        return ", ".join([v.name for v in self if v.attribute_id in variable_attributes])

    @api.multi
    def write(self, values):
        if 'attribute_id' in values:
            for pav in self:
                if pav.attribute_id.id != values['attribute_id']:
                    raise UserError(_("You cannot change the attribute of the existing attribute value %s." % pav.name))

        invalidate_cache = 'sequence' in values and any(record.sequence != values['sequence'] for record in self)
        res = super(ProductAttributeValue, self).write(values)
        if invalidate_cache:
            # prefetched o2m have to be resequenced
            # (eg. product.template.attribute.line: value_ids)
            self.invalidate_cache()
        return res

    @api.multi
    def unlink(self):
        pav = self.filtered(lambda pav: pav.product_template_attribute_value_ids)[:1]
        if pav:
            raise UserError(
                _("You cannot delete the attribute value %s because it is used on at least one product: %s") %
                (pav.name, ', '.join(pav.product_tmpl_ids.mapped('name')))
            )
        return super(ProductAttributeValue, self).unlink()

    @api.multi
    def _without_no_variant_attributes(self):
        return self.filtered(lambda pav: pav.attribute_id.create_variant != 'no_variant')


class ProductTemplateAttributeLine(models.Model):
    """Attributes available on product.template with their selected values in a m2m.
    Used as a configuration model to generate the appropriate product.template.attribute.value"""

    _name = 'product.template.attribute.line'
    _description = "Product Template Attribute Line"
    _order = 'attribute_id, id'

    # defining fields: the product template and the product attribute
    product_tmpl_id = fields.Many2one('product.template', string="Product Template", ondelete='cascade', required=True, index=True)
    attribute_id = fields.Many2one('product.attribute', string="Attribute", ondelete='restrict', required=True, index=True)

    # configuration field: the selected product attribute values
    value_ids = fields.Many2many('product.attribute.value', string="Attribute Values", domain="[('attribute_id', '=', attribute_id)]")

    # related field
    name = fields.Char('Value', related='attribute_id.name', store=True)

    # relational field: the product template attribute values that this configuration created
    product_template_value_ids = fields.One2many('product.template.attribute.value', 'product_template_attribute_line_id', string="Product Attribute Values")

    _sql_constraints = [
        ('template_attribute_unique', 'unique(product_tmpl_id, attribute_id)', "Each attribute should be defined only once per product."),
    ]

    @api.constrains('value_ids', 'attribute_id')
    def _check_valid_values(self):
        for ptal in self:
            if not ptal.value_ids:
                raise ValidationError(
                    _("The attribute %s set on product %s must have at least one value.") %
                    (ptal.name, ptal.product_tmpl_id.name)
                )
            for pav in ptal.value_ids:
                if pav.attribute_id != ptal.attribute_id:
                    raise ValidationError(
                        _("The attribute value %s does not belong to the attribute %s set on product %s.") %
                        (pav.name, ptal.name, ptal.product_tmpl_id.name)
                    )
        return True

    @api.model
    def create(self, values):
        res = super(ProductTemplateAttributeLine, self).create(values)
        res._update_product_template_attribute_values()
        return res

    def write(self, values):
        if 'product_tmpl_id' in values:
            for ptal in self:
                if ptal.product_tmpl_id.id != values['product_tmpl_id']:
                    raise UserError(
                        _("You cannot change the product of the attribute %s set on product %s.") %
                        (ptal.name, ptal.product_tmpl_id.name)
                    )

        if 'attribute_id' in values:
            for ptal in self:
                if ptal.attribute_id.id != values['attribute_id']:
                    raise UserError(
                        _("You cannot change the attribute of the attribute %s set on product %s.") %
                        (ptal.name, ptal.product_tmpl_id.name)
                    )

        res = super(ProductTemplateAttributeLine, self).write(values)
        self._update_product_template_attribute_values()
        return res

    def _update_product_template_attribute_values(self):
        """Create or unlink product.template.attribute.value based on the
        attribute lines.

        This is a trick for the form view and for performance in general,
        because we don't want to generate in advance all possible values for all
        templates, but only those that will be selected.

        If the product.attribute.value is removed from the line: remove the
        corresponding product.template.attribute.value.

        If no product.template.attribute.value exists for the newly added
        product.attribute.value, create it.

        Note: if an attribute line is removed, product.template.attribute.value
        will be automatically removed with the cascade.
        """
        product_template_attribute_values_to_create = []
        product_template_attribute_values_to_remove = self.env['product.template.attribute.value']

        for ptal in self:
            existing_attribute_values = self.env['product.attribute.value']
            for ptav in ptal.product_template_value_ids:
                if ptav.product_attribute_value_id not in ptal.value_ids:
                    # remove values that existed but don't exist anymore
                    product_template_attribute_values_to_remove |= ptav
                else:
                    existing_attribute_values |= ptav.product_attribute_value_id

            for pav in ptal.value_ids:
                if pav not in existing_attribute_values:
                    # create values that didn't exist yet
                    product_template_attribute_values_to_create.append({
                        'product_attribute_value_id': pav.id,
                        'product_template_attribute_line_id': ptal.id
                    })

        # unlink and create in batch for performance
        product_template_attribute_values_to_remove.unlink()
        self.env['product.template.attribute.value'].create(product_template_attribute_values_to_create)

    @api.model
    def _name_search(self, name, args=None, operator='ilike', limit=100, name_get_uid=None):
        # TDE FIXME: currently overriding the domain; however as it includes a
        # search on a m2o and one on a m2m, probably this will quickly become
        # difficult to compute - check if performance optimization is required
        if name and operator in ('=', 'ilike', '=ilike', 'like', '=like'):
            args = args or []
            domain = ['|', ('attribute_id', operator, name), ('value_ids', operator, name)]
            attribute_ids = self._search(expression.AND([domain, args]), limit=limit, access_rights_uid=name_get_uid)
            return self.browse(attribute_ids).name_get()
        return super(ProductTemplateAttributeLine, self)._name_search(name=name, args=args, operator=operator, limit=limit, name_get_uid=name_get_uid)

    @api.multi
    def _without_no_variant_attributes(self):
        return self.filtered(lambda ptal: ptal.attribute_id.create_variant != 'no_variant')


class ProductTemplateAttributeValue(models.Model):
    """Materialized relationship between attribute values
    and product template generated by the product.template.attribute.line"""

    _name = 'product.template.attribute.value'
    _description = "Product Template Attribute Value"
    _order = 'product_attribute_value_id, id'

    # defining fields: the product template attribute line and the product attribute value
    product_template_attribute_line_id = fields.Many2one('product.template.attribute.line', required=True, ondelete='cascade', index=True)
    product_attribute_value_id = fields.Many2one('product.attribute.value', string="Attribute Value", required=True, ondelete='restrict', index=True)

    # configuration fields: the price_extra and the exclusion rules
    price_extra = fields.Float(string="Value Price Extra", default=0.0, digits=dp.get_precision('Product Price'),
        help="Price Extra: Extra price for the variant with this attribute value on sale price. eg. 200 price extra, 1000 + 200 = 1200.")
    exclude_for = fields.One2many('product.template.attribute.exclusion', 'product_template_attribute_value_id', string="Exclude for",
        relation="product_template_attribute_exclusion",
        help="Make this attribute value not compatible with other values of the product or some attribute values of optional and accessory products.")

    # various related fields
    name = fields.Char(string="Value", related='product_attribute_value_id.name', store=True)
    product_tmpl_id = fields.Many2one('product.template', related='product_template_attribute_line_id.product_tmpl_id', store=True, index=True)
    attribute_id = fields.Many2one('product.attribute', string="Attribute", related='product_template_attribute_line_id.attribute_id', store=True, index=True)

    _sql_constraints = [
        ('attribute_value_unique', 'unique(product_template_attribute_line_id, product_attribute_value_id)', "Each value should be defined only once per attribute per product."),
    ]

    @api.constrains('product_template_attribute_line_id', 'product_attribute_value_id')
    def _check_valid_values(self):
        for ptav in self:
            if ptav.product_template_attribute_line_id.attribute_id != ptav.product_attribute_value_id.attribute_id:
                raise ValidationError(
                    _("The value %s does not belong to the attribute %s.") %
                    (ptav.name, ptav.product_template_attribute_line_id.name)
                )
        return True

    @api.multi
    def write(self, values):
        if 'product_template_attribute_line_id' in values:
            for ptav in self:
                if ptav.product_template_attribute_line_id.id != values['product_template_attribute_line_id']:
                    raise UserError(
                        _("You cannot change the attribute of the attribute value %s set on product %s.") %
                        (ptav.name, ptav.product_tmpl_id.name)
                    )

        if 'product_attribute_value_id' in values:
            for ptav in self:
                if ptav.product_attribute_value_id.id != values['product_attribute_value_id']:
                    raise UserError(
                        _("You cannot change the value of the attribute value %s set on product %s.") %
                        (ptav.name, ptav.product_tmpl_id.name)
                    )

        return super(ProductTemplateAttributeValue, self).write(values)

    @api.multi
    def name_get(self):
        if not self._context.get('show_attribute', True):  # TDE FIXME: not used
            return super(ProductTemplateAttributeValue, self).name_get()
        return [(value.id, "%s: %s" % (value.attribute_id.name, value.name)) for value in self]

    @api.multi
    def _without_no_variant_attributes(self):
        return self.filtered(lambda ptav: ptav.attribute_id.create_variant != 'no_variant')


class ProductTemplateAttributeExclusion(models.Model):
    _name = 'product.template.attribute.exclusion'
    _description = "Product Template Attribute Exclusion"

    product_template_attribute_value_id = fields.Many2one('product.template.attribute.value', string="Attribute Value", ondelete='cascade', index=True)
    product_tmpl_id = fields.Many2one('product.template', string="Product Template", ondelete='cascade', required=True, index=True)
    value_ids = fields.Many2many('product.template.attribute.value', string="Attribute Values",
        relation='product_attr_exclusion_value_ids_rel', domain="[('product_tmpl_id', '=', product_tmpl_id)]")
