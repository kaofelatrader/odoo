odoo.define('mail.wip.widget.DiscussSidebarItem', function (require) {
'use strict';

const EditableText = require('mail.wip.widget.EditableText');

const Dialog = require('web.Dialog');

const { Component, connect } = owl;

/**
 * @param {Object} state
 * @param {Object} ownProps
 * @param {string} ownProps.$thread
 * @return {Object}
 */
function mapStateToProps(state, ownProps) {
    let res = {};
    const thread = state.threads[ownProps.$thread];
    Object.assign(res, { thread });
    if (thread.channel_type === 'chat') {
        Object.assign(res, {
            directPartner: state.partners[thread.$directPartner],
        });
    }
    return res;
}

class DiscussSidebarItem extends Component {

    /**
     * @param  {...any} args
     */
    constructor(...args) {
        super(...args);
        this.inlineTemplate = `
        <div class="o_item"
             t-att-data-thread-local-id="$thread"
             t-on-click="_onClick">
            <div class="o_active_indicator" t-att-class="isActive ? 'o_active' : ''"/>
            <div class="o_icon">
                <t t-if="thread.channel_type === 'channel'">
                    <div t-if="thread.public === 'private'" class="fa fa-lock"/>
                    <div t-else="" class="fa fa-hashtag"/>
                </t>
                <t t-elif="thread.channel_type === 'chat'">
                    <div t-if="directPartner.im_status === 'online'"
                         class="fa fa-circle o_online" title="Online"/>
                    <div t-elif="directPartner.im_status === 'offline'"
                         class="fa fa-circle-o o_offline" title="Offline"/>
                    <div t-elif="directPartner.im_status === 'away'"
                         class="fa fa-circle o_away" title="Away"/>
                    <div t-elif="thread.$typingMembers.includes(thread.$directPartner)"
                         class="o_typing" title="Is typing...">
                        <span class="o_dot"/>
                        <span class="o_dot"/>
                        <span class="o_dot"/>
                    </div>
                </t>
                <t t-elif="thread._model === 'mail.box'">
                    <div t-if="thread.localID === 'mail.box_inbox'" class="fa fa-inbox"/>
                    <div t-elif="thread.localID === 'mail.box_starred'" class="fa fa-star-o"/>
                    <div t-elif="thread.localID === 'mail.box_moderation'" class="fa fa-envelope"/>
                </t>
            </div>
            <div t-if="thread.channel_type === 'chat' and state.renaming" class="o_editable_name">
                <t t-widget="EditableText"
                   t-props="{ placeholder: directPartner.name, value: name }"
                   t-on-cancel="_onCancelRenaming"
                   t-on-validate="_onRename"/>
            </div>
            <div t-else=""
                 class="o_name"
                 t-att-class="thread.message_unread_counter > 0 ? 'o_unread' : ''">
                <t t-esc="name"/>
            </div>
            <div class="o_autogrow"/>
            <div t-if="thread._model !== 'mail.box'"
                 class="o_commands">
                <t t-if="thread.channel_type === 'channel'">
                    <div class="o_settings o_command fa fa-cog"
                        aria-label="Channel settings"
                        role="img"
                        title="Channel settings"
                        t-on-click="_onClickSettings"/>
                    <div t-if="!thread.message_needaction_counter"
                        class="o_leave o_command fa fa-times"
                        aria-label="Leave this channel"
                        role="img"
                        title="Leave this channel"
                        t-on-click="_onClickLeave"/>
                </t>
                <t t-elif="thread.channel_type === 'chat'">
                    <div class="o_rename o_command fa fa-cog"
                         aria-label="Rename conversation"
                         role="img"
                         title="Rename conversation"
                         t-on-click="_onClickRename"/>
                    <div t-if="!thread.message_unread_counter"
                         class="o_unpin o_command fa fa-times"
                         aria-label="Unpin conversation"
                         role="img"
                         title="Unpin conversation"
                         t-on-click="_onClickUnpin"/>
                </t>
            </div>
            <div t-if="counter > 0" class="o_counter badge badge-pill">
                <t t-esc="counter"/>
            </div>
        </div>`;
        this.state = { renaming: false };
        this.widgets = { EditableText };
    }

    /**
     * @return {string}
     */
    get $thread() {
        return this.props.$thread;
    }

    /**
     * @return {integer}
     */
    get counter() {
        if (this.thread._model === 'mail.box') {
            return this.thread.counter;
        } else if (this.thread.channel_type === 'channel') {
            return this.thread.message_needaction_counter;
        } else if (this.thread.channel_type === 'chat') {
            return this.thread.message_unread_counter;
        }
        return 0;
    }

    /**
     * @return {mail.wip.model.partner|undefined}
     */
    get directPartner() {
        return this.props.directPartner;
    }

    /**
     * @return {boolean}
     */
    get isActive() {
        return this.props.isActive;
    }

    /**
     * @return {string}
     */
    get name() {
        if (this.thread.channel_type === 'chat') {
            return this.thread.custom_channel_name || this.directPartner.name;
        }
        return this.thread.name;
    }

    /**
     * @return {mail.wip.model.Thread}
     */
    get thread() {
        return this.props.thread;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @return {Promise}
     */
    _askAdminConfirmation() {
        return new Promise(resolve => {
            Dialog.confirm(
                this,
                this.env._t("You are the administrator of this channel. Are you sure you want to leave?"),
                {
                    buttons: [
                        {
                            text: this.env._t("Leave"),
                            classes: 'btn-primary',
                            close: true,
                            click: resolve
                        },
                        {
                            text: this.env._t("Discard"),
                            close: true
                        }
                    ]
                }
            );
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onCancelRenaming() {
        this.state.renaming = false;
    }

    /**
     * @private
     */
    _onClick() {
        this.trigger('click', { $thread: this.$thread });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickLeave(ev) {
        ev.stopPropagation();
        let prom;
        if (this.thread.create_uid === this.env.session.uid) {
            prom = this._askAdminConfirmation();
        } else {
            prom = Promise.resolve();
        }
        return prom.then(() =>
            this.env.store.dispatch('channel/unsubscribe', { $thread: this.$thread }));
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickRename(ev) {
        ev.stopPropagation();
        this.state.renaming = true;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickSettings(ev) {
        ev.stopPropagation();
        return this.env.do_action({
            type: 'ir.actions.act_window',
            res_model: this.thread._model,
            res_id: this.thread.id,
            views: [[false, 'form']],
            target: 'current'
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickUnpin(ev) {
        ev.stopPropagation();
        return this.env.store.dispatch('channel/unsubscribe', { $thread: this.$thread });
    }

    /**
     * @private
     * @param {Object} param0
     * @param {string} param0.newName
     */
    _onRename({ newName }) {
        this.state.renaming = false;
        this.env.store.dispatch('thread/rename', {
            $thread: this.$thread,
            name: newName
        });
    }
}

return connect(mapStateToProps, { deep: false })(DiscussSidebarItem);

});
