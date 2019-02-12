odoo.define('mail.wip.widget.AutocompleteInput', function () {
'use strict';

const { Component } = owl;

class AutocompleteInput extends Component {

    constructor(...args) {
        super(...args);
        this.inlineTemplate = `
<input t-on-blur="_onBlur"
       t-on-click="_onClick"
       t-on-keydown="_onKeydown"/>`;
    }

    mounted() {
        this.el.focus();
        $(this.el).autocomplete({
            select: (ev, ui) => this._onAutocompleteSelect(ev, ui),
            source: (req, res) => this._onAutocompleteSource(req, res),
            focus: ev => this._onAutocompleteFocus(ev),
            html: this.props.html || false
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onAutocompleteFocus(ev) {
        if (this.props.focus) {
            this.props.focus(ev);
        } else {
            ev.preventDefault();
        }
    }

    _onAutocompleteSelect(ev, ui) {
        if (this.props.select) {
            this.props.select(ev, ui);
        } else {
            this.trigger("select", ui.item);
        }
    }

    _onAutocompleteSource(req, res) {
        if (this.props.source) {
            this.props.source(req, res);
        }
    }

    _onBlur(ev) {
        ev.stopPropagation();
        this.trigger('hide');
    }

    _onClick(ev) {
        ev.stopPropagation();
    }

    _onKeydown(ev) {
        if (ev.which === $.ui.keyCode.ESCAPE) {
            this.trigger('hide');
        }
    }
}

return AutocompleteInput;

});
