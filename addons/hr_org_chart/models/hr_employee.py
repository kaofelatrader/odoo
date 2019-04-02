# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Employee(models.Model):
    _name = 'hr.employee'
    _inherit = ["hr.org.chart.mixin", "hr.employee"]

    subordinate_ids = fields.One2many('hr.employee', string='Subordinates', compute='_compute_subordinates', help="Direct and indirect subordinates")


class HrEmployeePublic(models.Model):
    _name = 'hr.employee.public'
    _inherit = ["hr.org.chart.mixin", "hr.employee.public"]

    subordinate_ids = fields.One2many('hr.employee.public', string='Subordinates', compute='_compute_subordinates', help="Direct and indirect subordinates")
