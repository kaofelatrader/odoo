# -*- coding: utf-8 -*-

from . import controllers
from . import models

from odoo import api, SUPERUSER_ID


def _load_my_theme(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})

    theme = env.ref("base.module_theme_default")
    website = env.ref('website.default_website')

    website.theme_id = theme.id
    theme._theme_load(website)
