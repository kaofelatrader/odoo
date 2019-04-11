from odoo.addons.account.tests.account_test_classes import AccountingTestCase
from odoo.tests import tagged

@tagged('post_install', '-at_install')
class TestAccountStatementLineToSuspense(AccountingTestCase):

    def test_generate_move_to_suspense_negative_lines(self):
        suspense_account = self.env['account.account'].create({
            'name': 'suspense',
            'code': '4991',
            'user_type_id': self.env.ref('account.data_account_type_liquidity').id
        })
        bank_journal = self.env['account.journal'].create({
            'name': 'Bank',
            'type': 'bank',
            'code': 'BNK97',
         })

        statement = self.env['account.bank.statement'].create({
            'name': 'lines_will_be_in_suspense_account',
            'journal_id': bank_journal.id,
            'line_ids': [
                (0, None, {
                    'name': 'line_positive',
                    'amount': 10,
                }),
                (0, None, {
                    'name': 'line_negative',
                    'amount': -20,
                }),
            ]
        })

        statement_wizard_1 = self.env['account.statement.suspense.wizard'].with_context({ 'res_ids': statement.line_ids.ids }).new({
            'account_id': suspense_account.id,
        })

        # trigger the function
        statement_wizard_1.generate_move_to_suspense()

        moves = self.env['account.move'].search([('ref', '=', 'lines_will_be_in_suspense_account')])

        # assert that two moves were created
        self.assertEquals(len(moves), 2,
                          "there should be exactly two move created after calling generate_move_to_suspense")
        self.assertEquals(len(moves.mapped('line_ids')), 4,
                          "there should be exactly 4 move_lines created after calling generate_move_to_suspense")

        # check that the moves are correctly balanced
        self.assertRecordValues(moves[0].line_ids,[
            {'name': 'line_positive', 'debit': 10, 'credit': 0},
            {'name': 'line_positive', 'debit': 0, 'credit': 10, 'account_id': suspense_account.id},
        ])
        self.assertRecordValues(moves[1].line_ids,[
            {'name': 'line_negative', 'debit': 0, 'credit': 20},
            {'name': 'line_negative', 'debit': 20, 'credit': 0, 'account_id': suspense_account.id},
        ])

        # check that the statement lines are reconcilied to the suspense account
        self.assertTrue(statement.all_lines_reconciled)

        # check that the default suspense account of the current company is set to the one defined
        self.assertEquals(self.env.user.company_id.default_suspense_account_id.id, suspense_account.id)

        # check that the default suspense account will be selected when creating a new wizard
        statement_wizard_2 = self.env['account.statement.suspense.wizard'].create({})
        self.assertEquals(statement_wizard_2.account_id.id, suspense_account.id)