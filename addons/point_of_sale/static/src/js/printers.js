odoo.define('point_of_sale.Printer', function (require) {
"use strict";

var core = require('web.core');
var _t = core._t;

return core.Class.extend({
    init: function (proxy) {
        var self = this;
        this.receipt_queue = [];
        this.proxy = proxy;
        this.proxy.on('change:status', this, function (eh, status) {
            status = status.newValue;
            if (status.status === 'connected') {
                self.print_receipt();
            }
        });
    },

    /**
     * Updates the status of the printer
     */
    get_current_status: function () {
        var self = this;
        this.proxy.message('default_printer_status', {})
            .then(function (status) {
                self.proxy.set_driver_connection_status(status, 'printer');
            });
    },

    /**
     * Sends a command to the connected proxy to open the cashbox
     * (the physical box where you store the cash). Updates the status of
     * the printer with the answer from the proxy.
     */
    open_cashbox: function () {
        var self = this;
        return this.proxy.message('default_printer_action', {
            data: {
                action: 'cashbox',
            }
        }, {timeout: 5000}).then(function (status) {
            self.proxy.set_driver_connection_status(status, 'printer');
        });
    },

    /**
     * Add the receipt to the queue of receipts to be printed and process it.
     * @param {String} receipt: The receipt to be printed, in HTML
     */
    print_receipt: function (receipt) {
        var self = this;
        if (receipt) {
            this.receipt_queue.push(receipt);
        }
        function process_next_job() {
            if (self.receipt_queue.length > 0) {
                var r = self.receipt_queue.shift();
                self.send_printing_job(r)
                    .then(function () {
                        process_next_job();
                    }, function (error) {
                            if (error) {
                            self.proxy.pos.gui.show_popup('error-traceback', {
                                'title': _t('Printing Error: ') + error.data.message,
                                'body': error.data.debug,
                            });
                            return;
                        }
                        self.receipt_queue.unshift(r);
                    });
            }
        }
        process_next_job();
    },

    /**
     * Sends the printing command the connected proxy and updates the status of
     * the printer with the answer from the proxy.
     * @param {String} receipt : The receipt to be printed, in HTML
     */
    send_printing_job: function (receipt) {
        var self = this;
        return this.proxy.message('default_printer_action', {
            data: {
                action: 'html_receipt',
                receipt: receipt,
            }
        }, {timeout: 5000}).then(function (status) {
            self.proxy.set_driver_connection_status(status, 'printer');
        });
    },
});
});
