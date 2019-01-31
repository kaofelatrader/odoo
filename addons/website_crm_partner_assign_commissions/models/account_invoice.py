# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.tools import float_compare


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'

    reseller_id = fields.Many2one('res.partner', 'Reseller', help='This field is used to track the reseller in order to generate commisions')
    purchase_order_line_id = fields.Many2one('purchase.order.line', 'Reseller Purchase Order line')

    def _make_commissions(self):
        """
            Adds a line to a purchase order for reseller_id containing the due commissions for the invoice
            The line is only added the first time we call this method (called on reconcile)
        """
        self.ensure_one()

        if not self.reseller_id or self.purchase_order_line_id:
            return

        total = 0
        for commission in self.reseller_id.grade_id.commission_ids:
            lines = self.invoice_line_ids.filtered(lambda line: line.product_id.product_tmpl_id.id in commission.product_ids.ids)
            total += sum(line.price_subtotal * commission.percentage / 100 for line in lines)

        if total:
            # Find the purchase order corresponding to the current reseller or create a new one
            purchase_order = self.env['purchase.order'].search([('partner_id', '=', self.reseller_id.id), ('state', '=', 'draft')], limit=1)
            if not purchase_order:
                purchase_order = self.env['purchase.order'].create({
                    'name': _('Purchase order for %s') % self.reseller_id.display_name,
                    'partner_id': self.reseller_id.id,
                })

            purchase_line = self.env['purchase.order.line'].create({
                'name': '%s %s' % (self.display_name, self.partner_id.display_name),
                'product_id': self.env.ref('website_crm_partner_assign_commissions.product_commission').id,
                'product_qty': 1,
                'price_unit': total,
                'product_uom': self.env.ref('uom.product_uom_unit').id,
                'date_planned': fields.Datetime.now(),
                'order_id': purchase_order.id,
            })

            self.purchase_order_line_id = purchase_line


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    def reconcile(self, writeoff_acc_id=False, writeoff_journal_id=False):
        res = super(AccountMoveLine, self).reconcile(writeoff_acc_id=writeoff_acc_id, writeoff_journal_id=writeoff_journal_id)

        if any(line.invoice_id for line in self):
            # We check if any move_line is fully reconciled
            account_move_ids = [l.move_id.id for l in self if float_compare(l.move_id.matched_percentage, 1, precision_digits=5) == 0]

            if account_move_ids:
                move_lines = self.filtered(lambda l: l.invoice_id)
                is_refund = any(move_line.invoice_id.type in ['in_refund', 'out_refund'] for move_line in move_lines)

                for move_line in move_lines:
                    if is_refund:
                        move_line.invoice_id.purchase_order_line_id.unlink()
                    else:
                        move_line.invoice_id._make_commissions()

        return res
