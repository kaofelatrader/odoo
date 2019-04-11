# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import api, fields, models
from odoo.addons.iap.models.iap import InsufficientCreditError

_logger = logging.getLogger(__name__)

try:
    import phonenumbers as pn

except ImportError:
    pn = None
    _logger.info(
        "The `phonenumbers` Python module is not available."
        "Phone number validation will be skipped."
        "Try `pip3 install phonenumbers` to install it."
)

class SmsSms(models.Model):
    _name = 'sms.sms'
    _description = 'SMS'

    name = fields.Char(string='Recipient name')
    number = fields.Char()
    content = fields.Text()

    user_id = fields.Many2one('res.users', 'Sender', default=lambda self: self.env.user.id)
    country_id = fields.Many2one('res.country')
    message_id = fields.Many2one('mail.message')

    state = fields.Selection([
        ('pending', 'In Queue'),
        ('sent', 'Sent'),
        ('error', 'Error'),
        ('canceled', 'Canceled')
    ], 'SMS Status', readonly=True, copy=False, default='pending', required=True)
    
    error_code = fields.Selection([
        ('missing_number', 'Missing Number'),
        ('wrong_number_format', 'Wrong Number Format'),
        ('insufficient_credit', 'Insufficient Credit')
    ])

    @api.multi
    def _get_sanitized_number(self):
        self.ensure_one()
        if not pn:
            return self.number
        if self.number:
            country_id = self.country_id or self.env.user.country_id or self.env.user.company_id.country_id
            country_code = country_id.code if country_id else None
            try:
                parsed_number = pn.parse(self.number, region=country_code, keep_raw_input=True)
                if pn.is_possible_number(parsed_number):
                    return pn.format_number(parsed_number, pn.PhoneNumberFormat.E164)
            except pn.phonenumberutil.NumberParseException:
                return False
        return False

    @api.multi
    def _send(self):
        """ This method try to send SMS after checking the number (presence and
            formatting). """
        for record in self:
            if not record.number:
                record.write({
                    'state': 'error',
                    'error_code': 'missing_number'
                })
                continue
            number = record._get_sanitized_number()
            if not number:
                record.write({
                    'state': 'error',
                    'error_code': 'wrong_number_format'
                })
                continue
            try:
                self.env['sms.api']._send_sms([number], record.content)
                record.write({
                    'state': 'sent',
                    'error_code': False
                })
            except InsufficientCreditError:
                record.write({
                    'state': 'error',
                    'error_code': 'insufficient_credit'
                })
    
    @api.multi
    def _cancel(self):
        """ Cancel SMS """
        self.write({
            'state': 'canceled',
            'error_code': False
        })
        self._notify_sms_update()

    @api.model
    def _fetch_failed_sms(self):
        """ Retrieves the list of SMS with a delivery failure """
        return self.search([('state', '=', 'error'), ('user_id.id', '=', self.env.user.id)])._format_sms_failures()

    @api.multi
    def _format_sms_failures(self):
        """ A shorter message to notify a SMS delivery failure update
        """
        return [{
            'message_id': record.message_id.id,
            'record_name': record.message_id.record_name,
            'model_name': self.env['ir.model']._get(record.message_id.model).display_name,
            'uuid': record.message_id.message_id,
            'res_id': record.message_id.res_id,
            'model': record.message_id.model,
            'last_message_date': record.message_id.date,
            'module_icon': '/sms/static/img/sms_failure.png',
            'sms_id': record.id,
            'sms_status': record.state,
            'failure_type': 'sms'
        } for record in self.filtered(lambda record: record.message_id)]

    @api.multi
    def _notify_sms_update(self):
        """ Notify channels after update of SMS status """
        updates = [[
            (self._cr.dbname, 'res.partner', record.user_id.partner_id.id),
            {'type': 'sms_update', 'elements': record._format_sms_failures()}
        ] for record in self]
        self.env['bus.bus'].sendmany(updates)
