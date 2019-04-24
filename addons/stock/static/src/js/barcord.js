odoo.define('stock.barcord', function (require) {
'use strict';

var KanbanRecord = require('web.KanbanRecord');

KanbanRecord.include({
    _openRecord: function () {
        self = this;
        if (this.modelName === 'stock.inventory') {
            this.do_action ({
                type: 'ir.actions.client',
                tag: 'stock_barcode_inventory_client_action',
                params: {
                            'model': 'stock.inventory',
                            'inventory_id': this.record.id.raw_value,
                        }
            });
        } else {
            this._super.apply(this, arguments);
        }
    }
});
});
