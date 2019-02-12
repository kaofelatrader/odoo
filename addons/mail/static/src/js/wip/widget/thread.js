odoo.define('mail.wip.widget.Thread', function (require) {
'use strict';

const MessageList = require('mail.wip.widget.MessageList');

const { Component, connect } = owl;

function mapStateToProps(state, ownProps) {
    const $threadCache = `${ownProps.$thread}_${ownProps.stringifiedDomain || '[]'}`;
    const threadCache = state.threadCaches[$threadCache];
    return {
        $threadCache,
        threadCache,
    };
}

class Thread extends Component {

    constructor(...args) {
        super(...args);
        this.inlineTemplate = `
<div class="o_thread">
    <div t-if="loading" class="o_thread_loading">
        <span><i aria-label="Loading..." class="o_icon fa fa-spinner fa-spin" role="img" title="Loading..."/>Loading messages...</span>
    </div>
    <div t-elif="!hasMessages" class="o_empty">
        There are no messages in this conversation.
    </div>
    <t t-else=""
       t-widget="MessageList"
       t-props="{ $thread, $threadCache, domain, stringifiedDomain }"
       t-ref="'messageList'"
       t-on-redirect="_onRedirect"/>
</div>`;
        this.state = { $loadingThreadCache: null };
        this.widgets = { MessageList };
        this._$renderedThreadCache = null;
    }

    mounted() {
        if (!this.loaded) {
            this._loadThread();
        }
        this._$renderedThreadCache = this.$threadCache;
    }

    patched() {
        if (this.loading && this.loaded) {
            this.loading = false;
            return;
        }
        if (!this.loading && !this.loaded) {
            this._loadThread();
        }
        if (this.loading) {
            return;
        }
        if (this.loaded && this.hasMessages) {
            if (this.scrollTop !== undefined) {
                this.refs.messageList.scrollTop = this.scrollTop;
            } else if (this._$renderedThreadCache !== this.$threadCache) {
                this.refs.messageList.scrollToLastMessage();
            }
        }
        this._$renderedThreadCache = this.$threadCache;
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {string}
     */
    get $thread() {
        return this.props.$thread;
    }

    /**
     * @return {string}
     */
    get $threadCache() {
        return this.props.$threadCache;
    }

    /**
     * @return {Array}
     */
    get domain() {
        return this.props.domain;
    }

    /**
     * @return {boolean}
     */
    get hasMessages() {
        return (
            (this.threadCache && this.threadCache.$messages.length > 0) || false
        );
    }

    /**
     * @return {boolean}
     */
    get loaded() {
        return (this.threadCache && this.threadCache.loaded) || false;
    }

    /**
     * @return {boolean}
     */
    get loading() {
        return this.state.$loadingThreadCache === this.$threadCache;
    }

    /**
     * @return {integer}
     */
    get scrollTop() {
        return this.props.scrollTop;
    }

    /**
     * @return {string}
     */
    get stringifiedDomain() {
        return this.props.stringifiedDomain;
    }

    /**
     * @return {mail.wip.model.ThreadCache}
     */
    get threadCache() {
        return this.props.threadCache;
    }

    /**
     * @param {any} val either truthy or falsy
     */
    set loading(val) {
        this.state.$loadingThreadCache = val ? this.$threadCache : null;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @return {integer}
     */
    getScrollTop() {
        return this.refs.messageList.scrollTop;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _loadThread() {
        this.loading = true;
        this.env.store.dispatch('thread/load', {
            $thread: this.$thread,
            searchDomain: this.domain,
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onRedirect({ id, model }) {
        this.trigger('redirect', { id, model });
    }
}

return connect(mapStateToProps, { deep: false })(Thread);

});
