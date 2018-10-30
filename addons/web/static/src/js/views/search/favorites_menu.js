odoo.define('web.FavoritesMenu', function (require) {
"use strict";

// var config = require('web.config');
var core = require('web.core');
// var data_manager = require('web.data_manager');
// var Domain = require('web.Domain');
// var pyUtils = require('web.py_utils');
// var session = require('web.session');
// var Widget = require('web.Widget');
var config = require('web.config');
var DropdownMenu = require('web.DropdownMenu');


var QWeb = core.qweb;
var _t = core._t;


// Don't forget to chang what is needed in file that make an include!!!!


var FavoritesMenu = DropdownMenu.extend({
    events: {
        'click .o_add_favorite': '_onAddFavoriteClick',
        'click .o_save_favorite': '_onSaveFavoriteClick',
    //     'click .dropdown-item': function (ev) {
    //         ev.preventDefault();
    //     },
    //     'click .o_save_search': function (ev) {
    //         ev.preventDefault();
    //         this.toggle_save_menu();
    //     },
    //     'click .o_save_name button': 'save_favorite',
    //     'hidden.bs.dropdown': '_closeMenus',
    //     'keyup .o_save_name input': function (ev) {
    //         if (ev.which === $.ui.keyCode.ENTER) {
    //             this.save_favorite();
    //         }
    //     },
    },
    init: function (parent, favorites, fields) {
        this._super(parent, favorites || []);
        this.generatorMenuIsOpen = false;
        this.isMobile = config.device.isMobile;
        this.dropdownCategory = 'favorite';
        this.dropdownTitle = _t('Favorites');
        this.dropdownIcon = 'fa fa-star';
        this.dropdownSymbol = this.isMobile ? 'fa fa-chevron-right float-right mt4' : false;
        this.dropdownStyle.mainButton.class = 'o_favorites_menu_button ' +
                                                this.dropdownStyle.mainButton.class;
        // this.searchview = parent;
        // this.query = query;
        // this.target_model = target_model;
        // this.action = action;
        // this.action_id = action.id;
        // this.filters = {};
        // this.isMobile = config.device.isMobile;
        // _.each(filters, this.add_filter.bind(this));
    },
    /**
     * render the template used to register a new favorite and append it
     * to the basic dropdown menu
     *
     * @private
     */
    start: function () {
        this.$menu = this.$('.o_dropdown_menu');
        this.$menu.addClass('o_favorites_menu');
        var generatorMenu = QWeb.render('FavoritesMenuGenerator', {widget: this});
        this.$menu.append(generatorMenu);
        this.$favoriteName = this.$('.o_favorite_name');
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------


    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _renderGeneratorMenu: function () {
        this.$el.find('.o_generator_menu').remove();
        var $generatorMenu = QWeb.render('FavoritesMenuGenerator', {widget: this});
        this.$menu.append($generatorMenu);
        this.$favoriteName = this.$('.o_favorite_name');
    },
    /**
     * @private
     */
    _saveFavorite: function () {
        var self = this;
        var description = this.$inputs[0].value;
        var defaultFilter = this.$inputs[1].checked;
        var sharedFilter = this.$inputs[2].checked;
        if (!description.length){
            this.do_warn(_t("Error"), _t("Filter name is required."));
            this.$inputs.first().focus();
            return;
        }
        var descriptionAlreadyExists = this.favorites.find(function (favorite) {
            return favorite.description === description;
        });
        if (descriptionAlreadyExists) {
            this.do_warn(_t("Error"), _t("Filter with same name already exists."));
            this.$inputs.first().focus();
            return;
        }

        // Search query parameter of favorites menu updated/ computed each time?

        // this.trigger_up('get_search_query')
        // get search params with domains not evaluated
        // var search = this.searchview.build_search_data(true);

        // var controllerContext;
        // this.trigger_up('get_controller_context', {
        //     callback: function (ctx) {
        //         controllerContext = ctx;
        //     },
        // });
        // var results = pyUtils.eval_domains_and_contexts({
        //         domains: [],
        //         contexts: [user_context].concat(search.contexts.concat(controllerContext || [])),
        //         group_by_seq: search.groupbys || [],
        //     });
        // if (!_.isEmpty(results.group_by)) {
        //     results.context.group_by = results.group_by;
        // }
        // // Don't save user_context keys in the custom filter, otherwise end
        // // up with e.g. wrong uid or lang stored *and used in subsequent
        // // reqs*
        // var ctx = results.context;
        // _(_.keys(session.user_context)).each(function (key) {
        //     delete ctx[key];
        // });
        // var filter = {
        //     name: filter_name,
        //     user_id: shared_filter ? false : session.uid,
        //     model_id: this.target_model,
        //     context: results.context,
        //     domain: domain,
        //     sort: JSON.stringify(this.searchview.dataset._sort),
        //     is_default: default_filter,
        //     action_id: this.action_id,
        // };
        // return this._createFilter(filter).then(function (id) {
        //     filter.id = id;
        //     self.toggle_save_menu(false);
        //     self.$save_name.find('input').val('').prop('checked', false);
        //     self.add_filter(filter);
        //     self.append_filter(filter);
        //     self.toggle_filter(filter, true);
        // });
    },
    /**
     * @private
     */
    _toggleAddFavoriteMenu: function () {
        this.generatorMenuIsOpen = !this.generatorMenuIsOpen;
        this._renderGeneratorMenu();
        if (this.generatorMenuIsOpen) {
            this.$favoriteName.focus();
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onAddFavoriteClick: function (event) {
        event.preventDefault();
        event.stopPropagation();
        this._toggleAddFavoriteMenu();
    },

    _onSaveFavoriteClick: function (event) {
        this._saveFavorite();
        this._toggleAddFavoriteMenu();
    }

    // start: function () {
    //     var self = this;
    //     this.$filters = {};
    //     this.$save_search = this.$('.o_save_search');
    //     this.$save_name = this.$('.o_save_name');
    //     this.$inputs = this.$save_name.find('input');
    //     this.$user_divider = this.$('.dropdown-divider.user_filter');
    //     this.$shared_divider = this.$('.dropdown-divider.shared_filter');
    //     this.$inputs.eq(0).val(this.searchview.get_title());
    //     var $shared_filter = this.$inputs.eq(1),
    //         $default_filter = this.$inputs.eq(2);
    //     $shared_filter.click(function () {$default_filter.prop('checked', false);});
    //     $default_filter.click(function () {$shared_filter.prop('checked', false);});

    //     this.query
    //         .on('remove', function (facet) {
    //             if (facet.get('is_custom_filter')) {
    //                 self.clear_selection();
    //             }
    //         })
    //         .on('reset', this.proxy('clear_selection'));

    //     _.each(this.filters, this.append_filter.bind(this));

    //     return this._super();
    // },
    // toggle_save_menu: function (is_open) {
    //     this.$save_search
    //         .toggleClass('o_closed_menu', !(_.isUndefined(is_open)) ? !is_open : undefined)
    //         .toggleClass('o_open_menu', is_open);
    //     this.$save_name.toggle(is_open);
    //     if (this.$save_search.hasClass('o_open_menu')) {
    //         this.$save_name.find('input').first().focus();
    //     }
    // },
    // _closeMenus: function () {
    //     this.toggle_save_menu(false);
    // },

    // get_default_filter: function () {
    //     var personal_filter = _.find(this.filters, function (filter) {
    //         return filter.user_id && filter.is_default;
    //     });
    //     if (personal_filter) {
    //         return personal_filter;
    //     }
    //     return _.find(this.filters, function (filter) {
    //         return !filter.user_id && filter.is_default;
    //     });
    // },
    // *
    //  * Generates a mapping key (in the filters and $filter mappings) for the
    //  * filter descriptor object provided (as returned by ``get_filters``).
    //  *
    //  * The mapping key is guaranteed to be unique for a given (user_id, name)
    //  * pair.
    //  *
    //  * @param {Object} filter
    //  * @param {String} filter.name
    //  * @param {Number|Pair<Number, String>} [filter.user_id]
    //  * @return {String} mapping key corresponding to the filter

    // key_for: function (filter) {
    //     var user_id = filter.user_id,
    //         action_id = filter.action_id,
    //         uid = (user_id instanceof Array) ? user_id[0] : user_id,
    //         act_id = (action_id instanceof Array) ? action_id[0] : action_id;
    //     return _.str.sprintf('(%s)(%s)%s', uid, act_id, filter.name);
    // },
    // /**
    //  * Generates a :js:class:`~instance.web.search.Facet` descriptor from a
    //  * filter descriptor
    //  *
    //  * @param {Object} filter
    //  * @param {String} filter.name
    //  * @param {Object} [filter.context]
    //  * @param {Array} [filter.domain]
    //  * @return {Object}
    //  */
    // facet_for: function (filter) {
    //     var self = this;
    //     return {
    //         category: _t("Custom Filter"),
    //         icon: 'fa-star',
    //         field: {
    //             get_context: function () { return filter.context; },
    //             get_groupby: function () { return [filter.context]; },
    //             // facet is not used
    //             get_domain: function (facet, noEvaluation) {
    //                 noEvaluation = noEvaluation || false;
    //                 var userContext = self.getSession().user_context;
    //                 var domain = pyUtils.assembleDomains([filter.domain]);
    //                 if (!noEvaluation) {
    //                     return Domain.prototype.stringToArray(domain, userContext);
    //                 }
    //                 return domain;
    //             }
    //         },
    //         _id: filter.id,
    //         is_custom_filter: true,
    //         values: [{label: filter.name, value: null}]
    //     };
    // },
    // clear_selection: function () {
    //     this.$('.selected').removeClass('selected');
    // },
    // /**
    //  * Adds a filter description to the filters dict
    //  * @param {Object} [filter] the filter description
    //  */
    // add_filter: function (filter) {
    //     this.filters[this.key_for(filter)] = filter;
    // },
    // /**
    //  * Creates a $filter JQuery node, adds it to the $filters dict and appends it to the filter menu
    //  * @param {Object} [filter] the filter description
    //  */
    // append_filter: function (filter) {
    //     var self = this;
    //     var key = this.key_for(filter);

    //     if (filter.user_id) {
    //         this.$user_divider.show();
    //     } else {
    //         this.$shared_divider.show();
    //     }
    //     if (!(key in this.$filters)) {
    //         var $filter = $('<div>', {class: 'position-relative'})
    //             .addClass(filter.user_id ? 'o-searchview-custom-private'
    //                                      : 'o-searchview-custom-public')
    //             .append($('<a>', {href: '#', class: 'dropdown-item'}).text(filter.name))
    //             .append($('<span>', {
    //                 class: 'fa fa-trash-o o-remove-filter',
    //                 on: {
    //                     click: function (event) {
    //                         event.stopImmediatePropagation();
    //                         self.remove_filter(filter, $filter, key);
    //                     },
    //                 },
    //             }))
    //             .insertBefore(filter.user_id ? this.$user_divider : this.$shared_divider);
    //         this.$filters[key] = $filter;
    //     }
    //     this.$filters[key].unbind('click').click(function () {
    //         self.toggle_filter(filter);
    //     });
    // },
    // toggle_filter: function (filter, preventSearch) {
    //     var current = this.query.find(function (facet) {
    //         return facet.get('_id') === filter.id;
    //     });
    //     if (current) {
    //         this.query.remove(current);
    //         this.$filters[this.key_for(filter)].find('.dropdown-item').removeClass('selected');
    //         return;
    //     }
    //     this.query.reset([this.facet_for(filter)], {
    //         preventSearch: preventSearch || false});

    //     // Load sort settings on view
    //     if (!_.isUndefined(filter.sort)){
    //         var sort_items = JSON.parse(filter.sort);
    //         this.searchview.dataset.set_sort(sort_items);
    //     }

    //     this.$filters[this.key_for(filter)].find('.dropdown-item').addClass('selected');
    // },
    // remove_filter: function (filter, $filter, key) {
    //     var self = this;
    //     var global_warning = _t("This filter is global and will be removed for everybody if you continue."),
    //         warning = _t("Are you sure that you want to remove this filter?");
    //     if (!confirm(filter.user_id ? warning : global_warning)) {
    //         return;
    //     }
    //     return data_manager
    //         .delete_filter(filter)
    //         .done(function () {
    //             $filter.remove();
    //             delete self.$filters[key];
    //             delete self.filters[key];
    //             var has_user_filter = _.find(self.filters, function(filter) { return filter.user_id; });
    //             var has_shared_filer = _.find(self.filters, function(filter) { return !filter.user_id; });
    //             if (!has_user_filter) {
    //                 self.$user_divider.hide();
    //             }
    //             if (!has_shared_filer) {
    //                 self.$shared_divider.hide();
    //             }
    //         });
    // },

    // //--------------------------------------------------------------------------
    // // Private
    // //--------------------------------------------------------------------------

    // /**
    //  * Creates a new search view filter.
    //  *
    //  * @private
    //  * @param {Object} filter the filter description
    //  * @returns {$.Deferred} resolved with the RPC's result when it succeeds
    //  */
    // _createFilter: function (filter) {
    //     var def = $.Deferred();
    //     this.trigger_up('create_filter', {
    //         filter: filter,
    //         on_success: def.resolve.bind(def),
    //     });
    //     return def;
    // },
});

return FavoritesMenu;

});