odoo.define('mail.wip.widget.Message', function (require) {
'use strict';

const mailUtils = require('mail.utils');

const time = require('web.time');

const { Component, connect } = owl;

function mapStateToProps(state, ownProps) {
    const message = state.messages[ownProps.$message];
    return {
        author: message.$author ? state.partners[message.$author] : undefined,
        message,
        odoobot: state.partners.odoobot,
        origin: state.threads[message.$origin] || undefined,
        thread: state.threads[ownProps.$thread],
    };
}

class Message extends Component {

    constructor(...args) {
        super(...args);
        this.inlineTemplate = `
<div class="o_message"
     t-attf-class="{{ toggledClick ? 'o_toggled_click' : '' }} {{ isStarred ? 'o_starred' : '' }} {{ options.squashed ? 'o_squashed' : '' }}"
     t-on-click="_onClick"
     t-att-data-message-local-id="$message">
    <t t-if="options.squashed">
        <div class="o_sidebar o_squashed">
            <div class="o_date">
                <t t-esc="shortTime"/>
            </div>
            <div class="o_commands">
                <div class="o_star o_command"
                     t-att-class="isStarred ? 'o_starred fa fa-star' : 'fa fa-star-o'"
                     t-on-click="_onClickStar"/>
            </div>
        </div>
        <div class="o_core">
            <div class="o_content">
                <t t-raw="message.body"/>
            </div>
        </div>
    </t>
    <t t-else="">
        <div class="o_sidebar">
            <img alt=""
                 class="rounded-circle"
                 t-attf-class="{{ redirectAuthor ? 'o_redirect' : '' }}"
                 t-att-src="avatar"
                 t-on-click="_onClickAuthor"/>
        </div>
        <div class="o_core">
            <div class="o_header">
                <div class="o_author_name"
                     t-attf-class="{{ redirectAuthor ? 'o_redirect' : '' }}"
                     t-on-click="_onClickAuthor">
                    <t t-esc="displayedAuthorName"/>
                </div>
                <div class="o_date" t-att-title="datetime">
                    - <t t-esc="timeElapsed"/>
                </div>
                <div t-if="hasDifferentOrigin" class="o_origin">
                    <t t-if="origin._model === 'mail.channel'">
                        (from <a href="#" t-on-click="_onClickOrigin">#<t t-esc="origin.name"/></a>)
                    </t>
                    <t t-else="">
                        on <a href="#" t-on-click="_onClickOrigin"><t t-esc="origin.name"/></a>
                    </t>
                </div>
                <div class="o_commands">
                    <div class="o_star o_command"
                         t-att-class="isStarred ? 'o_starred fa fa-star' : 'fa fa-star-o'"
                         t-on-click="_onClickStar"/>
                </div>
            </div>
            <div class="o_content">
                <t t-raw="message._body"/>
            </div>
        </div>
    </t>
</div>`;
        this.state = {
            timeElapsed: mailUtils.timeFromNow(this.message._date),
            toggledClick: false
        };
        this._intervalID = undefined;
    }

    willUnmount() {
        clearInterval(this._intervalID);
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {string}
     */
    get $message() {
        return this.props.$message;
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
    get author() {
        return this.props.author;
    }

    /**
     * @return {string}
     */
    get avatar() {
        if (this.author && this.author === this.odoobot) {
            return '/mail/static/src/img/odoobot.png';
        } else if (this.author) {
            return `/web/image/res.partner/${this.author.id}/image_small`;
        } else if (this.message.message_type === 'email') {
            return '/mail/static/src/img/email_icon.png';
        }
        return '/mail/static/src/img/smiley/avatar.jpg';
    }

    /**
     * @return {boolean}
     */
    get bottomVisible() {
        const elRect = this.el.getBoundingClientRect();
        if (!this.el.parent) {
            return false;
        }
        const parentRect = this.el.parentNode.getBoundingClientRect();
        // bottom with (double) 5px offset
        return (
            elRect.bottom < parentRect.bottom + 5 &&
            parentRect.top < elRect.bottom + 5
        );
    }

    /**
     * @return {string}
     */
    get datetime() {
        return this.message._date.format(time.getLangDatetimeFormat());
    }

    /**
     * @return {string}
     */
    get displayedAuthorName() {
        if (this.author) {
            return this.author.name;
        }
        return this.message.email_from || this.env._t("Anonymous");
    }

    /**
     * @return {boolean}
     */
    get hasDifferentOrigin() {
        return this.origin && this.origin !== this.thread;
    }

    /**
     * @return {boolean}
     */
    get isStarred() {
        return this.message.starred_partner_ids &&
            this.message.starred_partner_ids.includes(this.env.session.partner_id);
    }

    /**
     * @return {mail.wip.model.Message}
     */
    get message() {
        return this.props.message;
    }

    /**
     * @return {mail.wip.model.Partner}
     */
    get odoobot() {
        return this.props.odoobot;
    }

    /**
     * @return {Object}
     */
    get options() {
        return this.props.options || {};
    }

    /**
     * @return {string|undefined}
     */
    get origin() {
        return this.props.origin;
    }

    /**
     * @return {boolean}
     */
    get partiallyVisible() {
        const elRect = this.el.getBoundingClientRect();
        if (!this.el.parentNode) {
            return false;
        }
        const parentRect = this.el.parentNode.getBoundingClientRect();
        // intersection with 5px offset
        return (
            elRect.top < parentRect.bottom + 5 &&
            parentRect.top < elRect.bottom + 5
        );
    }

    /**
     * @return {boolean}
     */
    get redirectAuthor() {
        if (!this.options.redirectAuthor) {
            return false;
        }
        if (!this.author) {
            return false;
        }
        if (this.author.id === this.env.session.partner_id) {
            return false;
        }
        return true;
    }

    /**
     * @return {string}
     */
    get shortTime() {
        return this.message._date.format('hh:mm');
    }

    /**
     * @return {mail.wip.model.Thread}
     */
    get thread() {
        return this.props.thread;
    }

    /**
     * @return {string}
     */
    get timeElapsed() {
        clearInterval(this._intervalID);
        this._intervalID = setInterval(() => {
            this.state.timeElapsed = mailUtils.timeFromNow(this.message._date);
        }, 60 * 1000);
        return this.state.timeElapsed;
    }

    /**
     * @return {boolean}
     */
    get toggledClick() {
        return this.state.toggledClick;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Object} [param0={}]
     * @param {string} [param0.behavior='auto']
     * @return {Promise}
     */
    scrollToVisibleBottom({ behavior='auto' }={}) {
        this.el.scrollIntoView({
            behavior,
            block: 'end',
            inline: 'nearest',
        });
        if (behavior === 'smooth') {
            return new Promise(resolve => setTimeout(resolve, 500));
        } else {
            return Promise.resolve();
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onClick() {
        this.state.toggledClick = !this.toggledClick;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickAuthor(ev) {
        ev.preventDefault();
        if (!this.options.redirectAuthor) {
            return;
        }
        if (!this.author) {
            return;
        }
        this.trigger('redirect', {
            id: this.author.id,
            model: 'res.partner', // === this.author._model
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickOrigin(ev) {
        ev.preventDefault();
        this.trigger('redirect', {
            id: this.origin.id,
            model: this.origin._model,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickStar(ev) {
        ev.stopPropagation();
        return this.env.store.dispatch('message/toggle_star', { $message: this.$message });
    }
}

return connect(mapStateToProps, { deep: false })(Message);

});
