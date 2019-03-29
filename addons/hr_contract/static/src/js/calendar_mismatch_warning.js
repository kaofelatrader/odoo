odoo.define('web.ResourceCalendarMismatch', function (require) {
    "use strict";

    var field_registry = require('web.field_registry');
    var relational_fields = require('web.relational_fields');
    var FieldSelection = relational_fields.FieldSelection;
    var core = require('web.core');
    var _t = core._t;
    var FieldResourceCalendarMismatch = FieldSelection.extend({

        /**
         * @override
         * @private
         */
        _onChange: function (ev) {
            this._super.apply(this, arguments);
            var new_calendar_id = parseInt(ev.currentTarget.value, 10);
            if (!this._calendarMismatch(new_calendar_id)){
                $('.o_calendar_warning').hide();
            }
            else {
                $('.o_calendar_warning').show();
            }
        },

        _calendarMismatch: function (current_calendar_id) {
            var data = this.getParent().state.data;
            current_calendar_id = current_calendar_id || data.resource_calendar_id.res_id;
            return data.contract_resource_calendar_id && data.contract_resource_calendar_id.res_id !== current_calendar_id;
        },

        _get_calendar_warning_node: function () {
            var $span = $('<span class="fa fa-exclamation-triangle text-danger o_calendar_warning"/>');
            $span.attr('title', _t("Calendar Mismatch : The employee's calendar does not match its current contract calendar. This could lead to unexpected behaviors."));
            return $span;
        },

        /**
         * @override
         * @private
         */
        _renderEdit: function () {
            this._super.apply(this, arguments);
            $('.o_calendar_warning').remove();
            if (this._calendarMismatch()){
                var $span = this._get_calendar_warning_node();
                $span.insertAfter(this.$el);
            }
        },

        /**
         * @override
         * @private
         */
        _renderReadonly: function () {
            this._super.apply(this, arguments);
            $('.o_calendar_warning').remove();
            if (this._calendarMismatch()){
                var $span = this._get_calendar_warning_node();
                $span.addClass('o_calendar_warning_readonly');
                this.$el = this.$el.add($span);
            }

        },
    });

    field_registry.add('calendar_mismatch_warning', FieldResourceCalendarMismatch);

    return FieldResourceCalendarMismatch;

    });
