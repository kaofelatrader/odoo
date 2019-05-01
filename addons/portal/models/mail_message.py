# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class MailMessage(models.Model):
    _inherit = 'mail.message'

    @api.multi
    def portal_message_format(self):
        return self._portal_message_format([
            'id', 'body', 'date', 'author_id', 'email_from',  # base message fields
            'message_type', 'subtype_id', 'subject',  # message specific
            'model', 'res_id', 'record_name',  # document related
        ])

    @api.multi
    def _portal_message_format(self, fields_list):
        message_values = self.read(fields_list)
        message_tree = dict((m.id, m) for m in self.sudo())
        self._message_read_dict_postprocess(message_values, message_tree)

        for value in message_values:
            attachment_dict = value['attachment_ids']
            for attachment in attachment_dict:
                attachment_id = self.env['ir.attachment'].browse(attachment['id'])
                if not attachment_id.access_token:
                    attachment_id.generate_access_token()
                attachment.update({'access_token': attachment_id.access_token})
        return message_values
