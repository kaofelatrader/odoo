odoo.define('web.form_overlay_view', function (require) {
"use strict";

/**
 * This file defines the OpenFormOverlayView widget for Kanban and list view. It allows to
 * create kanban/list records directly from the Kanban/list view.
 * handle resizing the form overlay view and calculate width of overlay view and kanban/list view
 */

var core = require('web.core');
var Widget = require('web.Widget');
var WebFormView = require('web.FormView');

var qweb = core.qweb;

// var OpenFormOverlayView = FormView.extend({
//     withControlPanel: false,
// });

var FormOverlayView = Widget.extend({
    className: 'o_form_overlay_view',
    events: {
        // if we not use exist form control panel
        'click .o_form_overlay_view_save': '_onSaveClicked', // save open record and remove from overlay view in dome
        'click .o_form_overlay_view_expand': '_onExpandClicked', // open form view in full screen
        // if we not use exist form control panel
        'click .o_form_overlay_cancel': '_onCancelClicked', // discard the form overlay view
        'mousedown #resizable': function (ev) {
            this.isResizing = true;
            this.lastDownX = ev.clientX;
        },
    },

    /**
     * @override
     * @param {Widget} parent
     * @param {Object} options
     * @param {Object} options.context
     * @param {string|null} options.formViewRef
     * @param {string|null} options.formViewID
     * @param {string} options.model
     */
    init: function (parent, options) {
        // set the value what are required to open form overlay view
        this._super.apply(this, arguments);
        this.context = options.context;
        this.formViewRef = options.formViewRef; // for create a new record
        this.formViewID = options.formViewID;
        this.model = options.model;
        this.res_id = options.res_id; // to open form view, when click on record
        this.db_id = options.db_id; // related db for save record
        this._disabled = false; // to prevent from creating multiple records (e.g. on double-clicks)
        this.isResizing = false; 
        this.lastDownX = 0;
    },
    willStart: function () {
        // Loads the form fieldsView (if provided) or instantiates the form view with default view
        // and starts the form controller
        var self = this;
        var superWillStart = this._super.apply(this, arguments);
        var viewsLoaded;
        if (this.formViewRef && !this.formViewID) {
            var views = [[false, 'form']];
            var context = _.extend({}, this.context, {
                form_view_ref: this.formViewRef,
            });
            viewsLoaded = this.loadViews(this.model, context, views);
        } else if (this.formViewID) {
            viewsLoaded = this.loadViews(this.model, context, [[this.formViewID, 'form']]);
        } else {
            var fieldsView = {};
            fieldsView.arch = '<form>' +
                '<field name="display_name" placeholder="Title" modifiers=\'{"required": true}\'/>' +
            '</form>';
            var fields = {
                display_name: {string: 'Display name', type: 'char'},
            };
            fieldsView.fields = fields;
            fieldsView.viewFields = fields;
            viewsLoaded = Promise.resolve({form: fieldsView});
        }
        viewsLoaded = viewsLoaded.then(function (fieldsViews) {
            var formView = new WebFormView(fieldsViews.form, {
                context: self.context,
                modelName: self.model,
                ids: self.res_id ? [self.res_id] : [],
                currentId: self.res_id || undefined,
                userContext: self.getSession().user_context,
            });
            return formView.getController(self).then(function (controller) {
                self.controller = controller;
                return self.controller.appendTo(document.createDocumentFragment());
            });
        });
        return Promise.all([superWillStart, viewsLoaded]);
    },
    start: function () {
        // append new controller panel for form overlay view
        // or use form controller panel to show navigation bar and 'save', 'discard' button not include 
        // 'Action Menu' and 'Pager'
        this.$el.append('<div id="resizable" class="o_resizeble"></div>');
        this.$el.append(this.controller.$el);
        this.$el.height(this.context.form_overlay_heigh);
        // for resizing
        $(document).on('mousemove', this._onMouseMoveOverlay.bind(this))
        .on('mouseup', this._onMouseUpOverlay.bind(this));
        return this._super.apply(this, arguments);
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
    _onMouseMoveOverlay: function (ev) {
        // handle resizable form overlay view
        if (!this.isResizing) 
            return;

        var $content = this.$el.parents('div.o_content');
        var offsetRight = $content.width() - (ev.clientX - $content.offset().left);
        var offsetLeft = $content.width() - offsetRight;
        // TODO: for kanban and list
        $('.o_kanban_view').css('width', offsetLeft);
        this.$el.css('width', offsetRight);
    },
    _onMouseUpOverlay: function (ev) {
        // stop resizing
        this.isResizing = false; 
    },
});
return FormOverlayView;
});