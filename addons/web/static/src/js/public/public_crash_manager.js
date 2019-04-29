odoo.define('web.public.CrashManager', function (require) {
"use strict";

var core = require('web.core');
var CrashManager = require('web.CrashManager').CrashManager;
var mixins = require('web.mixins');
var ServicesMixin = require('web.ServicesMixin');
var ServiceProviderMixin = require('web.ServiceProviderMixin');

var _t = core._t;

var PublicCrashManager = CrashManager.extend(mixins.EventDispatcherMixin, ServicesMixin, ServiceProviderMixin, {
    init: function () {
        mixins.EventDispatcherMixin.init.call(this);
        this._super.apply(this, arguments);
        ServiceProviderMixin.init.call(this);
    },

    notifyConnectionState: function () {
        var options;
        if (this.isConnected) {
            options = {
                type: 'info',
                title: _t("Connection restored"),
                message: _t("You are back online"),
            };
        } else {
            options = {
                type: 'warning',
                title: _t("Connection lost"),
                message: _t("Trying to reconnect..."),
            };
        }
        options.sticky = true;
        this.displayNotification(options);
    },
    show_warning: function (error) {
        if (!this.active) {
            return;
        }
        var message = error.data ? error.data.message : error.message;
        var title = _.str.capitalize(error.type) || _t("Oops Something went wrong !");
        var subtitle = error.data.title;
        this.displayNotification({
            type: 'warning',
            title: title,
            message: message,
            subtitle: subtitle,
            sticky: true,
        });
    },
});

return {
    PublicCrashManager: PublicCrashManager,
};
});

odoo.define('web.crash_manager', function (require) {
"use strict";

var PublicCrashManager = require('web.public.CrashManager').PublicCrashManager;
return new PublicCrashManager();

});
