# -*- coding: utf-8 -*-

from odoo import models, fields, _


class AccountStatementSuspenseWizard(models.TransientModel):
    """Import statements to a suspense account"""

    _name = "account.statement.suspense.wizard"
    _description = "Bank statement import suspense"

    account_id = fields.Many2one('account.account', string='Suspense account', required=True, default=lambda self: self.env.user.company_id.default_suspense_account_id)

    def generate_move_to_suspense(self):
        """
        Reconcile all the statements lines into a into self.account_id and set the default
        suspense account of the company with self.account_id

        :param res_ids: list of bank statement line ids to import.
        :return: an action for the client to show the moves created.
        """
        lines = self.env['account.bank.statement.line'].browse(self._context['res_ids'])
        datas = []
        for line in lines:
            if line.amount < 0:
                debit = abs(line.amount)
                credit = 0
            else:
                debit = 0
                credit = line.amount
            datas.append({
                'new_aml_dicts': [{
                    'name': line.name,
                    'debit': debit,
                    'credit': credit,
                    'analytic_tag_ids': [[6, 0, []]],
                    'account_id': self.account_id.id
                }],
                'partner_id': False,
                'payment_aml_ids': [],
                'counterpart_aml_dicts': [],
                'to_check': True,
            })

        self.env['account.reconciliation.widget'].process_bank_statement_line(lines.ids, datas)
        self.env.user.company_id.default_suspense_account_id = self.account_id

        return {
            'type': 'ir.actions.act_window_close'
        }