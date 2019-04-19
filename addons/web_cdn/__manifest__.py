# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Web CDN',
    'category': 'Hidden',
    'version': '1.0',
    'description':
        """
Odoo Web CDN.
=============

This module replaces some templates to use the CDN version of big libraries
instead of serving them locally.
        """,
    'depends': ['web'],
    'auto_install': True,
    'data': [
        'views/webclient_templates.xml',
    ],
}
