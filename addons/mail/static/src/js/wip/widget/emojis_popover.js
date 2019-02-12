odoo.define('mail.wip.widget.EmojisPopover', function (require) {
'use strict';

const emojis = require('mail.emojis');

const { Component } = owl;

class EmojisPopover extends Component {

    constructor(...args) {
        super(...args);
        this.inlineTemplate = `
<div class="o_mail_wip_emojis_popover">
    <t t-foreach="emojis" t-as="emoji">
        <span t-att-data-source="emoji.sources[0]"
              class="o_emoji"
              t-att-title="emoji.description"
              t-att-aria-label="emoji.description"
              t-on-click="_onClickEmoji"
              t-key="emoji.unicode">
            <t t-esc="emoji.unicode"/>
        </span>
    </t>
</div>`;
    }

    get emojis() {
        return emojis;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onClickEmoji(ev) {
        this.trigger('selection', {
            source: ev.currentTarget.dataset.source
        });
    }
}

return EmojisPopover;

});
