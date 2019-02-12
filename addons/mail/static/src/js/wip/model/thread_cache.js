odoo.define('mail.wip.model.ThreadCache', function (require) {
"use strict";

const Model = require('mail.wip.model.Model');

class ThreadCache extends Model {
    /**
     * @override {mail.wip.model.Model}
     * @private
     */
    _compute() {
        const {
            $messages=[],
            $thread,
            allHistoryLoaded=false,
            loaded=false,
            stringifiedDomain,
        } = this;

        Object.assign(this, {
            allHistoryLoaded,
            loaded,
            localID: `${$thread}_${stringifiedDomain}`,
            $messages,
        });
    }
}

return ThreadCache;

});
