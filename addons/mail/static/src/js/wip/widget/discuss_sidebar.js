odoo.define('mail.wip.widget.DiscussSidebar', function (require) {
'use strict';

const AutocompleteInput = require('mail.wip.widget.AutocompleteInput');
const SidebarItem = require('mail.wip.widget.DiscussSidebarItem');

const { Component, connect } = owl;

function mapStateToProps(state) {
    return {
        threads: state.threads
    };
}

class Sidebar extends Component {

    constructor(...args) {
        super(...args);
        this.inlineTemplate = `
<div class="o_sidebar">
    <div class="o_mailbox o_group">
        <t t-foreach="mailboxes" t-as="mailbox">
            <t t-widget="SidebarItem"
               t-props="{ $thread: mailbox.localID, isActive: $thread === mailbox.localID }"
               t-on-click="_onClickItem"
               t-key="mailbox.localID"/>
        </t>
    </div>
    <hr class="o_separator"/>
    <div class="o_channel o_group">
        <div class="o_header">
            <div class="o_title o_clickable"
                 t-on-click="_onClickChannelTitle">
                Channels
            </div>
            <div class="o_autogrow"/>
            <div class="o_add fa fa-plus"
                 title="Add or join a channel"
                 t-on-click="_onClickChannelAdd"/>
        </div>
        <div class="o_list">
            <div t-if="state.isAddingChannel"
                 class="o_item o_add"
                 t-key="'add_item_channel'">
                <t t-widget="AutocompleteInput"
                   t-props="{ html: true, source: _onChannelAutocompleteSource }"
                   t-on-select="_onChannelAutocompleteSelect"
                   t-on-hide="_onHideAddChannel"/>
            </div>
            <t t-foreach="channels" t-as="channel">
                <t t-widget="SidebarItem"
                   t-props="{ $thread: channel.localID, isActive: $thread === channel.localID }"
                   t-on-click="_onClickItem"
                   t-key="channel.localID"/>
            </t>
        </div>
    </div>
    <div class="o_dm o_group">
        <div class="o_header">
            <div class="o_title">
                Direct Messages
            </div>
            <div class="o_autogrow"/>
            <div class="o_add fa fa-plus"
                 title="Start a conversation"
                 t-on-click="_onClickDmAdd"/>
        </div>
        <div class="o_list">
            <div t-if="state.isAddingDm"
                 class="o_item o_add"
                 t-key="'add_item_dm'">
                <t t-widget="AutocompleteInput"
                   t-props="{ source: _onDmAutocompleteSource }"
                   t-on-hide="_onHideAddDm"
                   t-on-select="_onDmAutocompleteSelect"/>
            </div>
            <t t-foreach="dms" t-as="dm">
                <t t-widget="SidebarItem"
                   t-props="{ $thread: dm.localID, isActive: $thread === dm.localID }"
                   t-on-click="_onClickItem"
                   t-key="dm.localID"/>
            </t>
        </div>
    </div>
</div>`;
        this.state = {
            isAddingChannel: false,
            isAddingDm: false
        };
        this.widgets = {
            AutocompleteInput,
            SidebarItem
        };
        this._channelAutocompleteLastSearchVal = undefined;
        this._onChannelAutocompleteSource = this._onChannelAutocompleteSource.bind(this);
        this._onDmAutocompleteSource = this._onDmAutocompleteSource.bind(this);
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    get $thread() {
        return this.props.$thread;
    }

    get channels() {
        return Object.values(this.threads)
            .filter(thread => thread.channel_type === 'channel')
            .sort((c1, c2) => (c1.name < c2.name ? -1 : 1));
    }

    get dms() {
        return Object.values(this.threads)
            .filter(thread => thread.channel_type === 'chat')
            .sort((dm1, dm2) => (dm1.name < dm2.name ? -1 : 1));
    }

    get mailboxes() {
        return Object.values(this.threads)
            .filter(thread => thread._model === 'mail.box')
            .sort((m1, m2) => {
                // 1st item: 'Inbox'
                // 2nd item: 'Starred'
                // Others: alphabetical order
                return m1.id === 'inbox' ? -1
                    : m2.id === 'inbox' ? 1
                    : m1.id === 'starred' ? -1
                    : m2.id === 'starred' ? 1
                    : m1.name < m2.name ? -1
                    : 1;
            });
    }

    get threads() {
        return this.props.threads;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onChannelAutocompleteSelect(item) {
        if (!this._channelAutocompleteLastSearchVal) {
            return;
        }
        if (item.special) {
            this.env.store.dispatch('channel/create', {
                name: this._channelAutocompleteLastSearchVal,
                public: item.special,
                type: 'channel'
            });
        } else {
            this.env.store.dispatch('channel/join', { channelID: item.id });
        }
        this.state.isAddingChannel = false;
    }

    _onChannelAutocompleteSource(req, res) {
        this._channelAutocompleteLastSearchVal = _.escape(req.term);
        return this.env
            .rpc({
                model: 'mail.channel',
                method: 'channel_search_to_join',
                args: [this._channelAutocompleteLastSearchVal],
            })
            .then(result => {
                return result.map(data => {
                    let escapedName = _.escape(data.name);
                    return Object.assign(data, {
                        label: escapedName,
                        value: escapedName
                    });
                });
            })
            .then(items => {
                items.push(
                    {
                        label: this.env._t(
                            `<strong>Create <em><span class="fa fa-hashtag"/>${
                                this._channelAutocompleteLastSearchVal
                            }</em></strong>`
                        ),
                        value: this._channelAutocompleteLastSearchVal,
                        special: 'public'
                    },
                    {
                        label: this.env._t(
                            `<strong>Create <em><span class="fa fa-lock"/>${
                                this._channelAutocompleteLastSearchVal
                            }</em></strong>`
                        ),
                        value: this._channelAutocompleteLastSearchVal,
                        special: 'private'
                    }
                );
                res(items);
            });
    }

    _onClickChannelAdd() {
        this.state.isAddingChannel = true;
    }

    _onClickChannelTitle() {
        return this.env.do_action({
            name: this.env._t("Public Channels"),
            type: 'ir.actions.act_window',
            res_model: 'mail.channel',
            views: [[false, 'kanban'], [false, 'form']],
            domain: [['public', '!=', 'private']]
        });
    }

    _onClickDmAdd() {
        return (this.state.isAddingDm = true);
    }

    _onClickItem({ $thread }) {
        return this.trigger('select-thread', { $thread });
    }

    _onDmAutocompleteSelect(item) {
        const partnerID = item.id;
        const dm = this.dms.find(d => d.directPartner === `res.partner_${partnerID}`);
        if (dm) {
            this.trigger('select-thread', { $thread: dm.localID });
        } else {
            this.env.store.dispatch('channel/create', {
                partnerID,
                type: 'chat'
            });
        }
        return (this.state.isAddingDm = false);
    }

    _onDmAutocompleteSource(req, res) {
        return this.env.store.dispatch('partner/search', {
            callback: res,
            limit: 10,
            value: _.escape(req.term)
        });
    }

    _onHideAddChannel() {
        return (this.state.isAddingChannel = false);
    }

    _onHideAddDm() {
        return (this.state.isAddingDm = false);
    }
}

return connect(mapStateToProps, { deep: false })(Sidebar);

});
