odoo.define('mail.wip.service.Store', function (require) {
"use strict";

const Partner = require('mail.wip.model.Partner');
const actions = require('mail.wip.store.actions');
const mutations = require('mail.wip.store.mutations');

const AbstractService = require('web.AbstractService');
const core = require('web.core');

const { Store } = owl;

const DEBUG = true;
const _t = core._t;

function initializeState() {
    const odoobot = new Partner({ id: 'odoobot', name: _t("OdooBot") });

    return {
        $pinnedThreads: [],
        FETCH_LIMIT: 30, // max number of fetched messages from the server
        cannedResponses: {},
        commands: {},
        discuss: {
            $thread: 'mail.box_inbox',
            domain: [],
            isOpen: false,
            menu_id: undefined,
            stringifiedDomain: '[]',
        },
        isMyselfModerator: false,
        mailFailures: {},
        messages: {},
        moderatedChannelIDs: [],
        outOfFocusUnreadMessageCounter: 0, // # of message received when odoo is out of focus
        partners: { odoobot }, // all partner infos
        pinnedDmPartnerIDs: [], // partner_ids we have a pinned DM chat with
        threadCaches: {},
        threads: {} // all threads, including channels, DM, mailboxes, document threads, ...
    };
}

const StoreService = AbstractService.extend({
    dependencies: ['ajax', 'bus_service', 'local_storage'],
    /**
     * @override {web.AbstractService}
     */
    init() {
        this._super.apply(this, arguments);
        let env = {
            _t,
            call: (...args) => this.call(...args),
            do_notify: (...args) => this.do_notify(...args),
            rpc: (...args) => this._rpc(...args),
        };
        this.store = new Store({
            actions,
            env,
            mutations,
            state: initializeState()
        });
        if (DEBUG) {
            window.store = this.store;
        }
    },
    /**
     * @override {web.AbstractService}
     */
    start() {
        this.ready = new Promise(resolve =>
            this.store.dispatch('init', { ready: resolve })
        );
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @return {Promise<mail.wip.Store>}
     */
    async get() {
        await this.ready;
        return this.store;
    }
});

core.serviceRegistry.add('store', StoreService);

return StoreService;

});
