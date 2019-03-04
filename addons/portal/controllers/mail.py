# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import json
import logging
import unicodedata
import werkzeug

from ast import literal_eval
from werkzeug import urls
from werkzeug.exceptions import NotFound, Forbidden

from odoo import http
from odoo.http import request
from odoo.osv import expression
from odoo.tools import consteq, plaintext2html
from odoo.tools.translate import _
from odoo.addons.mail.controllers.main import MailController
from odoo.exceptions import AccessError, MissingError

_logger = logging.getLogger(__name__)

MAX_FILE_SIZE_TO_UPOLAD = 25
MAX_FILE_TO_UPOLAD = 10


def _check_special_access(res_model, res_id, token='', _hash='', pid=False):
    record = request.env[res_model].browse(res_id).sudo()
    if token:  # Token Case: token is the global one of the document
        token_field = request.env[res_model]._mail_post_token_field
        return (token and record and consteq(record[token_field], token))
    elif _hash and pid:  # Signed Token Case: hash implies token is signed by partner pid
        return consteq(_hash, record._sign_token(pid))
    else:
        raise Forbidden()


def _message_post_helper(res_model, res_id, message, attachment_ids=None, token='', nosubscribe=True, **kw):
    """ Generic chatter function, allowing to write on *any* object that inherits mail.thread. We
        distinguish 2 cases:
            1/ If a token is specified, all logged in users will be able to write a message regardless
            of access rights; if the user is the public user, the message will be posted under the name
            of the partner_id of the object (or the public user if there is no partner_id on the object).

            2/ If a signed token is specified (`hash`) and also a partner_id (`pid`), all post message will
            be done under the name of the partner_id (as it is signed). This should be used to avoid leaking
            token to all users.

        Required parameters
        :param string res_model: model name of the object
        :param int res_id: id of the object
        :param string message: content of the message

        Optional keywords arguments:
        :param string token: access token if the object's model uses some kind of public access
                             using tokens (usually a uuid4) to bypass access rules
        :param string hash: signed token by a partner if model uses some token field to bypass access right
                            post messages.
        :param string pid: identifier of the res.partner used to sign the hash
        :param bool nosubscribe: set False if you want the partner to be set as follower of the object when posting (default to True)
        :param list attachment_ids: if any attachments are added to message.

        The rest of the kwargs are passed on to message_post()
    """
    record = request.env[res_model].browse(res_id)

    # check if user can post with special token/signed token. The "else" will try to post message with the
    # current user access rights (_mail_post_access use case).
    if token or (kw.get('hash') and kw.get('pid')):
        pid = int(kw['pid']) if kw.get('pid') else False
        if _check_special_access(res_model, res_id, token=token, _hash=kw.get('hash'), pid=pid):
            record = record.sudo()
        else:
            raise Forbidden()

    # deduce author of message
    author_id = request.env.user.partner_id.id if request.env.user.partner_id else False

    # Token Case: author is document customer (if not logged) or itself even if user has not the access
    if token:
        if request.env.user._is_public():
            # TODO : After adding the pid and sign_token in access_url when send invoice by email, remove this line
            # TODO : Author must be Public User (to rename to 'Anonymous')
            author_id = record.partner_id.id if hasattr(record, 'partner_id') and record.partner_id.id else author_id
        else:
            if not author_id:
                raise NotFound()
    # Signed Token Case: author_id is forced
    elif kw.get('hash') and kw.get('pid'):
        author_id = kw.get('pid')

    kw.pop('csrf_token', None)
    kw.pop('hash', None)
    kw.pop('pid', None)
    return record.with_context(mail_create_nosubscribe=nosubscribe).message_post(body=message,
                                                                                   message_type=kw.pop('message_type', "comment"),
                                                                                   attachment_ids=attachment_ids,
                                                                                   subtype=kw.pop('subtype', "mt_comment"),
                                                                                   author_id=author_id,
                                                                                   **kw)


class PortalChatter(http.Controller):

    def _document_check_access(self, model_name, document_id, access_token=None):
        document = request.env[model_name].browse([document_id])
        document_sudo = document.sudo().exists()
        if not document_sudo:
            raise MissingError("This document does not exist.")
        try:
            document.check_access_rights('read')
            document.check_access_rule('read')
        except AccessError:
            if not access_token or not consteq(document_sudo.access_token, access_token):
                raise
        return document_sudo

    def _neuter_mimetype(self, mimetype, user):
        wrong_type = 'ht' in mimetype or 'xml' in mimetype or 'svg' in mimetype
        if wrong_type and not user._is_system():
            return 'text/plain'
        return mimetype

    @http.route(['/mail/chatter_post'], type='http', methods=['POST'], auth='public', website=True)
    def portal_chatter_post(self, res_model, res_id, message, attachment_ids=None, **kw):
        url = request.httprequest.referrer
        if attachment_ids:
            attachment_ids = literal_eval(attachment_ids)
            if isinstance(attachment_ids, int):
                attachment_ids = [attachment_ids]
        if message or attachment_ids:
            # message is received in plaintext and saved in html
            message = plaintext2html(message)
            _message_post_helper(res_model=res_model, res_id=int(res_id), message=message, attachment_ids=attachment_ids, **kw)
            url = url + "#discussion"
        return request.redirect(url)

    @http.route('/mail/chatter_init', type='json', auth='public', website=True)
    def portal_chatter_init(self, res_model, res_id, domain=False, limit=False, **kwargs):
        is_user_public = request.env.user.has_group('base.group_public')
        message_data = self.portal_message_fetch(res_model, res_id, domain=domain, limit=limit, **kwargs)
        display_composer = False
        if kwargs.get('allow_composer'):
            display_composer = kwargs.get('token') or not is_user_public
        return {
            'messages': message_data['messages'],
            'options': {
                'message_count': message_data['message_count'],
                'is_user_public': is_user_public,
                'is_user_publisher': request.env.user.has_group('website.group_website_publisher'),
                'display_composer': display_composer,
                'partner_id': request.env.user.partner_id.id
            }
        }

    @http.route('/mail/chatter_fetch', type='json', auth='public', website=True)
    def portal_message_fetch(self, res_model, res_id, domain=False, limit=10, offset=0, **kw):
        if not domain:
            domain = []
        # Only search into website_message_ids, so apply the same domain to perform only one search
        # extract domain from the 'website_message_ids' field
        field_domain = request.env[res_model]._fields['website_message_ids'].domain
        if callable(field_domain):
            field_domain = field_domain(request.env[res_model])
        domain = expression.AND([domain, field_domain, [('res_id', '=', res_id)]])

        # Check access
        Message = request.env['mail.message']
        if kw.get('token'):
            access_as_sudo = _check_special_access(res_model, res_id, token=kw.get('token'))
            if not access_as_sudo:  # if token is not correct, raise Forbidden
                raise Forbidden()
            # Non-employee see only messages with not internal subtype (aka, no internal logs)
            if not request.env['res.users'].has_group('base.group_user'):
                domain = expression.AND([['&', ('subtype_id', '!=', False), ('subtype_id.internal', '=', False)], domain])
            Message = request.env['mail.message'].sudo()
        return {
            'messages': Message.search(domain, limit=limit, offset=offset).portal_message_format(),
            'message_count': Message.search_count(domain)
        }

    @http.route('/portal/binary/upload_attachment', type='http', auth="public")
    def upload_attachment(self, callback, model, id, ufile, **kwargs):
        files = request.httprequest.files.getlist('ufile')
        out = """<script language="javascript" type="text/javascript">
                    var win = window.top.window;
                    win.jQuery(win).trigger(%s, %s);
                </script>"""

        access_token = kwargs.get('access_token')
        res_id = int(id)
        args = []

        try:
            if request.env.user.has_group('base.group_public') and not access_token:
                raise AccessError(_("Do not have access to the document."))
            self._document_check_access(model, res_id, access_token=access_token)
        except (AccessError, MissingError):
            raise Forbidden()

        if len(files) > MAX_FILE_TO_UPOLAD:
            args.append({'error': _("Oops! You can not upload more than 10 files.")})
            return out % (json.dumps(callback), json.dumps(args))

        AttachmentSudo = request.env['ir.attachment'].sudo()

        for ufile in files:
            data = ufile.read()
            file_size = len(data) * 3 / 4
            if (file_size / 1024.0 / 1024.0) > MAX_FILE_SIZE_TO_UPOLAD:
                args.append({'error': _("Oops! You can not upload a file larger than 25MB.")})

            filename = ufile.filename
            if request.httprequest.user_agent.browser == 'safari':
                # Safari sends NFD UTF-8 (where é is composed by 'e' and [accent])
                # we need to send it the same stuff, otherwise it'll fail
                filename = unicodedata.normalize('NFD', ufile.filename)
            try:
                attachment = AttachmentSudo.create({
                    'name': filename,
                    'datas': base64.encodebytes(data),
                    'datas_fname': filename,
                    'res_model': model,
                    'res_id': res_id,
                })
            except Exception:
                args.append({'error': _("Unable to upload attachment")})
                _logger.exception("Unable to upload attachment")
            else:
                args.append({
                    'filename': filename,
                    'mimetype': self._neuter_mimetype(ufile.content_type, http.request.env.user),
                    'id': attachment.id,
                    'size': attachment.file_size
                })

        return out % (json.dumps(callback), json.dumps(args))

    @http.route('/portal/content/<int:attachment_id>', type='http', auth="public")
    def download_attachment(self, attachment_id, model, id, access_token=False, download=None, **kw):
        res_id = int(id)

        try:
            if request.env.user.has_group('base.group_public') and not access_token:
                raise AccessError(_("Do not have access to the document."))
            document_sudo = self._document_check_access(model, res_id, access_token=access_token)
        except (AccessError, MissingError):
            raise Forbidden()

        record = document_sudo.website_message_ids.mapped('attachment_ids').filtered(lambda x: x.id == int(attachment_id))

        if record.res_model != model and record.res_id != res_id:
            raise AccessError(_("Do not have access to the document."))

        status, content_base64, filename, mimetype, filehash = request.env['ir.http']._binary_record_content(
            record, filename=None, default_mimetype='application/octet-stream')

        status, headers, content_base64 = request.env['ir.http']._binary_set_headers(
            status, content_base64, filename, mimetype, unique=False, filehash=filehash, download=download)

        if status != 200:
            return request.env['ir.http']._response_by_status(status, headers, content_base64)
        content = base64.b64decode(content_base64)
        headers.append(('Content-Length', len(content)))
        response = request.make_response(content, headers)

        return response


class MailController(MailController):

    @classmethod
    def _redirect_to_record(cls, model, res_id, access_token=None, **kwargs):
        """ If the current user doesn't have access to the document, but provided
        a valid access token, redirect him to the front-end view.
        If the partner_id and hash parameters are given, add those parameters to the redirect url
        to authentify the recipient in the chatter, if any.

        :param model: the model name of the record that will be visualized
        :param res_id: the id of the record
        :param access_token: token that gives access to the record
            bypassing the rights and rules restriction of the user.
        :param kwargs: Typically, it can receive a partner_id and a hash (sign_token).
            If so, those two parameters are used to authentify the recipient in the chatter, if any.
        :return:
        """
        if issubclass(type(request.env[model]), request.env.registry['portal.mixin']):
            uid = request.session.uid or request.env.ref('base.public_user').id
            record_sudo = request.env[model].sudo().browse(res_id).exists()
            try:
                record_sudo.sudo(uid).check_access_rights('read')
                record_sudo.sudo(uid).check_access_rule('read')
            except AccessError:
                if record_sudo.access_token and access_token and consteq(record_sudo.access_token, access_token):
                    record_action = record_sudo.with_context(force_website=True).get_access_action()
                    if record_action['type'] == 'ir.actions.act_url':
                        pid = kwargs.get('pid')
                        hash = kwargs.get('hash')
                        url = record_action['url']
                        if pid and hash:
                            url = urls.url_parse(url)
                            url_params = url.decode_query()
                            url_params.update([("pid", pid), ("hash", hash)])
                            url = url.replace(query=urls.url_encode(url_params)).to_url()
                        return werkzeug.utils.redirect(url)
        return super(MailController, cls)._redirect_to_record(model, res_id, access_token=access_token)
