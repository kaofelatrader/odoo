# -*- coding: utf-8 -*-
from odoo import http

# class AutoinstallTheme(http.Controller):
#     @http.route('/autoinstall_theme/autoinstall_theme/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/autoinstall_theme/autoinstall_theme/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('autoinstall_theme.listing', {
#             'root': '/autoinstall_theme/autoinstall_theme',
#             'objects': http.request.env['autoinstall_theme.autoinstall_theme'].search([]),
#         })

#     @http.route('/autoinstall_theme/autoinstall_theme/objects/<model("autoinstall_theme.autoinstall_theme"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('autoinstall_theme.object', {
#             'object': obj
#         })