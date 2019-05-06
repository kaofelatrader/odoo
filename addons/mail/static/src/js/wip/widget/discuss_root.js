odoo.define('mail.wip.widget.DiscussRoot', function (require) {
'use strict';

const Composer = require('mail.wip.widget.Composer');
const Sidebar = require('mail.wip.widget.DiscussSidebar');
const Thread = require('mail.wip.widget.Thread');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @return {Object}
 */
function mapStateToProps(state) {
    return {
        discuss: state.discuss,
        threads: state.threads
    };
}

class Root extends Component {

    /**
     * @param  {...any} args
     */
    constructor(...args) {
        super(...args);
        this.inlineTemplate = `
<div class="o_mail_wip_discuss_root">
    <t t-widget="Sidebar"
       t-props="{ $thread }"
       t-on-select-thread="_onSelectThread"/>
    <div class="o_content">
        <t t-if="$thread">
            <t t-widget="Thread"
               t-props="{ $thread, options: threadOptions }"
               t-ref="'thread'"
               t-on-redirect="_onRedirect"/>
            <t t-if="showComposer"
               t-widget="Composer"
               t-props="{ $thread }"/>
        </t>
    </div>
</div>`;
        this.state = {
            showComposer: false,
            threadCachesInfo: {},
        };
        this.widgets = {
            Composer,
            Sidebar,
            Thread
        };
    }

    mounted() {
        this.env.store.commit('discuss/update', { open: true });
    }

    willUnmount() {
        this.env.store.commit('discuss/update', { open: false });
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {string}
     */
    get $threadCache() {
        return `${this.$thread}_${this.stringifiedDomain}`;
    }

    /**
     * @return {string}
     */
    get $thread() {
        return this.props.discuss.$thread;
    }

    /**
     * @return {boolean}
     */
    get showComposer() {
        return this.state.showComposer;
    }

    /**
     * @return {string}
     */
    get stringifiedDomain() {
        return this.props.discuss.stringifiedDomain;
    }

    /**
     * @return {mail.wip.model.Thread[]}
     */
    get threads() {
        return this.props.threads;
    }

    /**
     * @return {mail.wip.model.Thread}
     */
    get thread() {
        return this.threads[this.$thread];
    }

    /**
     * @return {Object}
     */
    get threadOptions() {
        let scrollTop;
        const threadCacheInfo = this.state.threadCachesInfo[this.$threadCache];
        if (threadCacheInfo) {
            scrollTop = threadCacheInfo.scrollTop;
        } else {
            scrollTop = undefined;
        }
        return {
            domain: this.props.discuss.domain,
            redirectAuthor: this.thread.channel_type !== 'chat',
            scrollTop,
            squashCloseMessages: this.thread._model !== 'mail.box',
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Array} domain
     */
    updateDomain(domain) {
        this.env.store.commit('discuss/update', { domain });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} param0
     * @param {integer} param0.id
     * @param {string} param0.model
     */
    _onRedirect({ id, model }) {
        if (model === 'mail.channel') {
            const channel = this.threads[`${model}_${id}`];
            if (!channel) {
                this.env.store.dispatch('channel/join', {
                    autoselect: true,
                    channelID: id,
                });
            } else {
                this.env.store.commit('discuss/update', { $thread: channel.localID });
            }
        } else if (model === 'res.partner') {
            const dm = Object.values(this.threads).find(thread =>
                thread.$directPartner === `res.partner_${id}`);
            if (!dm) {
                this.env.store.dispatch('channel/create', {
                    autoselect: true,
                    partnerID: id,
                    type: 'chat',
                });
            } else {
                this.env.store.commit('discuss/update', { $thread: dm.localID });
            }
        }
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.$thread
     */
    _onSelectThread({ $thread }) {
        // remember scroll position of current thread
        if (this.refs.thread.hasMessages) {
            this.state.threadCachesInfo[this.$threadCache] = {
                scrollTop: this.refs.thread.getScrollTop(),
            };
        }
        this.state.showComposer = this.threads[$thread]._model !== 'mail.box';
        this.env.store.commit('discuss/update', { $thread });
    }
}

return connect(mapStateToProps, { deep: false })(Root);

});
