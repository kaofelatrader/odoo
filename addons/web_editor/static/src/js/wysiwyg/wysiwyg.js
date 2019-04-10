odoo.define('web_editor.wysiwyg', function (require) {
'use strict';

var config = require('web.config');
var ajax = require('web.ajax');
var core = require('web.core');
var session = require('web.session');
var Widget = require('web.Widget');
var Editor = require('wysiwyg.editor');

var _t = core._t;
var QWeb = core.qweb;


var Wysiwyg = Widget.extend({
    templatesDependencies: [
        '/web_editor/static/src/xml/wysiwyg.xml',
    ],
    custom_events: {
        getRecordInfo: '_onGetRecordInfo',
        change: '_onChange',
        // imageUpload : '_onImageUpload',
    },
    defaultOptions: {
        codeview: config.debug
    },

    /**
     * @params {Object} params
     * @params {Object} params.recordInfo
     * @params {Object} params.recordInfo.context
     * @params {String} [params.recordInfo.context]
     * @params {integer} [params.recordInfo.res_id]
     * @params {String} [params.recordInfo.data_res_model]
     * @params {integer} [params.recordInfo.data_res_id]
     *   @see _onGetRecordInfo
     *   @see _getAttachmentsDomain in /wysiwyg/widgets/media.js
     * @params {Object} params.attachments
     *   @see _onGetRecordInfo
     *   @see _getAttachmentsDomain in /wysiwyg/widgets/media.js (for attachmentIDs)
     * @params {function} params.generateOptions
     *   called with the summernote configuration object used before sending to summernote
     *   @see _editorOptions
     **/
    init: function (parent, params) {
        this._super.apply(this, arguments);
        this.options = _.extend({}, this.defaultOptions, params);
        this.attachments = this.options.attachments || [];
        this.hints = [];
        this.$el = null;
        this._dirty = false;
    },
    /**
     * Load assets and color picker template then call summernote API
     * and replace $el by the summernote editable node.
     *
     * @override
     **/
    willStart: function () {
        var self = this;
        this.$target = this.$el;
        this.$el = null; // temporary null to avoid hidden error, setElement when start
        return this._super()
            .then(function () {
                var defs = [self._getColors()];
                if (true || self.options.snippets) {
                    defs.push(self._loadDropBlocks());
                }
                return $.when.apply($, defs);
            })
            .then(function () {
                self.editor = new Editor(self, self._editorOptions());
                return $.when(self.editor.isInitialized());
            });
    },
    /**
     *
     * @override
     */
    start: function () {
        var self = this;
        return this.editor.start(this.$target[0]).then(function () {
            self.setElement(self.editor.editor);
        });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Set the focus on the element.
     */
    focus: function () {
        this.editor.focus();
    },
    save: function () {
        return this.editor.save();
    },
    setValue: function (value) {
        return this.editor.setValue(value);
    },
    getValue: function () {
        return this.editor.getValue();
    },
    isDirty: function () {
        return this.editor.isDirty();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @returns {Object} the summernote configuration
     */
    _editorOptions: function () {
        var options = {
            lang : "odoo",
            disableDragAndDrop : !!this.options.noAttachment,
            styleTags: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'],
            colors: this._groupColors,
            dropblocks: this._dropblocks,
            plugins: this.options.plugins,
            renderTemplate: this._renderTemplate.bind(this),
            loadTemplates: this._loadTemplates.bind(this),
            translate: this._translate.bind(this),
        };
        if (this.options.generateOptions) {
            this.options.generateOptions(options);
        }
        return options;
    },
    /**
     * Return an object describing the linked record.
     *
     * @private
     * @param {Object} options
     * @returns {Object} {res_id, res_model, xpath}
     */
    _getRecordInfo: function (options) {
        var data = this.options.recordInfo || {};
        if (typeof data === 'function') {
            data = data(options);
        }
        if (!data.context) {
            throw new Error("Context is missing");
        }
        return data;
    },
    _getColors: function () {
        var self = this;
        var def = $.when();
        if (!('web_editor.colorpicker' in QWeb.templates)) {
            var def = this._rpc({
                model: 'ir.ui.view',
                method: 'read_template',
                args: ['web_editor.colorpicker'],
            }).then(function (template) {
                return QWeb.add_template('<templates>' + template + '</templates>');
            });
        }

        return def.then(function () {
            var groupColors = [];
            var $clpicker = $(QWeb.render('web_editor.colorpicker'));
            $clpicker.children('.o_colorpicker_section').each(function () {
                groupColors.push($(this).attr('data-display'));
                var colors = [];
                $(this.children).each(function () {
                    if ($(this).hasClass('clearfix')) {
                        groupColors.push(colors);
                        colors = [];
                    } else {
                        colors.push($(this).attr('data-color') || '');
                    }
                });
                groupColors.push(colors);
            });

            groupColors = groupColors.concat([
                'Grey',
                ['#000000', '#424242', '#636363', '#9C9C94', '#CEC6CE', '#EFEFEF', '#F7F7F7', '#FFFFFF'],
                'Colors',
                ['#FF0000', '#FF9C00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#9C00FF', '#FF00FF'],
                ['#F7C6CE', '#FFE7CE', '#FFEFC6', '#D6EFD6', '#CEDEE7', '#CEE7F7', '#D6D6E7', '#E7D6DE'],
                ['#E79C9C', '#FFC69C', '#FFE79C', '#B5D6A5', '#A5C6CE', '#9CC6EF', '#B5A5D6', '#D6A5BD'],
                ['#E76363', '#F7AD6B', '#FFD663', '#94BD7B', '#73A5AD', '#6BADDE', '#8C7BC6', '#C67BA5'],
                ['#CE0000', '#E79439', '#EFC631', '#6BA54A', '#4A7B8C', '#3984C6', '#634AA5', '#A54A7B'],
                ['#9C0000', '#B56308', '#BD9400', '#397B21', '#104A5A', '#085294', '#311873', '#731842'],
                ['#630000', '#7B3900', '#846300', '#295218', '#083139', '#003163', '#21104A', '#4A1031']
            ]);

            self._groupColors = groupColors;
        });
    },
    /**
     * Load snippets.
     */
    _loadDropBlocks: function () {
        var self = this;
        var def = $.when();
        if (!('web_editor.dropBlockTemplate.custom' in QWeb.templates)) {
            var def = this._rpc({
                model: 'ir.ui.view',
                method: 'render_template',
                args: [this.options.snippets || 'web_editor.snippets', {}],
            }).then(function (template) {
                var t = document.createElement('t');
                t.setAttribute('t-name', 'web_editor.dropBlockTemplate.custom');
                t.innerHTML = template;
                var xml = new XMLSerializer().serializeToString(t).replace(/\s*xmlns="[^"]+"/, '');
                QWeb.add_template('<templtes>' + xml + '</templtes>');
            })
        }

        return def.then(function () {
            var dropblocks = [];
            var dropblockSelector = [];
            var blockCustomisation = [];
            var $dropBlockTemplate = $(QWeb.render('web_editor.dropBlockTemplate.custom'));
            var $snippets = $dropBlockTemplate.filter('#o_scroll').find('.o_panel').each(function () {
                var blocks = [];
                $(this).find('.o_panel_body').children().each(function () {
                    blocks.push({
                        title: (this.getAttribute('name') + '').trim(),
                        thumbnail: this.dataset.oeThumbnail,
                        html: this.innerHTML.trim(),
                    });
                });
                dropblocks.push({
                    title: $(this).find('.o_panel_header').html().trim(),
                    blocks: blocks,
                });
            });
            var $snippet_options = $dropBlockTemplate.filter('#snippet_options');

            self._dropblocks = dropblocks;
            self._dropblockSelector = dropblockSelector;
            self._blockCustomisation = blockCustomisation;
        });
    },
    _loadTemplates: function (xmlPaths) {
        var promises = [];
        var xmlPath;
        while ((xmlPath = xmlPaths.shift())) {
            promises.push(ajax.loadXML(xmlPath, QWeb));
        }
        return $.when.apply($, promises);
    },
    _renderTemplate: function (pluginName, template, values) {
        return QWeb.render(template, values);
    },
    _select: function (range) {
        var nativeRange = range.toNativeRange();
        var selection = range.getSelection();
        if (selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
        selection.addRange(nativeRange);
        var sc = nativeRange.startContainer;
        $(sc.tagName ? sc : sc.parentNode).trigger('wysiwyg.range');
        return range;
    },
    _translate: function (pluginName, string) {
        string = string.replace(/\s\s+/g, ' ');
        return _t(string);
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    /**
     * trigger_up 'wysiwyg_change'
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onChange: function (ev) {
        // if (this.hints.length) {
        //     var hints = [];
        //     _.each(this.hints, function (hint) {
        //         if (html.indexOf('@' + hint.name) !== -1) {
        //             hints.push(hint);
        //         }
        //     });
        //     this.hints = hints;
        // }

        ev.stopPropagation();
        this.trigger_up('wysiwyg_change', {
            html: this.getValue(),
            hints: this.hints,
            attachments: this.attachments,
        });
    },
    /**
     * trigger_up 'wysiwyg_attachment' when add an image found in the view.
     *
     * This method is called when an image is uploaded by the media dialog and returns the
     * object attachment as recorded in the "ir.attachment" model, via a wysiwyg_attachment event.
     *
     * For e.g. when sending email, this allows people to add attachments with the content
     * editor interface and that they appear in the attachment list.
     * The new documents being attached to the email, they will not be erased by the CRON
     * when closing the wizard.
     *
     * @private
     */
    _onImageUpload: function (attachments) {
        var self = this;
        attachments = _.filter(attachments, function (attachment) {
            return !_.findWhere(self.attachments, {
                id: attachment.id,
            });
        });
        if (!attachments.length) {
            return;
        }
        this.attachments = this.attachments.concat(attachments);

        // todo remove image not in the view

        this.trigger_up.bind(this, 'wysiwyg_attachment', this.attachments);
    },
    /**
     * Do not override.
     *
     * @see _getRecordInfo
     * @private
     * @param {OdooEvent} ev
     * @param {Object} ev.data
     * @param {Object} ev.data.recordInfo
     * @param {Function(recordInfo)} ev.data.callback
     */
    _onGetRecordInfo: function (ev) {
        var data = this._getRecordInfo(ev.data);
        data.attachmentIDs = _.pluck(this.attachments, 'id');
        data.user_id = session.uid || session.user_id;
        ev.data.callback(data);
    },
});

//--------------------------------------------------------------------------
// Public helper
//--------------------------------------------------------------------------

/**
 * Load wysiwyg assets if needed.
 *
 * @see Wysiwyg.createReadyFunction
 * @param {Widget} parent
 * @returns {$.Promise}
 */
Wysiwyg.prepare = (function () {
    var assetsLoaded = false;
    var def;
    return function prepare(parent) {
        if (assetsLoaded) {
            return $.when();
        }
        if (def) {
            return def;
        }
        def = $.Deferred();
        var timeout = setTimeout(function () {
            throw _t("Can't load assets of the wysiwyg editor");
        }, 10000);
        var wysiwyg = new Wysiwyg(parent, {
            recordInfo: {
                context: {},
            }
        });
        wysiwyg.attachTo($('<textarea>')).then(function () {
            assetsLoaded = true;
            clearTimeout(timeout);
            wysiwyg.destroy();
            def.resolve();
        });
        return def;
    };
})();

//--------------------------------------------------------------------------
// jQuery extensions
//--------------------------------------------------------------------------

$.extend($.expr[':'], {
    o_editable: function (node, i, m) {
        while (node) {
            if (node.attributes) {
                if (
                    node.classList.contains('o_not_editable') ||
                    (node.attributes.contenteditable &&
                        node.attributes.contenteditable.value !== 'true' &&
                        !node.classList.contains('o_fake_not_editable'))
                ) {
                    return false;
                }
                if (
                    node.classList.contains('o_editable') ||
                    (node.attributes.contenteditable &&
                        node.attributes.contenteditable.value === 'true' &&
                        !node.classList.contains('o_fake_editable'))
                ) {
                    return true;
                }
            }
            node = node.parentNode;
        }
        return false;
    },
});

return Wysiwyg;
});
