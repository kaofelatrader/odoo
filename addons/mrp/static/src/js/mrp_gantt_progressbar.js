odoo.define('mrp.mrp_gantt_progressbar', function (require) {
'use strict';

    var GanttView = require('web_gantt.GanttView')
    var GanttRenderer = require('web_gantt.GanttRenderer');
    var viewRegistry = require('web.view_registry');

    var MrpGanttProgressbar = GanttRenderer.extend({
        /**
         * Render work order on gantt view and its rows expect which are in done and cancel state.
         *
         * @override
         */
        _renderRows: function(rows, groupedBy) {
            var self = this;
            rows.forEach(function (row) {
                row.records = _.filter(row.records, function (rec) {
                    return ['done', 'cancel'].indexOf(rec.state) == -1
                });
            });
            var rows = this._super.apply(this, arguments)
            return _.filter(rows, function (row) {
                return row.pills.length;
            });
        }
    });

    var MrpGanttView = GanttView.extend({
        config: _.extend({}, GanttView.prototype.config, {
            Renderer: MrpGanttProgressbar
        }),
    });

    viewRegistry.add('mrp_gantt_progressbar', MrpGanttView);
    return MrpGanttView;
});
