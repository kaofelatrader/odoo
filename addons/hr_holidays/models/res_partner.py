# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    def _compute_im_status(self):
        super(ResPartner, self)._compute_im_status()
        if self:
            absent_now = self._get_on_leave()
            for partner in self:
                if partner in absent_now:
                    if partner.im_status == 'online':
                        partner.im_status = 'leave_online'
                    else:
                        partner.im_status = 'leave_offline'

    @api.model
    def _get_on_leave(self):
        return self.env['res.users']._get_on_leave().mapped('partner_id')
