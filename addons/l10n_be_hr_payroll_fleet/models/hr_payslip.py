# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HrPayslip(models.Model):
    _inherit = 'hr.payslip'

    vehicle_id = fields.Many2one('fleet.vehicle', string='Company Car',
                    tracking=True, help="Employee's company car.")

    @api.onchange('contract_id')
    def onchange_contract_id(self):
        if self.contract_id.car_id:
            self.vehicle_id = self.contract_id.car_id
