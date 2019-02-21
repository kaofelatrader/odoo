odoo.define('website_slides.archive.slide', function (require) {

var sAnimations = require('website.content.snippets.animation');
var Dialog = require('web.Dialog');
var core = require('web.core');
var _t = core._t;

var ArchiveSlideDialog = Dialog.extend({
    template: 'website.slide.archive.slide',

    /**
     * @override
     */
    init: function (parent, options) {
        options = _.defaults(options || {}, {
            title: _t("Archive Slide"),
            size: 'medium',
            buttons: [{
                text: _t("Archive"),
                classes: 'btn-primary',
                click: this._onClickArchive.bind(this)
            }, {
                text: _t("Cancel"),
                close: true
            }]
        });

        this.$slideTarget = options.slideTarget;
        this.slideId = this.$slideTarget.attr('slide_id');
        this._super(parent, options);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Calls 'archive' on slide controller and then visually removes the slide dom element
     */
    _onClickArchive: function () {
        var self = this;

        this._rpc({
            route: '/slides/slide/archive',
            params: {
                slide_id: this.slideId
            },
        }).then(function () {
            self.$slideTarget.closest('.content-slide').remove();
            self.close();
        });
    }
});

sAnimations.registry.websiteSlidesArchiveSlide = sAnimations.Class.extend({
    selector: '.o_wslides_archive_slide',
    xmlDependencies: ['/website_slides/static/src/xml/website_slides_upload.xml'],
    read_events: {
        'click': '_onArchiveSlideClick',
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _openDialog: function ($slideTarget) {
        new ArchiveSlideDialog(this, {slideTarget: $slideTarget}).open();
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onArchiveSlideClick: function (ev) {
        ev.preventDefault();
        var $slideTarget = $(ev.currentTarget);
        this._openDialog($slideTarget);
    },
});

return {
    archiveSlideDialog: ArchiveSlideDialog,
    websiteSlidesArchiveSlide: sAnimations.registry.websiteSlidesArchiveSlide
};

});
