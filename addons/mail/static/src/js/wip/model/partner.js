odoo.define('mail.wip.model.Partner', function (require) {
'use strict';

const Model = require('mail.wip.model.Model');

class Partner extends Model {
    /**
     * @override {mail.wip.model.Model}
     * @private
     */
    _compute() {
        const { id, $messages=[] } = this;
        Object.assign(this, {
            _model: 'res.partner',
            $messages,
            localID: `res.partner_${id}`,
        });
    }
}

return Partner;

});
