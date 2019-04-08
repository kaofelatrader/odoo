# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools


class HrEmployeePublic(models.Model):
    _name = "hr.employee.public"
    _description = 'Public Employee'
    _auto = False

    create_date = fields.Datetime(readonly=True)
    name = fields.Char(readonly=True)

    active = fields.Boolean("Active", readonly=True)

    department_id = fields.Many2one('hr.department', 'Department', readonly=True)
    job_id = fields.Many2one('hr.job', 'Job Position', readonly=True)
    job_title = fields.Char("Job Title", readonly=True)
    company_id = fields.Many2one('res.company', 'Company', store=True, readonly=True)

    child_ids = fields.One2many('hr.employee.public', 'parent_id', string='Direct subordinates', readonly=True)

    image = fields.Binary("Photo", compute='_compute_image', readonly=True, compute_sudo=True)
    image_medium = fields.Binary("Medium-sized photo", compute='_compute_image', readonly=True, compute_sudo=True)
    image_small = fields.Binary("Small-sized photo", compute='_compute_image', readonly=True, compute_sudo=True)

    address_id = fields.Many2one('res.partner', 'Work Address', readonly=True)

    mobile_phone = fields.Char('Work Mobile', readonly=True)
    work_phone = fields.Char('Work Phone', readonly=True)
    work_email = fields.Char('Work Email', readonly=True)
    work_location = fields.Char('Work Location', readonly=True)
    parent_id = fields.Many2one('hr.employee.public', 'Manager', readonly=True)
    coach_id = fields.Many2one('hr.employee.public', 'Coach', readonly=True)

    user_id = fields.Many2one('res.users', readonly=True)

    resource_id = fields.Many2one('resource.resource', readonly=True)
    resource_calendar_id = fields.Many2one('resource.calendar', readonly=True)

    def _compute_image(self):
        for emp in self:
            # We have to be in sudo to have access to the images
            employee_id = self.sudo().env['hr.employee'].browse(emp.id)
            emp.image = employee_id.image
            emp.image_medium = employee_id.image_medium
            emp.image_small = employee_id.image_small

    @api.model
    def _get_fields(self):
        return ','.join('emp.%s' % name for name, field in self._fields.items() if field.store and field.type not in ['many2many', 'one2many'])

    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""CREATE or REPLACE VIEW %s as (
            SELECT
                %s
            FROM hr_employee emp
        )""" % (self._table, self._get_fields()))
