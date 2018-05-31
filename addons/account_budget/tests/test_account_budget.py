# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from .common import TestAccountBudgetCommon
from odoo.tests import tagged
from odoo.tools.datetime import date, datetime
from unittest.mock import patch

# ---------------------------------------------------------
# Tests
# ---------------------------------------------------------
@tagged('post_install', '-at_install')
class TestAccountBudget(TestAccountBudgetCommon):

    def test_account_budget(self):
        with patch.object(datetime, 'now', lambda tzinfo=None: datetime(1983, 10, 30, 10, 0)), \
             patch.object(date, 'today', lambda tzinfo=None: date(1983, 10, 30)):
            # today, next year
            day = date.today()

            # Creating a crossovered.budget record
            budget = self.env['crossovered.budget'].create({
                'date_from': day.start_of('year'),
                'date_to': day.end_of('year'),
                'name': 'Budget %s' % (day.year),
                'state': 'draft'
            })

            # I created two different budget lines
            # Modifying a crossovered.budget record
            self.env['crossovered.budget.lines'].create({
                'crossovered_budget_id': budget.id,
                'analytic_account_id': self.ref('analytic.analytic_partners_camp_to_camp'),
                'date_from': day.start_of('year'),
                'date_to': day.end_of('year'),
                'general_budget_id': self.account_budget_post_purchase0.id,
                'planned_amount': 10000.0,
            })
            self.env['crossovered.budget.lines'].create({
                'crossovered_budget_id': budget.id,
                'analytic_account_id': self.ref('analytic.analytic_our_super_product'),
                'date_from': day.replace(month=9, day=1),
                'date_to': day.replace(month=9, day=30),
                'general_budget_id': self.account_budget_post_sales0.id,
                'planned_amount': 400000.0,
            })
            # I check that Initially Budget is in "draft" state
            self.assertEqual(budget.state, 'draft')

            # I pressed the confirm button to confirm the Budget
            # Performing an action confirm on module crossovered.budget
            budget.action_budget_confirm()

            # I check that budget is in "Confirmed" state
            self.assertEqual(budget.state, 'confirm')

            # I pressed the validate button to validate the Budget
            # Performing an action validate on module crossovered.budget
            budget.action_budget_validate()

            # I check that budget is in "Validated" state
            self.assertEqual(budget.state, 'validate')

            # I pressed the done button to set the Budget to "Done" state
            # Performing an action done on module crossovered.budget
            budget.action_budget_done()

            # I check that budget is in "done" state
            self.assertEqual(budget.state, 'done')
