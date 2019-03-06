# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.osv.expression import AND
from odoo.tools import float_compare
from datetime import datetime

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
from odoo.addons.resource.models.resource_mixin import timezone_datetime

class ResourceCalendar(models.Model):
    _inherit = 'resource.calendar'

    @api.model
    def default_get(self, fields):
        res = super(ResourceCalendar, self).default_get(fields)
        res['normal_attendance_ids'] = res.pop('attendance_ids', None)
        return res

    hours_per_week = fields.Float(compute="_compute_hours_per_week", string="Hours per Week")
    full_time_required_hours = fields.Float(string="Fulltime Hours", help="Number of hours to work to be considered as fulltime.")
    is_fulltime = fields.Boolean(compute='_compute_is_fulltime', string="Is Full Time")

    # UI fields
    normal_attendance_ids = fields.One2many(
        'resource.calendar.attendance', 'calendar_id', 'Normal working Time',
        domain=[('resource_id', '=', False)])

    extra_attendance_ids = fields.One2many(
        'resource.calendar.attendance', 'calendar_id', 'Employees working Time',
        domain=[('resource_id', '!=', False)])

    @api.depends('normal_attendance_ids', 'normal_attendance_ids.hour_from', 'normal_attendance_ids.hour_to', 'normal_attendance_ids.week_type', 'two_weeks_calendar')
    def _compute_hours_per_week(self):
        for calendar in self:
            if calendar.two_weeks_calendar:
                calendar.hours_per_week = sum((attendance.hour_to - attendance.hour_from) for attendance in calendar.normal_attendance_ids.filtered(lambda cal: not cal.week_type)) + \
                sum((attendance.hour_to - attendance.hour_from)/2 for attendance in calendar.normal_attendance_ids.filtered(lambda cal: cal.week_type))
            else:
                calendar.hours_per_week = sum((attendance.hour_to - attendance.hour_from) for attendance in calendar.normal_attendance_ids)

    def _compute_is_fulltime(self):
        for calendar in self:
            calendar.is_fulltime = not float_compare(calendar.full_time_required_hours, calendar.hours_per_week, 3)

    def _get_global_attendances(self):
        res = super(ResourceCalendar, self)._get_global_attendances()
        res |= self.normal_attendance_ids.filtered(lambda attendance: not attendance.date_from and not attendance.date_to)
        return res

    # Add a key on the api.onchange decorator
    @api.onchange('normal_attendance_ids', 'two_weeks_calendar')
    def _onchange_hours_per_day(self):
        self.hours_per_day = super(ResourceCalendar, self)._compute_hours_per_day(self.normal_attendance_ids)

    @api.onchange('normal_attendance_ids')
    def _onchange_normal_attendance_ids(self):
        if not self.two_weeks_calendar:
            return
        even_week_seq = self.normal_attendance_ids.filtered(lambda att: att.display_type == 'line_section' and att.week_type == '0')
        odd_week_seq = self.normal_attendance_ids.filtered(lambda att: att.display_type == 'line_section' and att.week_type == '1')
        if len(even_week_seq) != 1 or len(odd_week_seq) != 1:
            raise ValidationError(_("You can't delete section between weeks."))

        even_week_seq = even_week_seq.sequence
        odd_week_seq = odd_week_seq.sequence

        for line in self.normal_attendance_ids.filtered(lambda att: att.display_type is False):
            if even_week_seq > odd_week_seq:
                line.week_type = '1' if even_week_seq > line.sequence else '0'
            else:
                line.week_type = '0' if odd_week_seq > line.sequence else '1'

    @api.one
    @api.constrains('normal_attendance_ids')
    def _check_attendance(self):
        self._onchange_normal_attendance_ids()
        attendance_ids = self.normal_attendance_ids.filtered(lambda attendance: attendance.display_type is False)
        super(ResourceCalendar, self)._has_superimposed(attendance_ids.filtered(lambda attendance: attendance.week_type == '0'))
        super(ResourceCalendar, self)._has_superimposed(attendance_ids.filtered(lambda attendance: attendance.week_type == '1'))
        super(ResourceCalendar, self)._has_superimposed(attendance_ids.filtered(lambda attendance: attendance.week_type is False))

    @api.multi
    def transfer_leaves_to(self, other_calendar, resources=None, from_date=None):
        """
            Transfer some resource.calendar.leaves from 'self' to another calendar 'other_calendar'.
            Transfered leaves linked to `resources` (or all if `resources` is None) and starting
            after 'from_date' (or today if None).
        """
        from_date = from_date or datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        domain = [
            ('calendar_id', 'in', self.ids),
            ('date_from', '>=', from_date),
        ]
        domain = AND([domain, [('resource_id', 'in', resources.ids)]]) if resources else domain

        self.env['resource.calendar.leaves'].search(domain).write({
            'calendar_id': other_calendar.id,
        })

    @api.one
    def switch_calendar_type(self):
        if not self.two_weeks_calendar:
            self.normal_attendance_ids.unlink()
            self.normal_attendance_ids = [
                    (0, 0, {'name': 'Even week','dayofweek': '0', 'sequence': '0',
                    'hour_from': 0, 'day_period': 'morning', 'week_type': '0',
                    'hour_to': 0, 'display_type': 'line_section'}),
                ]
            default_attendance = self.default_get('')['normal_attendance_ids']
            for idx, att in enumerate(default_attendance):
                att[2]["week_type"] = '0'
                att[2]["sequence"] = idx + 1
            self.normal_attendance_ids = default_attendance
            self.normal_attendance_ids = [
                    (0, 0, {'name': 'Odd week','dayofweek': '0', 'sequence': '25',
                    'hour_from': 0, 'day_period': 'morning', 'week_type': '1',
                    'hour_to': 0, 'display_type': 'line_section'}),
                ]
            for idx, att in enumerate(default_attendance):
                att[2]["week_type"] = '1'
                att[2]["sequence"] = idx + 26
            self.normal_attendance_ids = default_attendance
            self.two_weeks_calendar = True
        else:
            self.two_weeks_calendar = False
            self.normal_attendance_ids.unlink()
            self.normal_attendance_ids = self.default_get('')['normal_attendance_ids']
            self.extra_attendance_ids.write({'week_type': False})
        self._onchange_hours_per_day()


class ResourceCalendarAttendance(models.Model):
    _inherit = 'resource.calendar.attendance'

    def _default_benefit_type_id(self):
        return self.env.ref('hr_payroll.benefit_type_attendance', raise_if_not_found=False)

    benefit_type_id = fields.Many2one('hr.benefit.type', 'Benefit Type', default=_default_benefit_type_id)


class ResourceCalendarLeave(models.Model):
    _inherit = 'resource.calendar.leaves'

    benefit_type_id = fields.Many2one('hr.benefit.type', 'Benefit Type')


class ResourceMixin(models.AbstractModel):
    _inherit = "resource.mixin"

    def _get_benefit_days_data(self, benefit_type, from_datetime, to_datetime, calendar=None):
        """
            By default the resource calendar is used, but it can be
            changed using the `calendar` argument.

            Returns a dict {'days': n, 'hours': h} containing the number of leaves
            expressed as days and as hours.
        """
        resource = self.resource_id
        calendar = calendar or self.resource_calendar_id
        benefit_type_ids = benefit_type.ids
        if benefit_type == self.env.ref('hr_payroll.benefit_type_attendance'): # special case for global attendances
            benefit_type_ids += [False]# no benefit type = normal/global attendance
        domain = [('benefit_type_id', 'in', benefit_type_ids)]

        # naive datetimes are made explicit in UTC
        from_datetime = timezone_datetime(from_datetime)
        to_datetime = timezone_datetime(to_datetime)

        day_total = self._get_day_total(from_datetime, to_datetime, calendar, resource)
        # actual hours per day
        if benefit_type.is_leave:
            intervals = calendar._attendance_intervals(from_datetime, to_datetime, resource) & calendar._leave_intervals(from_datetime, to_datetime, resource, domain) # use domain to only retrieve leaves of this type
        else:
            intervals = calendar._attendance_intervals(from_datetime, to_datetime, resource, domain) - calendar._leave_intervals(from_datetime, to_datetime, resource)

        return self._get_days_data(intervals, day_total)
