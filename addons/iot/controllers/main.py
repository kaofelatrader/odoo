# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request

class IoTController(http.Controller):

    #get base url (might be used for authentication too)
    @http.route('/iot/base_url', type='json', auth='user')
    def get_base_url(self):
        config = request.env['ir.config_parameter'].search([('key', '=', 'web.base.url')], limit=1)
        if config:
            return config.value
        return 'Not Found'

    # Return home screen
    @http.route('/iot/box/<string:identifier>/screen_url', type='http', auth='public')
    def get_url(self, identifier):
        iotbox = request.env['iot.box'].sudo().search([('identifier', '=', identifier)], limit=1)
        if iotbox.screen_url:
            return iotbox.screen_url
        else:
            return 'http://localhost:8069/point_of_sale/display'

    # Return db uuid
    @http.route('/iot/get_db_uuid', type='json', auth='public')
    def get_db_uuid(self):
        data = request.jsonrequest
        if data['mac_address'] == 'macaddress' and data['token'] == 'token':
            db_uuid = request.env['ir.config_parameter'].sudo().get_param('database.uuid')
            return db_uuid
        else:
            return ''

    @http.route('/iot/setup', type='json', auth='public')
    def update_box(self):
        data = request.jsonrequest

        # Update or create box
        box = request.env['iot.box'].sudo().search([('identifier', '=', data['identifier'])])
        if box:
            box = box[0]
            box.ip = data['ip']
            box.name = data['name']
        else:
            box = request.env['iot.box'].sudo().create({'name': data['name'], 'identifier': data['identifier'], 'ip': data['ip'], })

        # Update or create devices
        for device_identifier in data['devices']:
            data_device = data['devices'][device_identifier]
            if data_device['type'] == 'printer':
                device = request.env['iot.device'].sudo().search([('identifier', '=', device_identifier)])
            else:
                device = request.env['iot.device'].sudo().search([('iot_id', '=', box.id), ('identifier', '=', device_identifier)])
            if device:
                device.name = data_device['name']
            else:
                device = request.env['iot.device'].sudo().create({
                    'iot_id': box.id,
                    'name': data_device['name'],
                    'identifier': device_identifier,
                    'type': data_device['type'],
                    'connection': data_device['connection'],
                })