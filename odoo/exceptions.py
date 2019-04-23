# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

""" OpenERP core exceptions.

This module defines a few exception types. Those types are understood by the
RPC layer. Any other exception type bubbling until the RPC layer will be
treated as a 'Server error'.

If you consider introducing new exceptions, check out the test_exceptions addon.
"""

import logging
from inspect import currentframe
from .tools.func import frame_codeinfo
from .tools.translate import _

_logger = logging.getLogger(__name__)


# kept for backward compatibility
class except_orm(Exception):
    def __init__(self, name, value=None, metadata=None):
        if type(self) == except_orm:
            caller = frame_codeinfo(currentframe(), 1)
            _logger.warn('except_orm is deprecated. Please use specific exceptions like UserError or AccessError. Caller: %s:%s', *caller)
        self.name = name
        self.value = value
        self.args = (name, value)

        # only send the metadata to the web client if the user has the right permissions
        if metadata and metadata.get('visible', True):
            self.metadata = metadata
        else:
            self.metadata = False


class UserError(except_orm):
    def __init__(self, msg, metadata=None):
        super(UserError, self).__init__(msg, value='', metadata=metadata)


# deprecated due to collision with builtins, kept for compatibility
Warning = UserError


class RedirectWarning(Exception):
    """ Warning with a possibility to redirect the user instead of simply
    diplaying the warning message.

    Should receive as parameters:
      :param int action_id: id of the action where to perform the redirection
      :param string button_text: text to put on the button that will trigger
          the redirection.
    """
    # using this RedirectWarning won't crash if used as an except_orm
    @property
    def name(self):
        return self.args[0]


class AccessDenied(Exception):
    """ Login/password error. no traceback.
    Example: When you try to log with a wrong password."""
    def __init__(self, message='Access denied'):
        super(AccessDenied, self).__init__(message)
        self.with_traceback(None)
        self.__cause__ = None
        self.traceback = ('', '', '')


class AccessError(except_orm):
    """ Access rights error.
    Example: When you try to read a record that you are not allowed to."""
    def __init__(self, msg, metadata=None):
        super(AccessError, self).__init__(msg, metadata=metadata)


class CacheMiss(except_orm, KeyError):
    """ Missing value(s) in cache.
    Example: When you try to read a value in a flushed cache."""
    def __init__(self, record, field):
        super(CacheMiss, self).__init__("%s.%s" % (str(record), field.name))


class MissingError(except_orm):
    """ Missing record(s).
    Example: When you try to write on a deleted record."""
    def __init__(self, msg, metadata=None):
        super(MissingError, self).__init__(msg, metadata=metadata)


class ValidationError(except_orm):
    """ Violation of python constraints
    Example: When you try to create a new user with a login which already exist in the db."""
    def __init__(self, msg, metadata=None):
        super(ValidationError, self).__init__(msg, metadata=metadata)


class DeferredException(Exception):
    """ Exception object holding a traceback for asynchronous reporting.

    Some RPC calls (database creation and report generation) happen with
    an initial request followed by multiple, polling requests. This class
    is used to store the possible exception occuring in the thread serving
    the first request, and is then sent to a polling request.

    ('Traceback' is misleading, this is really a exc_info() triple.)
    """
    def __init__(self, msg, tb):
        self.message = msg
        self.traceback = tb


class QWebException(Exception):
    pass


class ViewError(except_orm, ValueError):

    def __init__(self, msg, view):
        not_avail = _('n/a')
        message = (
            "%(msg)s\n\n" +
            _("Error context:\nView `%(view_name)s`") +
            "\n[view_id: %(viewid)s, xml_id: %(xmlid)s, "
            "model: %(model)s, parent_id: %(parent)s]"
        ) % {
            'view_name': view.name or not_avail,
            'viewid': view.id or not_avail,
            'xmlid': view.xml_id or not_avail,
            'model': view.model or not_avail,
            'parent': view.inherit_id.id or not_avail,
            'msg': msg,
        }
        vals = [self, message, '']
        _logger.info(message)

        if not view:
            # an error occurred when loading a default view, find out especifically which one broke
            loaded_view = view.env.context.get('loaded_view', False)
            if loaded_view:
                model = loaded_view[0]

                try:
                    # reload the views to retrigger a ViewError, this time with debug information
                    # to properly find the view id that causes the error
                    view.env[model].with_context(inherit_branding=True).load_views(*loaded_view[1:])
                except ViewError as e:
                    vals = [self, e.name, e.value, e.metadata]
        else:
            metadata = {
                    'label': 'Go to view',
                    'action': {
                        'type': 'ir.actions.act_window',
                        'res_model': 'ir.ui.view',
                        'res_id': view.id,
                        'views': [[False, 'form']],
                        },
                    'visible': view.user_has_groups('base.group_system'),
                    'description': (
                        "You may click on the 'Go to view' button to open the problematic view "
                        "to modify and fix it and/or disable it."
                        )
                    }
            vals.append(metadata)

        except_orm.__init__(*vals)
