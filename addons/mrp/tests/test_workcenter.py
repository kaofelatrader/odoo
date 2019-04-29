# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime, timedelta

from odoo.tests import Form
from odoo.addons.mrp.tests.common import TestMrpCommon
from odoo.exceptions import ValidationError


class TestWorkcenterPlanning(TestMrpCommon):
    def setUp(self):
        super(TestWorkcenterPlanning, self).setUp()
        self.source_location_id = self.ref('stock.stock_location_14')
        self.warehouse = self.env.ref('stock.warehouse0')
        # setting up alternative workcenters
        self.wc_alt_1 = self.env['mrp.workcenter'].create({
            'name': 'Nuclear Workcenter bis',
            'capacity': 3,
            'time_start': 9,
            'time_stop': 5,
            'time_efficiency': 80,
        })
        self.wc_alt_2 = self.env['mrp.workcenter'].create({
            'name': 'Nuclear Workcenter ter',
            'capacity': 1,
            'time_start': 10,
            'time_stop': 5,
            'time_efficiency': 85,
        })
        self.workcenter_1.alternative_workcenter_ids = self.wc_alt_1 | self.wc_alt_2
        self.planning_bom = self.env['mrp.bom'].create({
            'product_id': self.product_4.id,
            'product_tmpl_id': self.product_4.product_tmpl_id.id,
            'product_uom_id': self.uom_unit.id,
            'product_qty': 4.0,
            'routing_id': self.routing_1.id,
            'type': 'normal',
            'bom_line_ids': [
                (0, 0, {'product_id': self.product_2.id, 'product_qty': 2}),
                (0, 0, {'product_id': self.product_1.id, 'product_qty': 4})
            ]})

    def test_planning_0(self):
        """ Test alternative conditions
        1. alternative relation is directionnal
        2. a workcenter cannot be it's own alternative """

        self.assertEqual(self.wc_alt_1.alternative_workcenter_ids, self.env['mrp.workcenter'], "Alternative workcenter is not reciprocal")
        self.assertEqual(self.wc_alt_2.alternative_workcenter_ids, self.env['mrp.workcenter'], "Alternative workcenter is not reciprocal")
        with self.assertRaises(ValidationError):
            self.workcenter_1.alternative_workcenter_ids |= self.workcenter_1

    def test_planning_1(self):
        """ Testing planning workorder with alternative workcenters
        Plan 6 times the same MO, the workorders should be split accross workcenters
        The 3 workcenters are free, this test plans 3 workorder in a row then three next.
        The workcenters have not exactly the same parameters (efficiency, start time) so the
        the last 3 workorder are not dispatched like the 3 first.
        At the end of the test, the calendars will look like:
            - calendar wc1 :[mo1  ][mo6  ]
            - calendar wc2 :[mo2 ][mo5 ]
            - calendar wc3 :[mo3][mo4]                    """
        workcenters = [self.workcenter_1, self.wc_alt_1, self.wc_alt_2]
        for i in range(3):
            # Create an MO for product4
            mo_form = Form(self.env['mrp.production'])
            mo_form.product_id = self.product_4
            mo_form.bom_id = self.planning_bom
            mo_form.product_qty = 1
            mo = mo_form.save()
            mo.action_confirm()
            mo.button_plan()
            # Check that workcenters change
            self.assertEqual(mo.workorder_ids.workcenter_id, workcenters[i], "wrong workcenter")

        for i in range(3):
            # Planning 3 more should choose workcenters in opposite order as
            # - wc_alt_2 as the best efficiency
            # - wc_alt_1 take a little less start time
            # - workcenter_1 is the worst
            mo_form = Form(self.env['mrp.production'])
            mo_form.product_id = self.product_4
            mo_form.bom_id = self.planning_bom
            mo_form.product_qty = 1
            mo = mo_form.save()
            mo.action_confirm()
            mo.button_plan()
            # Check that workcenters change
            self.assertEqual(mo.workorder_ids.workcenter_id, workcenters[::-1][i], "wrong workcenter")

    def test_planning_2(self):
        """ Plan some manufacturing orders with 2 workorders each
        Batch size of the operation will influence start dates of workorders
        The first unit to be produced can go the second workorder before finishing
        to produce the second unit.
        calendar wc1 : [q1][q2]
        calendar wc2 :     [q1][q2]"""
        self.planning_bom.routing_id = self.routing_2
        # Allow second workorder to start once the first one is not ended yet
        self.operation_2.batch = 'yes'
        self.operation_2.batch_size = 1
        self.workcenter_1.capacity = 1
        # workcenters work 24/7
        self.env['resource.calendar'].search([]).write({'attendance_ids': [(5, False, False)]})

        mo_form = Form(self.env['mrp.production'])
        mo_form.product_id = self.product_4
        mo_form.bom_id = self.planning_bom
        mo_form.product_qty = 2
        mo = mo_form.save()
        mo.action_confirm()
        plan = datetime.now()
        mo.button_plan()
        self.assertEqual(mo.workorder_ids[0].workcenter_id, self.workcenter_1, "wrong workcenter")
        self.assertEqual(mo.workorder_ids[1].workcenter_id, self.wc_alt_1, "wrong workcenter")

        duration1 = self.operation_2.time_cycle * 100 / self.workcenter_1.time_efficiency + self.workcenter_1.time_start
        duration2 = self.operation_2.time_cycle * 100 / self.wc_alt_1.time_efficiency + self.wc_alt_1.time_start + self.wc_alt_1.time_stop
        wo2_start = mo.workorder_ids[1].date_planned_start
        wo2_stop = mo.workorder_ids[1].date_planned_finished
        self.assertAlmostEqual(wo2_start, plan + timedelta(minutes=duration1), delta=timedelta(seconds=10), msg="Wrong plannification")
        self.assertAlmostEqual(wo2_stop, wo2_start + timedelta(minutes=duration2), delta=timedelta(seconds=10), msg="Wrong plannification")
