odoo.define('mail.wip.old_widget.Discuss', function (require) {
"use strict";

const StoreMixin = require('mail.wip.old_widget.StoreMixin');
const Root = require('mail.wip.widget.DiscussRoot');

const AbstractAction = require('web.AbstractAction');
const core = require('web.core');
const session = require('web.session');

const _t = core._t;

const { QWeb } = owl;

const Discuss = AbstractAction.extend(StoreMixin, {
    DEBUG: true,
    template: 'mail.wip.Discuss',
    hasControlPanel: true,
    loadControlPanel: true,
    withSearchBar: true,
    searchMenuTypes: ['filter', 'favorite'],
    custom_events: {
        search: '_onSearch',
    },
    /**
     * @override {web.AbstractAction}
     */
    init: function () {
        this._super.apply(this, arguments);

        this.controlPanelParams.modelName = 'mail.message';
        this.root = undefined;

        if (this.DEBUG) {
            window.discuss = this;
        }
    },
    /**
     * @override {web.AbstractAction}
     * @return {Promise}
     */
    willStart: function () {
        return Promise.all([this._super.apply(this, arguments), this.awaitStore()]);
    },
    /**
     * @override {web.AbstractAction}
     */
    destroy: function () {
        if (this.root) {
            this.root.destroy();
        }
        this._super.apply(this, arguments);
    },
    /**
     * @override {web.AbstractAction}
     */
    on_attach_callback() {
        this._super.apply(this, arguments);
        if (this.root) {
            // prevent twice call to on_attach_callback (AKU FIXME)
            return;
        }
        if (!this.store) {
            throw new Error('[discuss] not yet store awaited...');
        }
        const env = {
            qweb: new QWeb(),
            session,
            store: this.store,
            call: (...args) => this.call(...args),
            do_action: (...args) => this.do_action(...args),
            rpc: (...args) => this._rpc(...args),
            _t,
        };
        this.root = new Root(env);
        this.root.mount(this.$el[0]);
    },
    /**
     * @override {web.AbstractAction}
     */
    on_detach_callback: function () {
        this._super.apply(this, arguments);
        if (this.root) {
            this.root.destroy();
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {OdooEvent} ev
     * @param {Array} ev.data.domain
     */
    _onSearch(ev) {
        ev.stopPropagation();
        this.root.updateDomain(ev.data.domain);
    },
});

core.action_registry.add('mail.wip.discuss', Discuss);

return Discuss;

});
