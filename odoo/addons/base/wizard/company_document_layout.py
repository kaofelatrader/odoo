# -*- coding: utf-8 -*-

import logging
import base64

from odoo import api, fields, models
from odoo.tools.image import image_data_uri

_logger = logging.getLogger(__name__)

class CompanyDocumentLayout(models.TransientModel):
    """
        Customise the company document layout and display a live preview
    """

    @api.model
    def _get_current_company(self):
        # return the current company
        return self.env['res.users'].browse(self._uid).company_id

    _name = 'company.document.layout'
    _description = 'Company Document Layout'

    company_id = fields.Many2one('res.company', default=_get_current_company)

    logo = fields.Binary(related='company_id.logo', readonly=False)
    report_header = fields.Text(related='company_id.report_header', readonly=False)
    report_footer = fields.Text(related='company_id.report_footer', readonly=False)
    paperformat_id = fields.Many2one(related='company_id.paperformat_id', readonly=False)
    external_report_layout_id = fields.Many2one(
        related='company_id.external_report_layout_id', readonly=False)
    font = fields.Selection(related='company_id.font', readonly=False)
    primary_color = fields.Char(related='company_id.primary_color', readonly=False)
    secondary_color = fields.Char(related='company_id.secondary_color', readonly=False)

    @api.multi
    def _get_use_default_colors(self):
        #TODO test
        for wizard in self:
            # prefer user selected colors if they are set
            return not(wizard.primary_color and wizard.secondary_color)

    preview = fields.Html(compute='_compute_preview')
    reset_link = fields.Boolean(string="Reset to default")
    use_default_colors = fields.Boolean(default=_get_use_default_colors)

    @api.onchange('reset_link')
    def reset_colors(self):
        """ set the colors to the current layout default colors """
        for wizard in self:
            #TODO optimisation, we only need to call this once
            report = wizard.env["report.layout"].search([ ('view_id.key', '=', wizard.external_report_layout_id.key) ])
            wizard.primary_color = report.primary_color
            wizard.secondary_color = report.secondary_color

    @api.onchange('primary_color', 'secondary_color')
    def onchange_colors(self):
        for wizard in self:
            if wizard.env.context.get('user_selected', False):  # color change caused by user
                wizard.use_default_colors = False
                _logger.info('color picked by user')
            else:                                               # color change caused by reset_colors()
                wizard.use_default_colors = True
                _logger.info('color changed by wizard')
            wizard._compute_preview()

    @api.onchange('external_report_layout_id')
    def onchange_external_report_layout_id(self):
        for wizard in self:
            if wizard.use_default_colors:
                wizard.reset_colors()
                _logger.info('layout change : default colors')
            else:
                _logger.info('layout change : user colors')
            wizard._compute_preview()

    @api.depends('logo', 'font')
    def _compute_preview(self):
        """ compute a qweb based preview to display on the wizard """
        for wizard in self:
            ir_qweb = wizard.env['ir.qweb']
            # if isinstance(wizard.logo, str):
            #     logo = wizard.company_id._get_logo()
            # elif isinstance(wizard.logo, bytes):
            #     logo = wizard.logo
            # else:
            #     logo = None
            #FIXME randomly causes "missing variable" warnings, need more testing
            #FIXME wizard.logo value
            wizard.preview = ir_qweb.render('web.layout_preview', {
                'company'       : wizard,
            })
