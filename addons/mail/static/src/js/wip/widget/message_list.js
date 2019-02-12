odoo.define('mail.wip.widget.MessageList', function (require) {
'use strict';

const Message = require('mail.wip.widget.Message');

const { Component, connect } = owl;

function mapStateToProps(state, ownProps) {
    const threadCache = state.threadCaches[ownProps.$threadCache];
    // aku todo: already sort message local IDs in store
    const messages = threadCache
        ? threadCache.$messages
              .slice(0)
              .sort(($msg1, $msg2) => {
                  let msg1 = state.messages[$msg1];
                  let msg2 = state.messages[$msg2];
                  return msg1.id > msg2.id ? 1 : -1;
              })
              .map($message => state.messages[$message])
        : [];
    return {
        messages,
        partners: state.partners,
        thread: state.threads[ownProps.$thread],
        threadCache,
    };
}

class MessageList extends Component {
    constructor(...args) {
        super(...args);
        this.inlineTemplate = `
<div class="o_message_list"
     t-on-scroll="_onScroll">
    <div t-if="loadingMore"
         class="o_loading_more"
         t-key="'loading'">
        <i class="o_icon fa fa-spinner fa-spin"/>Loading...
    </div>
    <div t-elif="!threadCache.allHistoryLoaded"
         class="o_load_more"
         t-key="'load_more'"
         t-on-click="_onClickLoadMore"
         t-ref="'loadMore'">
        Load more
    </div>
    <t t-set="current_day" t-value="0"/>
    <t t-set="prev_message" t-value="0"/>
    <t t-if="thread._model === 'mail.channel' and thread.message_unread_counter > 0 and !thread.seen_message_id">
        <div class="o_separator o_new_messages">
            <span class="o_label">New messages</span>
        </div>
    </t>
    <t t-foreach="messages" t-as="message">
        <t t-set="message_day" t-value="getDateDay(message)"/>
        <div t-if="current_day !== message_day" class="o_separator o_date">
            <hr class="o_line"/><span class="o_label"><t t-esc="message_day"/></span><hr class="o_line"/>
            <t t-set="current_day" t-value="message_day"/>
            <t t-set="squashed" t-value="false"/>
        </div>
        <t t-else="">
            <t t-set="squashed" t-value="shouldSquash(prev_message, message)"/>
        </t>
        <t t-set="$message" t-value="message.localID"/>
        <t t-widget="Message"
           t-props="{ $message, $thread, squashed }"
           t-key="$message"
           t-ref="$message"
           t-on-redirect="_onRedirect"/>
        <t t-set="prev_message" t-value="message"/>
        <t t-if="thread._model === 'mail.channel' and thread.message_unread_counter > 0 and thread.seen_message_id === message.id">
            <div class="o_separator o_new_messages">
                <hr class="o_line"/><span class="o_label">New messages</span>
            </div>
        </t>
    </t>
</div>`;
        this.state = {
            $loadingMoreThreadCache: null,
            loadingMoreMessageCount: 0
        };
        this.widgets = { Message };
        this._$renderedThreadCache = null;
        this._autoLoadOnScroll = true;
        this._onScroll = _.throttle(this._onScroll.bind(this), 100);
    }

    mounted() {
        this._$renderedThreadCache = this.$threadCache;
    }

    /**
     * @return {Object} snapshot object
     */
    willPatch() {
        let snapshot = {};
        if (
            this.loadingMore &&
            this.loadingMoreMessageCount !== this.messages.length
        ) {
            Object.assign(snapshot, {
                scrollHeight: this.el.scrollHeight,
                scrollTop: this.el.scrollTop
            });
        } else {
            snapshot.scrollToLastMessage =
                this._$renderedThreadCache === this.$threadCache &&
                this.lastMessageRef.bottomVisible;
        }
        return snapshot;
    }

    /**
     * @param {Object} snapshot
     * @param {integer} [snapshot.scrollHeight]
     * @param {boolean} [snapshot.scrollToLastMessage=false]
     * @param {integer} [snapshot.scrollTop]
     */
    patched(snapshot) {
        if ('scrollTop' in snapshot) {
            this.scrollTop =
                this.el.scrollHeight -
                snapshot.scrollHeight +
                snapshot.scrollTop;
            if (this.loadingMore) {
                this.loadingMore = false;
            }
        } else if (snapshot.scrollToLastMessage) {
            this._autoLoadOnScroll = false;
            this.lastMessageRef
                .scrollToVisibleBottom()
                .then(() => {
                    this._autoLoadOnScroll = true;
                    this._onScroll();
                });
        }
        this._$renderedThreadCache = this.$threadCache;
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {string}
     */
    get $loadingMoreThreadCache() {
        return this.state.loadingMoreThreadCache;
    }

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
     * @return {mail.wip.widget.Message}
     */
    get lastMessageRef() {
        let { length: l, [l - 1]: lastMessageRef } = this.messageRefs;
        return lastMessageRef;
    }

    /**
     * @return {boolean}
     */
    get loadingMore() {
        return this.$loadingMoreThreadCache === this.$threadCache;
    }

    /**
     * @return {integer}
     */
    get loadingMoreMessageCount() {
        return this.state.loadingMoreMessageCount;
    }

    /**
     * @return {boolean}
     */
    get loadMoreVisible() {
        const loadMore = this.refs.loadMore;
        if (!loadMore) {
            return false;
        }
        const loadMoreRect = loadMore.getBoundingClientRect();
        const elRect = this.el.getBoundingClientRect();
        // intersection with 10px offset
        return (
            loadMoreRect.top < elRect.bottom + 10 &&
            elRect.top < loadMoreRect.bottom + 10
        );
    }

    /**
     * @return {mail.wip.widget.Message[]}
     */
    get messageRefs() {
        return Object.entries(this.refs)
            .filter(([refID, ref]) => refID.indexOf('mail.message') !== -1)
            .map(([refID, ref]) => ref)
            .sort((ref1, ref2) => (ref1.message.id < ref2.message.id ? -1 : 1));
    }

    /**
     * @return {mail.wip.model.Message[]}
     */
    get messages() {
        return this.props.messages;
    }

    /**
     * @return {integer}
     */
    get scrollTop() {
        return this.el.scrollTop;
    }

    /**
     * @return {mail.wip.model.Thread}
     */
    get thread() {
        return this.props.thread;
    }

    /**
     * @return {mail.wip.model.ThreadCache|undefined}
     */
    get threadCache() {
        return this.props.threadCache;
    }

    /**
     * @param {any} val based on truthy/falsy
     */
    set loadingMore(val) {
        if (val) {
            Object.assign(this.state, {
                $loadingMoreThreadCache: this.$threadCache,
                loadingMoreMessageCount: this.messages.length
            });
        } else {
            Object.assign(this.state, {
                $loadingMoreThreadCache: null,
                loadingMoreMessageCount: 0
            });
        }
    }

    /**
     * @param {integer} val
     */
    set scrollTop(val) {
        this.el.scrollTop = val;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {mail.wip.model.Message} message
     * @return {string}
     */
    getDateDay(message) {
        var date = moment(message._date).format('YYYY-MM-DD');
        if (date === moment().format('YYYY-MM-DD')) {
            return this.env._t("Today");
        } else if (
            date === moment()
                .subtract(1, 'days')
                .format('YYYY-MM-DD')
        ) {
            return this.env._t("Yesterday");
        }
        return moment(message._date).format('LL');
    }

    /**
     * @return {Promise}
     */
    scrollToLastMessage() {
        if (!this.messages.length) {
            return Promise.resolve();
        }
        this._autoLoadOnScroll = false;
        return this.lastMessageRef.scrollToVisibleBottom().then(() => {
            this._autoLoadOnScroll = true;
        });
    }

    /**
     * @param {mail.wip.model.Message} prevMessage
     * @param {mail.wip.model.Message} message
     * @return {boolean}
     */
    shouldSquash(prevMessage, message) {
        const prevDate = moment(prevMessage._date);
        const date = moment(message._date);
        if (Math.abs(date.diff(prevDate)) > 60000) {
            // more than 1 min. elasped
            return false;
        }
        if (prevMessage.message_type !== 'comment' || message.message_type !== 'comment') {
            return false;
        }
        if (prevMessage.$author !== message.$author) {
            // from a different author
            return false;
        }
        if (prevMessage.$origin !== message.$origin) {
            return false;
        }
        const prevOrigin = this.env.store.state.threads[prevMessage.$origin];
        const origin = this.env.store.state.threads[message.$origin];
        if (
            prevOrigin && origin &&
            prevOrigin._model === origin._model &&
            origin._model !== 'mail.channel' &&
            prevOrigin.id !== origin.model
        ) {
            // messages linked to different document thread
            return false;
        }
        return true;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _loadMore() {
        this.loadingMore = true;
        this.env.store.dispatch('thread/load_more', {
            $thread: this.$thread,
            searchDomain: this.domain,
        });
    }

    _markAsSeen() {
        this.env.store.dispatch('thread/mark_as_seen', { $thread: this.$thread });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onClickLoadMore() {
        this._loadMore();
    }

    _onRedirect({ id, model }) {
        this.trigger('redirect', { id, model });
    }

    _onScroll() {
        if (!this.el) {
            // could be unmounted in the meantime (due to throttled behavior)
            return;
        }
        if (!this._autoLoadOnScroll) {
            return;
        }
        if (this.loadMoreVisible) {
            this._loadMore();
        }
        if (
            this.props.stringifiedDomain === "[]" &&
            this.lastMessageRef.partiallyVisible
        ) {
            this._markAsSeen();
        }
    }
}

return connect(mapStateToProps, { deep: false })(MessageList);

});
