# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import io
import xlsxwriter

from odoo import http, _
from odoo.http import content_disposition, request


class BomReportController(http.Controller):
    @http.route('/bom_report_xslx/<int:bom_id>', type='http')
    def get_report_xlsx(self, bom_id, quantity, variant, report_name, **kw):
        response = request.make_response(
            None,
            headers=[
                ('Content-Type', 'application/vnd.ms-excel'),
                ('Content-Disposition', content_disposition('bom_structure_sheet.xlsx'))
            ]
        )
        data = request.env['report.mrp.report_bom_structure']._get_report_values([bom_id], {'quantity': quantity, 'variant': variant, 'unfold': False, 'report_name': report_name})
        self.prepare_xlsx_sheet({'data': data, 'report_name': report_name}, response)
        return response

    def prepare_xlsx_sheet(self, data_dict, response):
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        sheet = workbook.add_worksheet('bom_structure_sheet')

        default_col1_style = workbook.add_format({'font_name': 'Arial', 'font_size': 12, 'font_color': '#666666', 'indent': 2})
        default_style = workbook.add_format({'font_name': 'Arial', 'font_size': 12, 'font_color': '#666666'})
        title_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'bottom': 2})
        level_0_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 13, 'bottom': 6, 'font_color': '#666666'})
        level_1_col1_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 13, 'bottom': 1, 'font_color': '#666666', 'indent': 1})
        level_1_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 13, 'bottom': 1, 'font_color': '#666666'})
        level_2_col1_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 12, 'font_color': '#666666', 'indent': 2})
        level_2_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 12, 'font_color': '#666666'})
        level_3_col1_style = workbook.add_format({'font_name': 'Arial', 'font_size': 12, 'font_color': '#666666', 'indent': 3})
        level_3_style = workbook.add_format({'font_name': 'Arial', 'font_size': 12, 'font_color': '#666666'})

        #Set the first column width to 50
        sheet.set_column(0, 0, 50)
        sheet.set_column(4, 4, 10)
        sheet.set_column(1, 1, 25)
        y_offset = 1
        x = 0

        data = data_dict.get('data')
        report_name = data_dict.get('report_name')
        docs = data['docs'][0]
        lines = docs['lines']

        if report_name == 'bom_structure':
            header = {'name': _('Product'), 'code': _('Code'), 'quantity': _('Quantity'), 'umo': _('Unit'), 'vendor': _('Vendor'), 'vendor_cost': _('Vendor Cost'), 'type': _('Type'), 'level': _('Level'), 'prod_cost': _('Product Cost')}
        elif report_name == 'bom_cost':
            header = {'name': _('Product'), 'code': _('Code'), 'quantity': _('Quantity'), 'umo': _('Unit'), 'vendor': _('Vendor'), 'vendor_cost': _('Vendor Cost'), 'type': _('Type'), 'level': _('Level'), 'total': _('Total')}
        else:
            header = {'name': _('Product'), 'code': _('Code'), 'quantity': _('Quantity'), 'umo': _('Unit'), 'vendor': _('Vendor'), 'vendor_cost': _('Vendor Cost'), 'type': _('Type'), 'level': _('Level'), 'prod_cost': _('Product Cost'), 'total': _('Total')}

        #header
        for header_key in header:
            sheet.write(y_offset, list(header.keys()).index(header_key), header[header_key], title_style)

        y_offset += 1
        for line_key in header:
            sheet.write(y_offset, list(header.keys()).index(line_key), docs.get(line_key, ''), level_0_style)

        y_offset += 1
        for y in range(0, len(lines)):
            level = lines[y].get('level')
            if level == 0:
                y_offset += 1
                style = level_0_style
                col1_style = style
            elif level == 1:
                style = level_1_style
                col1_style = level_1_col1_style
            elif level == 2:
                style = level_2_style
                col1_style = level_2_col1_style
            elif level == 3:
                style = level_3_style
                col1_style = level_3_col1_style
            else:
                style = default_style
                col1_style = default_col1_style

            for x in header:
                sheet.write(y+y_offset, list(header.keys()).index(x), lines[y].get(x, ''), list(header.keys()).index(x) > 0 and style or col1_style)

        level_index = list(header.keys()).index('level')
        sheet.write(y_offset + len(lines), level_index, 'Unit Cost', level_1_style)

        if report_name == 'bom_structure':
            sheet.write(y_offset + len(lines), list(header.keys()).index('prod_cost'), docs.get('prod_cost'), level_1_style)
        elif report_name == 'bom_cost':
            sheet.write(y_offset + len(lines), list(header.keys()).index('total'), docs.get('total'), level_1_style)
        else:
            sheet.write(y_offset + len(lines), list(header.keys()).index('prod_cost'), docs.get('prod_cost'), level_1_style)
            sheet.write(y_offset + len(lines), list(header.keys()).index('total'), docs.get('total'), level_1_style)

        workbook.close()
        output.seek(0)
        response.stream.write(output.read())
        output.close()
