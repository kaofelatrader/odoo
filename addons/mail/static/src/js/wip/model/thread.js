odoo.define('mail.wip.model.Thread', function (require) {
'use strict';

const Model = require('mail.wip.model.Model');

class Thread extends Model {
    /**
     * @override {mail.wip.model.Model}
     * @private
     */
    _compute() {
        let {
            _model,
            $caches=[],
            $typingMembers=[],
            channel_type,
            direct_partner: [{
                id: directPartnerID,
                im_status: directPartnerImStatus,
                email: directPartnerEmail,
                name: directPartnerName,
            }={}]=[],
            id,
            members=[],
            pin=true,
        } = this;

        if (!_model && channel_type) {
            _model = 'mail.channel';
        }
        if (!_model || !id) {
            throw new Error('thread must always have `model` and `id`');
        }

        if (directPartnerID) {
            this.$directPartner = `res.partner_${directPartnerID}`;
        }

        Object.assign(this, {
            _model,
            $caches,
            $members: members.map(member => `res.partner_${member.id}`),
            $typingMembers,
            localID: `${_model}_${id}`,
            pin,
        });
    }
}

return Thread;

});
