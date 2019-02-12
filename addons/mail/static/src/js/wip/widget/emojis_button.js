odoo.define('mail.wip.widget.EmojisButton', function (require) {
'use strict';

const Popover = require('mail.wip.widget.EmojisPopover');

const { Component } = owl;

class EmojisButton extends Component {

    constructor(...args) {
        super(...args);
        this.inlineTemplate = `
<button class="o_emojis o_command btn btn-secondary fa fa-smile-o"
        aria-label="Emojis"
        title="Emojis"
        type="button"
        data-selector="true"
        data-toggle="popover"/>`;
        this._$popover = undefined;
        this._id = _.uniqueId('emojis_button');
        this._popover = undefined;
        this._popoverID = undefined;
    }
    mounted() {
        this._popover = new Popover(this.env);
        this._popover.mount(document.createElement('div')).then(() => {
            const self = this;
            this._popover.el.outerHTML = this._popover.el;
            this._$popover = $(this.el).popover({
                html: true,
                boundary: 'viewport',
                placement: 'top',
                trigger: 'click',
                offset: '0, 1',
                content: function () {
                    const $this = $(this);
                    self._popoverID = $this.attr('aria-describedby');
                    return self._popover.el;
                }
            });
        });
        this._popover.on('selection', this, ({ source }) =>
            this._onEmojiSelection({ source })
        );
        $(document).on('click.' + this._id, ev => this._onDocumentClick(ev));
    }

    willUnmount() {
        this._hidePopover();
        this._popover.destroy();
        $(document).off('click.' + this._id);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _hidePopover() {
        this._$popover.popover('hide');
        this._popoverID = undefined;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onDocumentClick(ev) {
        if (ev.target === this.el) {
            return;
        }
        if (!this._popoverID) {
            return;
        }
        const $target = $(ev.target);
        if ($target.closest(`#${this._popoverID}`).length) {
            return;
        }
        this._$popover.popover('hide');
    }

    _onEmojiSelection({ source }) {
        this._hidePopover();
        this.trigger('emoji-selection', { source });
    }
}

return EmojisButton;

});
