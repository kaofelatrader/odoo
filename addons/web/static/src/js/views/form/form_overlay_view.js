odoo.define('web.form_overlay_view', function (require) {
"use strict";

/**
 * This file defines the OpenFormOverlayView widget for Kanban and list view. It allows to
 * create kanban/list records directly from the Kanban/list view.
 * handle resizing the form overlay view and calculate width of overlay view and kanban/list view
 */

var core = require('web.core');
var Widget = require('web.Widget');

var FormOverlayView = Widget.extend({
    className: 'o_form_overlay_view',
    events: {
        // if we not use exist form control panel
        'click .o_form_overlay_view_save': '_onSaveClicked', // save open record and remove from overlay view in dome
        'click .o_form_overlay_view_expand': '_onExpandClicked', // open form view in full screen
        // if we not use exist form control panel
        'click .o_form_overlay_cancel': '_onCancelClicked', // discard the form overlay view
    },

    init: function (parent, options) {
        // set the value what are required to open form overlay view
    },
    willStart: function () {
        // Loads the form fieldsView (if provided) or instantiates the form view with default view
        // and starts the form controller
    },
    start: function () {
        // append new controller panel for form overlay view
        // or use form controller panel to show navigation bar and 'save', 'discard' button not include 
        // 'Action Menu' and 'Pager'
    },
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onSaveClicked: function () {
        // trigger form view save method
    },
    _onExpandClicked: function () {
        // open form view in full screen
    },
    _onCancelClicked: function () {
        // trigger form view discard method
    },
    _onResizeFormOverlayView: function () {
        // handle resizable form overlay view
    }, 
});
return FormOverlayView;
});