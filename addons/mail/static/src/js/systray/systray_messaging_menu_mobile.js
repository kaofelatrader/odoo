odoo.define('mail.systray.MessagingMenuMobile', function (require) {
"use strict";

var MessagingMenu = require('mail.systray.MessagingMenu');

var config = require('web.config');

if (!config.device.isMobile) {
    return;
}

/**
 * Overrides systray messaging module in mobile
 */
MessagingMenu.include({
    jsLibs: [],
    events: _.extend(MessagingMenu.prototype.events, {
        'touchstart .o_mail_preview.o_preview_unread': '_ontouchstart',
        'touchmove .o_mail_preview.o_preview_unread': '_onSwipPreview',
        'touchend .o_mail_preview.o_preview_unread': '_ontouchend',
    }),

    init: function () {
        this._super.apply(this, arguments);
        this.jsLibs.push('/web/static/lib/jquery.touchSwipe/jquery.touchSwipe.js');
    },
    /**
     * @private
     * When a preview touch start
     */
    _ontouchstart: function (ev) {
        $('<div class="o_thread_swip_check"><i class="fa fa-check"/></div>').prependTo($(ev.currentTarget));
    },
    /**
     * @private
     * When a preview touch end
     */
    _ontouchend: function (ev) {
        $(ev.currentTarget).find("div[class~='o_thread_swip_check']").remove();
    },
     /**
     * When a preview is swip on, we want to read the related object
     * (thread, mail failure, etc.)
     *
     * @private
     * @param {Touch} ev
     */
    _onSwipPreview: function (ev) {
        ev.stopPropagation();
        var $target = $(ev.currentTarget);
        $(ev.currentTarget).swipe({
            swipeStatus:function(event, phase, direction, distance, duration, fingers, fingerData, currentDirection) {
                if (direction == 'right') {
                    $target.find('> div:first-child')[0].style.minWidth = distance + "px";
                    var swipeDistance = (distance / $(window).width()) * 100;
                    if (swipeDistance > 20) {
                        $target.find('> div:first-child')[0].style.backgroundColor='green';
                        if (swipeDistance > 30) {
                            $target.find("span[class~='o_mail_preview_mark_as_read']").click();
                        }
                    }
                }
            }
        });
    },
});
});
