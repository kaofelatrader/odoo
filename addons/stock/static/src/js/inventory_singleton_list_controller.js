odoo.define('stock.SingletonListController', function (require) {
"use strict";

var core = require('web.core');
var ListController = require('web.ListController');

var _t = core._t;

/**
 * The purpose of this override is to avoid to have two or more similar records
 * in the list view.
 *
 * It's used in quant list view, a list editable where when you create a new
 * line about a quant who already exists, we want to update the existing one
 * instead of create a new one, and then we don't want to have two similar line
 * in the list view, so we refresh it.
 */

var SingletonListController = ListController.extend({
    /**
     * @override
     */
    _confirmSave: function (id) {
        var newRecord = this.model.localData[id];
        var model = newRecord.model;
        var res_id = newRecord.res_id;

        var findSimilarRecords = function (record) {
            if ((record.groupedBy && record.groupedBy.length > 0) || record.data.length) {
                var recordsToReturn = [];
                for (var i in record.data) {
                    var foundRecords = findSimilarRecords(record.data[i]);
                    recordsToReturn = recordsToReturn.concat(foundRecords || []);
                }
                return recordsToReturn;
            } else {
                if (record.res_id === res_id && record.model === model) {
                    return [record];
                }
            }
        };

        var handle = this.model.get(this.handle);
        var similarRecords = findSimilarRecords(handle);

        if (similarRecords.length > 1) {
            var self = this;
            var prom = this.reload();
            prom.then(function () {
                // After reload the view, we notify the user and select the
                // first line, since the first line was the next line when we
                // was creating a new line.
                var notification = _t("You tried to create a record who already exists."+
                "<br/>This last one has been modified instead.");
                self.do_notify(_t("This record already exists."), notification);
                // Fixme: I target the last field to give the focus.
                // It's mainly to avoid a bug in list editable.
                // Maybe it's better to deal with the bug than add code to avoid
                // it and forget this piece of code after the bug will be fixed?
                var $td = $('.o_list_view tr.o_data_row:first-child td.o_data_cell');
                var fieldIndex = Math.max($td.length - 1, 0);
                self.renderer._selectCell(0, fieldIndex);
            });
            return prom;
        }
        else {
            return this._super(id);
        }
    },
});

return SingletonListController;

});
