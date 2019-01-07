# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Channel(models.Model):
    _inherit = 'mail.channel'

    @api.multi
    def channel_info(self, extra_info=False):
        channel_infos = super(Channel, self).channel_info()
        for channel_info in channel_infos:
            if 'direct_partner' in channel_info:
                for direct_partner in channel_info['direct_partner']:
                    if 'leave' in direct_partner['im_status']:
                        # user is out of office but without end date, must be a leave
                        users = self.env['res.partner'].browse(direct_partner['id']).user_ids
                        now = fields.Datetime.now()
                        leaves = self.env['hr.leave'].sudo().search([
                            ('employee_id', 'in', users.mapped('employee_ids').ids),  # we will have only one employe here most of the time
                            ('state', 'not in', ['cancel', 'refuse']),
                            ('date_from', '<=', now),
                            ('date_to', '>=', now)
                        ])
                        if leaves:
                            direct_partner['out_of_office_date_end'] = leaves[0].date_to
                            direct_partner['out_of_office_message'] = leaves[0].out_of_office_message
        return channel_infos
