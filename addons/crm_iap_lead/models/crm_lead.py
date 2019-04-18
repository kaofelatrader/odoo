# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api

from odoo.addons.iap import jsonrpc

DEFAULT_ENDPOINT = 'http://iap.vcap.me:8269'

class Lead(models.Model):
    _inherit = 'crm.lead'

    reveal_id = fields.Char(string='Reveal ID', index=True)
    lead_mining_request_id = fields.Many2one('crm.iap.lead.mining.request', string='Lead Mining Request', index=True)

    @api.multi
    def lead_enrich_mail(self):
        print("start")
        request = dict()
        for record in self:
            email_domain = False
            email_domain_partner = False
            email_domain_from = False

            if record.partner_address_email:
                email_domain_partner = record.partner_address_email.split('@')[1]
                email_domain_partner = email_domain_partner if (self.env['crm.iap.lead.banned.domain'].search_count([("domain",'=',email_domain_partner)])==0) else False
            if record.email_from:
                email_domain_from = record.email_from.split('@')[1]
                email_domain_from = email_domain_from if (self.env['crm.iap.lead.banned.domain'].search_count([("domain",'=',email_domain_from)])==0) else False
            email_domain = email_domain_partner or email_domain_from
            if email_domain and (record.probability != 0):
                request[record.id] = email_domain
            else:
                record.message_post_with_view('crm_iap_lead.lead_message_wrong_mail', subtype_id=self.env.ref('mail.mt_note').id)
        response_clearbit = record._make_request(request)
        self._enrich_leads_from_response(response_clearbit)



    def _make_request(self, domains):
        """This methode will query the endpoint to get the data for the asked (lead.id, domain) pairs"""
        reveal_account = self.env['iap.account'].get('reveal')
        dbuuid = self.env['ir.config_parameter'].sudo().get_param('database.uuid')
        endpoint = self.env['ir.config_parameter'].sudo().get_param('reveal.endpoint', DEFAULT_ENDPOINT) + '/iap/clearbit/1/lead_enrichment_email'
        params = {
            'account_token': reveal_account.account_token,
            'dbuuid': dbuuid,
            'domains': domains,
        }
        return jsonrpc(endpoint, params=params, timeout=300)

    def _create_message_data(self, company_data):
        log_data = {
            'message_title': "Lead enriched based on email",
            'twitter': company_data['twitter'],
            'description': company_data['description'],
            'logo': company_data['logo'],
            'name': company_data['name'],
            'phone_numbers': company_data['phone_numbers'],
            'facebook': company_data['facebook'],
            'linkedin': company_data['linkedin'],
            'crunchbase': company_data['crunchbase'],
            'tech': [t.replace('_', ' ').title() for t in company_data['tech']],
        }
        timezone = company_data['timezone']
        if timezone:
            log_data.update({
                'timezone': timezone.replace('_', ' ').title(),
                'timezone_url': company_data['timezone_url'],
            })
        return log_data

    def _send_message(self, company_data = False):
        if company_data:
            messages_to_post = self._create_message_data(company_data)
            self.message_post_with_view('crm_iap_lead.lead_message_template', values=messages_to_post, subtype_id=self.env.ref('mail.mt_note').id)
        else:
            self.message_post_with_view('crm_iap_lead.lead_message_not_found', subtype_id=self.env.ref('mail.mt_note').id)

    @api.multi
    def _enrich_leads_from_response(self, data_clearbit):
        """ This method will get the response from the service and enrich the lead accordingly """
        for lead_id, data in data_clearbit.items():
            record = self.browse(int(lead_id))
            if record.exists():
                if data:
                    street = False
                    street2 = False
                    _zip = False
                    city = False
                    country_id = False
                    state_id = False

                    if not(record.street or record.street2 or record.zip or record.city or record.state_id or record.country_id):
                        street = data["street_number"]
                        street2 = data["street_name"]
                        _zip = data["postal_code"]
                        city = data["city"]
                        country = record.env['res.country'].search([('code', '=', data["country_code"])])
                        country_id = country.id
                        state = record.env['res.country.state'].search([('code', '=', data["state_code"]),('country_id', '=', country_id)])
                        state_id = state.id
                    vals = {
                        'description': record.description or data['description'],
                        'partner_name': record.partner_name or data['name'],
                        'reveal_id': record.reveal_id or data['clearbit_id'],
                        'website': record.website or ('https://www.%s' % data['domain'] if data['domain'] else False),
                        'phone': record.phone or (data["phone_numbers"][0] if (len(data["phone_numbers"])>0) else False),
                        'mobile': record.mobile or (data["phone_numbers"][1] if (len(data["phone_numbers"])>1) else False),
                        'street': record.street or street,
                        'street2': record.street2 or street2,
                        'city': record.city or city,
                        'zip': record.zip or _zip,
                        'country_id': record.country_id.id or country_id,
                        'state_id': record.state_id.id or state_id,
                    }
                    record.write(vals)
                    record._send_message(data)
                else:
                    record._send_message()


class banned_domain(models.Model):
    """ List of domains that will not be queried on clearbit """
    _name = 'crm.iap.lead.banned.domain'
    _description = 'List of the banned domains'

    domain = fields.Char(string='domain', required=True)

    _sql_constraints = [
        ('dom_uniq', 'unique (domain)', 'Domain already in list!'),
    ]


