# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class MailThread(models.AbstractModel):
    _inherit = 'mail.thread'

    @api.model
    def _get_sms_recipients(self, res_model, res_id):
        """
        Return a list of dict with the following form: 
        {
            partner_id: The partner if known
            number: The number to which send the sms
        }

        By default, we try to find res.partner records on record and compute
        the recipients to which send SMS.

        Models could implement _get_default_sms_recipients in order to provide
        the right recipients to which send SMS.

        :param res_model: Model of the record
        :param res_id: Id of the record

        :return: list of dict
        """
        record = self.env[res_model].browse(res_id)
        partners = self.env['res.partner']
        if hasattr(record, '_get_default_sms_recipients'):
            partners |= record._get_default_sms_recipients()
        else:
            if 'partner_id' in record._fields:
                partners |= record.mapped('partner_id')
            if 'partner_ids' in record._fields:
                partners |= record.mapped('partner_ids')
        recipients = []
        field_name = self.env.context.get('field_name')
        if field_name:
            recipients.append({
                'partner_id': partners[:1],
                'number': record[field_name]
            })
        else:
            for partner in partners:
                recipients.append({
                    'partner_id': partner,
                    'number': partner.mobile or partner.phone
                })
        return recipients

    @api.multi
    def message_post_send_sms(self, body, sms_ids):
        """ Post SMS text message as internal note in the chatter, and link sms_ids
            to the mail.message
            :param body: Note to log in the chatter.
            :param sms_ids: IDs of the sms.sms records
            :return: ID of the mail.message created
        """
        self.ensure_one()
        message_id = self.message_post(body=body, message_type='sms')
        message_id.sms_ids = sms_ids
        return message_id
