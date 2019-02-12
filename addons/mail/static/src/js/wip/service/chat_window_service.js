odoo.define('mail.wip.service.ChatWindowService', function (require) {
"use strict";

var StoreMixin = require('mail.wip.old_widget.StoreMixin');
var Root = require('mail.wip.widget.ChatWindowManager');

var AbstractService = require('web.AbstractService');
var core = require('web.core');

var _t = core._t;

var ChatWindowService =  AbstractService.extend(StoreMixin, {
    dependencies: ['store'],
    /**
     * @override {web.AbstractService}
     */
    init: function () {
        this._super.apply(this, arguments);
    },
    /**
     * @override {web.AbstractService}
     */
    async start() {
        this._super.apply(this, arguments);
        await this.awaitStore();
        const env = {
            store: this.store,
            call: (...args) => this.call(...args),
            do_action: (...args) => this.do_action(...args),
            rpc: (...args) => this._rpc(...args),
            _t,
        };
        this._root = new Root(env);
        this._root.mount(this.$el[0]); // aku todo
    },
});

// core.serviceRegistry.add('chat_window', ChatWindowService);

return ChatWindowService;

});
