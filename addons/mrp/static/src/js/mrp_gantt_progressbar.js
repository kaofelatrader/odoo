odoo.define('mrp.mrp_gantt_progressbar', function (require) {
'use strict';

var GanttRenderer = require('web_gantt.GanttRenderer');

var MrpGanttProgressbar = GanttRenderer.extend({ 
    /**
     * Render work order on gantt view and its rows expect which are in done and cancel state.
     *
     * @override
     */
    _renderRows: function(rows, groupedBy) {
        var self = this;
        rows.forEach(function (row) {
            row.records = _.filter(row.records, function(rec) {
                if (rec.state == 'done' || rec.state == 'cancel'){
                    return false;
                } else {
                    return true;
                }
            });
        });
        var rows = _.filter(rows, function (row) {
            if (row.records.length){
                return true;
            }
        });
        this._super.apply(this, arguments);;
    }
});
});
