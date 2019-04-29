# -*- coding: utf-8 -*-

import logging
import base64

from odoo import api, fields, models
from odoo.tools.image import image_data_uri

_logger = logging.getLogger(__name__)

class CompanyDocumentLayout(models.TransientModel):
    """
        Wizard to customise the company document layout and display a live preview
    """

    _name = 'company.document.layout'
    _description = 'Company Document Layout'

    company_id = fields.Many2one('res.company', required=True)

    logo = fields.Binary(related='company_id.logo', readonly=False, context="")
    report_header = fields.Text(related='company_id.report_header', readonly=False)
    report_footer = fields.Text(related='company_id.report_footer', readonly=False)
    paperformat_id = fields.Many2one(related='company_id.paperformat_id', readonly=False)
    external_report_layout_id = fields.Many2one(
        related='company_id.external_report_layout_id', readonly=False)
    font = fields.Selection(related='company_id.font', readonly=False)
    primary_color = fields.Char(related='company_id.primary_color', readonly=False)
    secondary_color = fields.Char(related='company_id.secondary_color', readonly=False)

    preview = fields.Html(compute='_compute_preview')
    reset_hook = fields.Boolean(string="Reset to default")
    use_default_colors = fields.Boolean(default=False)

    # use_default_colors = lambda self: not(self.primary_color or self.secondary_color)

    @api.onchange('reset_hook')
    def reset_colors(self):
        """ set the colors to the current layout's default colors """
        for wizard in self:
            report = wizard.env["report.layout"].search([ ('view_id.key', '=', wizard.external_report_layout_id.key) ])
            wizard.primary_color = report.primary_color
            wizard.secondary_color = report.secondary_color
            wizard.use_default_colors = True

    @api.onchange('primary_color', 'secondary_color')
    def onchange_colors(self):
        for wizard in self:
            # only use default colors if the USER changed the colors, not the code
            if wizard.env.context.get('user_selected'):
                wizard.use_default_colors = False
            wizard._compute_preview()

    @api.onchange('external_report_layout_id')
    def onchange_external_report_layout_id(self):
        for wizard in self:
            if wizard.use_default_colors:
                wizard.reset_colors()
            wizard._compute_preview()

    @api.depends('logo', 'font')
    def _compute_preview(self):
        """ compute a qweb based preview to display on the wizard """
        for wizard in self:
            ir_qweb = wizard.env['ir.qweb']
            import pdb; pdb.set_trace()
            #logo = wizard.env['res.company'].browse[wizard.company_id].logo
            wizard.preview = ir_qweb.render('web.layout_preview', {
                'logo'                          : wizard.logo,
                'external_report_layout_id_key' : wizard.external_report_layout_id.key,
                'font'                          : wizard.font,
                'primary_color'                 : wizard.primary_color,
                'secondary_color'               : wizard.secondary_color,
                'res_company'                   : wizard.company_id,
            })
