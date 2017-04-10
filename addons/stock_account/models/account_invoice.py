# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields, _

from odoo.tools.float_utils import float_compare, float_round

import logging

_logger = logging.getLogger(__name__)


class AccountInvoice(models.Model):
    _inherit = "account.invoice"

    @api.model
    def invoice_line_move_line_get(self):
        res = super(AccountInvoice, self).invoice_line_move_line_get()
        if self.company_id.anglo_saxon_accounting and self.type in ('out_invoice', 'out_refund'):
            for i_line in self.invoice_line_ids:
                res.extend(self._anglo_saxon_sale_move_lines(i_line))
        return res

    @api.model
    def _anglo_saxon_sale_move_lines(self, i_line):
        """Return the additional move lines for sales invoices and refunds.

        i_line: An account.invoice.line object.
        res: The move line entries produced so far by the parent move_line_get.
        """
        inv = i_line.invoice_id
        company_currency = inv.company_id.currency_id

        if i_line.product_id.type == 'product' and i_line.product_id.valuation == 'real_time':
            fpos = i_line.invoice_id.fiscal_position_id
            accounts = i_line.product_id.product_tmpl_id.get_product_accounts(fiscal_pos=fpos)
            # debit account dacc will be the output account
            dacc = accounts['stock_output'].id
            # credit account cacc will be the expense account
            cacc = accounts['expense'].id
            if dacc and cacc:
                price_unit = i_line._get_anglo_saxon_price_unit()
                if inv.currency_id.id != company_currency:
                    currency_id = inv.currency_id.id
                    amount_currency = i_line._get_price(company_currency, price_unit)
                else:
                    currency_id = False
                    amount_currency = False
                return [
                    {
                        'type': 'src',
                        'name': i_line.name[:64],
                        'price_unit': price_unit,
                        'quantity': i_line.quantity,
                        'price': price_unit * i_line.quantity,
                        'currency_id': currency_id,
                        'amount_currency': amount_currency,
                        'account_id':dacc,
                        'product_id':i_line.product_id.id,
                        'uom_id':i_line.uom_id.id,
                        'account_analytic_id': i_line.account_analytic_id.id,
                        'analytic_tag_ids': i_line.analytic_tag_ids.ids and [(6, 0, i_line.analytic_tag_ids.ids)] or False,
                    },

                    {
                        'type': 'src',
                        'name': i_line.name[:64],
                        'price_unit': price_unit,
                        'quantity': i_line.quantity,
                        'price': -1 * price_unit * i_line.quantity,
                        'currency_id': currency_id,
                        'amount_currency': -1 * amount_currency,
                        'account_id':cacc,
                        'product_id':i_line.product_id.id,
                        'uom_id':i_line.uom_id.id,
                        'account_analytic_id': i_line.account_analytic_id.id,
                        'analytic_tag_ids': i_line.analytic_tag_ids.ids and [(6, 0, i_line.analytic_tag_ids.ids)] or False,
                    },
                ]
        return []

    def invoice_validate(self): #Overridden to correct stock valuation entries when necessary (with another valuation move)
        rslt = super(AccountInvoice, self).invoice_validate()

        for invoice in self:
            # We only consider vendor bills, when 'purchase' module is installed
            if invoice.type == 'in_invoice' and hasattr(invoice, 'purchase_id'):
                for inv_line in invoice.invoice_line_ids:
                    if inv_line.product_id.valuation == 'real_time' and inv_line.product_id.cost_method == 'real':
                        inv_line.balance_stock_valuation()

        return rslt


class AccountInvoiceLine(models.Model):
    _inherit = "account.invoice.line"

    def _get_anglo_saxon_price_unit(self):
        self.ensure_one()
        price = self.product_id.standard_price
        if not self.uom_id or self.product_id.uom_id == self.uom_id:
            return price
        else:
            return self.product_id.uom_id._compute_price(price, self.uom_id)

    def _get_price(self, company_currency, price_unit):
        if self.invoice_id.currency_id.id != company_currency.id:
            price = company_currency.with_context(date=self.invoice_id.date_invoice).compute(price_unit * self.quantity, self.invoice_id.currency_id)
        else:
            price = price_unit * self.quantity
        return round(price, self.invoice_id.currency_id.decimal_places)

    def get_invoice_line_account(self, type, product, fpos, company):
        if company.anglo_saxon_accounting and type in ('in_invoice', 'in_refund') and product and product.type == 'product':
            accounts = product.product_tmpl_id._get_product_accounts(fiscal_pos=fpos)
            if accounts['stock_input']:
                return accounts['stock_input']
        return super(AccountInvoiceLine, self).get_invoice_line_account(type, product, fpos, company)

    def _get_valuation_for(self, stock_move, exclude_corrected=False):
        valuation_account = self.product_id.product_tmpl_id._get_product_accounts()['stock_valuation']
        rslt = 0.0
        for account_move in stock_move.stock_account_valuation_account_move_ids:
            if not exclude_corrected or not account_move.stock_account_valuation_correction:
                for line in account_move.line_ids:
                    if line.account_id == valuation_account:
                        rslt += line.balance
        return rslt

    def balance_stock_valuation(self):
        global_quantity_to_correct = self.quantity
        stock_moves = self.env['stock.move'].search([('purchase_line_id', '=', self.purchase_line_id.id)])
        for stock_move in stock_moves.sorted(key=lambda m: m.date): #TODO OCO bien vérifier que les dates les plus anciennes sont bien traitées avant

            if not global_quantity_to_correct:
                break

            for valuation_move in stock_move.stock_account_valuation_account_move_ids.sorted(key=lambda v:v.date): #TODO OCO là aussi vérifier le tri par date
                if valuation_move.stock_account_valuation_corrected_qty != valuation_move.stock_account_move_qty and not valuation_move.stock_account_valuation_correction:
                    to_correct_on_move = valuation_move.stock_account_move_qty - valuation_move.stock_account_valuation_corrected_qty

                    correction_qty = min(to_correct_on_move, global_quantity_to_correct)
                    unit_value_for_correction = valuation_move.amount / valuation_move.stock_account_move_qty

                    if correction_qty == to_correct_on_move:
                        #Special case to smooth rounding errors in case some happened before
                        amount_before_correction = valuation_move.amount - valuation_move.stock_account_valuation_corrected_qty * unit_value_for_correction
                    else:
                        amount_before_correction = correction_qty * unit_value_for_correction

                    amount_after_correction = correction_qty * self.price_unit
                    balancing_amount = float_round(amount_before_correction - amount_after_correction, precision_digits = self.currency_id.decimal_places)

                    if not balancing_amount:
                        continue

                    debited_account = self.env['account.move.line'].search([('move_id', '=', valuation_move.id), ('debit', '!=', 0.0)], limit=1).account_id
                    credited_account = self.env['account.move.line'].search([('move_id', '=', valuation_move.id), ('credit', '!=', 0.0)], limit=1).account_id

                    #TODO OCO une méthode avec ça:
                    debited_correction_vals = {
                        'name': stock_move.name + _(' - currency rate adjustment'),
                        'product_id': stock_move.product_id.id,
                        'quantity': correction_qty,
                        'product_uom_id': stock_move.product_id.uom_id.id,
                        'ref': stock_move.picking_id.name,
                        'partner_id': valuation_move.partner_id.id,
                        'credit': (float_compare(balancing_amount, 0.0, precision_digits=self.currency_id.decimal_places)==1) and abs(balancing_amount) or 0.0,
                        'debit': (float_compare(balancing_amount, 0.0, precision_digits=self.currency_id.decimal_places)==-1) and abs(balancing_amount) or 0.0,
                        'account_id': debited_account.id
                    }

                    credited_correction_vals = {
                        'name': stock_move.name + _(' - currency rate adjustment'),
                        'product_id': stock_move.product_id.id,
                        'quantity': correction_qty,
                        'product_uom_id': stock_move.product_id.uom_id.id,
                        'ref': stock_move.picking_id.name,
                        'partner_id': valuation_move.partner_id.id,
                        'credit': (float_compare(balancing_amount, 0.0, precision_digits=self.currency_id.decimal_places)==-1) and abs(balancing_amount) or 0.0,
                        'debit': (float_compare(balancing_amount, 0.0, precision_digits=self.currency_id.decimal_places)==1) and abs(balancing_amount) or 0.0,
                        'account_id': credited_account.id
                    }

                    date = self._context.get('force_period_date', fields.Date.context_today(self))
                    correction_move = self.env['account.move'].create({
                        'journal_id': valuation_move.journal_id.id,
                        'line_ids': [(0,False,debited_correction_vals), (0,False,credited_correction_vals)],
                        'date': date,
                        'ref': stock_move.picking_id.name + _(' - currency rate adjustment'),
                        'stock_account_valuation_correction': True})
                    correction_move.post()
                    stock_move.write({'stock_account_valuation_account_move_ids': [(4, correction_move.id, None)]})
                    stock_move.stock_account_valuation_corrected_quantity += self.quantity

                    #TODO OCO : ça, ça ne va pas dans une méthode à part !!
                    valuation_move.stock_account_valuation_corrected_qty += correction_qty
                    global_quantity_to_correct -= correction_qty




        """
        stock_moves = self.env['stock.move'].search([('purchase_line_id', '=', self.purchase_line_id.id)])
        for stock_move in stock_moves:
            whole_move_initial_valuation = self._get_valuation_for(stock_move, exclude_corrected=True)
            currency = self.env['res.company']._company_default_get().currency_id
            initial_valuation_per_unit = whole_move_initial_valuation / stock_move.ordered_qty

            if whole_move_initial_valuation and float_compare(initial_valuation_per_unit, self.price_unit, precision_digits=currency.decimal_places) != 0:
                #TODO OCO ajouter qqch pour gérer le cas erronné où on refait une facture alors que la PO est déjà intégralement facturée ?? (ce serait pas mal, sans ça on créera des mouvements d'évaluation du stock pour rien qui pourriront la DB)
                qty_left_to_invoice = stock_move.ordered_qty - self.purchase_line_id.qty_invoiced
                _logger.warn("test :"+str(stock_move.ordered_qty))
                if float_compare(self.quantity, qty_left_to_invoice , precision_rounding=self.purchase_line_id.product_uom.rounding) == 0:
                    #TODO OCO il y a un prob ici !
                    valuation_still_to_correct = whole_move_initial_valuation - (stock_move.stock_account_valuation_corrected_quantity * inital_valuation_per_unit)
                    balancing_amount = float_round(valuation_still_to_correct - self.price_subtotal, precision_digits=currency.decimal_places)
                    #En fait ici, il faut refaire une multiplication quté_corrigée * initial_valuation_per_unit
                    #Retirer cette valeur de whole
                    #Ca nous donne la "valuation" à corriger
                    #On en retire self.price_subtotal et on a le montant à écrire dans les compte (balancing_amount)
                    #To be sure we don't get precision errors impeaching a complete balancing of the invoice with the valuation
                else:
                    balancing_amount = float_round((initial_valuation_per_unit * self.quantity) - self.price_subtotal, precision_digits=currency.decimal_places)

                if not balancing_amount: #Then the currency rate has not changed and we don't need to do anything
                    return

                #TODO OCO: et si c'est reçu en plusieurs fois ??

                #TODO OCO peut-être mettre cette boucle dans une méthode à part
                debited_account = None
                credited_account = None
                partner = None
                journal = None
                for valuation_move in stock_move.stock_account_valuation_account_move_ids:
                    for valuation_line in valuation_move.line_ids:
                        if valuation_line.credit:
                            credited_account = valuation_line.account_id
                        elif valuation_line.debit:
                            debited_account = valuation_line.account_id

                    if debited_account and credited_account:
                        journal = valuation_move.journal_id
                        partner = valuation_move.partner_id
                        break

                debited_correction_vals = {
                  'name': stock_move.name + _(' - currency rate adjustment'),
                  'product_id': stock_move.product_id.id,
                  'quantity': self.quantity,
                  'product_uom_id': stock_move.product_id.uom_id.id,
                  'ref': stock_move.picking_id.name,
                  'partner_id': partner.id,
                  'credit': (float_compare(balancing_amount, 0.0, precision_digits=currency.decimal_places)==1) and abs(balancing_amount) or 0.0,
                  'debit': (float_compare(balancing_amount, 0.0, precision_digits=currency.decimal_places)==-1) and abs(balancing_amount) or 0.0,
                  'account_id': debited_account.id
                }

                credited_correction_vals = {
                  'name': stock_move.name + _(' - currency rate adjustment'),
                  'product_id': stock_move.product_id.id,
                  'quantity': self.quantity,
                  'product_uom_id': stock_move.product_id.uom_id.id,
                  'ref': stock_move.picking_id.name,
                  'partner_id': partner.id,
                  'credit': (float_compare(balancing_amount, 0.0, precision_digits=currency.decimal_places)==-1) and abs(balancing_amount) or 0.0,
                  'debit': (float_compare(balancing_amount, 0.0, precision_digits=currency.decimal_places)==1) and abs(balancing_amount) or 0.0,
                  'account_id': credited_account.id
                }

                date = self._context.get('force_period_date', fields.Date.context_today(self))
                correction_move = self.env['account.move'].create({
                    'journal_id': journal.id,
                    'line_ids': [(0,False,debited_correction_vals), (0,False,credited_correction_vals)],
                    'date': date,
                    'ref': stock_move.picking_id.name + _(' - currency rate adjustment'),
                    'stock_account_valuation_correction': True})
                correction_move.post()
                stock_move.write({'stock_account_valuation_account_move_ids': [(4, correction_move.id, None)]})
                stock_move.stock_account_valuation_corrected_quantity += self.quantity
        """