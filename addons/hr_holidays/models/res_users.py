# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResUsers(models.Model):
    _inherit = "res.users"

    def _compute_im_status(self):
        super(ResUsers, self)._compute_im_status()
        if self:
            absent_now = self._get_on_leave()
            for user in self:
                if user in absent_now:
                    if user.im_status == 'online':
                        user.im_status = 'leave_online'
                    else:
                        user.im_status = 'leave_offline'

    @api.model
    def _get_on_leave(self):
        now = fields.Datetime.now()
        return self.env['hr.leave'].sudo().search([
            ('employee_id', '!=', False),
            ('state', 'not in', ['cancel', 'refuse']),
            ('date_from', '<=', now),
            ('date_to', '>=', now)
        ]).mapped('user_id').sudo(self.env.user)
