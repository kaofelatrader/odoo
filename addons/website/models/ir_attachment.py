# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from odoo import api, fields, models
from odoo.exceptions import UserError
from odoo.tools.translate import _


_logger = logging.getLogger(__name__)


class Attachment(models.Model):

    _inherit = "ir.attachment"

    # related for backward compatibility with saas-6
    website_url = fields.Char(string="Website URL", related='local_url', deprecated=True)
    key = fields.Char(help='Technical field used to resolve multiple attachments in a multi-website environment.')
    website_id = fields.Many2one('website')

    @api.multi
    def unlink(self):
        self |= self.search([('key', 'in', self.filtered('key').mapped('key'))])
        return super(Attachment, self).unlink()

    @api.multi
    def _get_theme_specific_attachment(self, theme_name):
        self.ensure_one()
        attachment = self
        current_website = self._context.get('website_id')

        if not current_website:
            raise UserError(_('Cannot update theme without website'))

        xml_id = self.env['ir.model.data'].search([('model', '=', 'ir.attachment'), ('res_id', '=', attachment.id)])
        if xml_id and xml_id.module != theme_name:
            _logger.info('%s is updating attachment %s (ID: %s)', theme_name, xml_id.complete_name, attachment.id)

            # check if a previously copied attachment for this theme already exists
            theme_specific_attachment = self.env['ir.attachment'].search([('key', '=', attachment.key), ('website_id', '=', current_website)])
            if theme_specific_attachment:
                attachment = theme_specific_attachment
                _logger.info('diverting write to %s (ID: %s)', attachment.name, attachment.id)
            else:
                attachment.with_context(no_cow=True).key = xml_id.complete_name
                attachment = attachment.copy({
                    'website_id': current_website,
                    'key': xml_id.complete_name,
                })
                _logger.info('created new theme-specific attachment %s (ID: %s)', attachment.name, attachment.id)

        return attachment

    @api.multi
    def write(self, vals):
        currently_updating = self._context.get('install_mode_data', {}).get('module', '')
        if not self._context.get('no_cow') and currently_updating.startswith('theme_'):
            for attach in self:
                attach = attach._get_theme_specific_attachment(currently_updating)
                super(Attachment, attach).write(vals)
        else:
            super(Attachment, self).write(vals)

        return True
