odoo.define('web_editor.wysiwyg.iframe', function (require) {
'use strict';

var Wysiwyg = require('web_editor.wysiwyg');
var ajax = require('web.ajax');


/**
 * Add option (inIframe) to load Wysiwyg in an iframe.
 **/
Wysiwyg.include({
    /**
     * Add options to load Wysiwyg in an iframe.
     *
     * @override
     * @param {boolean} options.inIframe
     **/
    init: function (parent, options) {
        this._super.apply(this, arguments);
        if (this.options.inIframe) {
            if (!this.options.iframeCssAssets) {
                this.options.iframeCssAssets = 'web_editor.wysiwyg_iframe_css_assets';
            }
            this._onUpdateIframeId = 'onLoad_' + this.id;
        }
    },
    /**
     * Load assets to inject into iframe.
     *
     * @override
     **/
    willStart: function () {
        if (!this.options.inIframe) {
            return this._super();
        }
        if (this.options.iframeCssAssets) {
            this.defAsset = ajax.loadAsset(this.options.iframeCssAssets);
        } else {
            this.defAsset = $.when({cssLibs: [], cssContents: []});
        }
        this.$target = this.$el;
        return this.defAsset
            .then(this._loadIframe.bind(this))
            .then(this._super.bind(this))
            .then(this._enableBootstrapInIframe.bind(this));
    },
    /**
     * @override
     */
    destroy: function () {
        if (!this.options.inIframe) {
            return this._super();
        }
        $(document.body).off('.' + this.id);

        this.$target.insertBefore(this.$iframe);

        delete window.top[this._onUpdateIframeId];
        if (this.$iframeTarget) {
            this.$iframeTarget.remove();
        }
        if (this.$iframe) {
            this.$iframe.remove();
        }
        this._super();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Change fullsreen feature.
     *
     * @override
     * @returns {Object} modules list to load
     */
    _getPlugins: function () {
        var plugins = this._super();
        /* plugins.fullscreen = plugins.fullscreen.extend({
            toggle: function () {
                if (!self.$iframe) {
                    return this._super();
                }
                self.$iframe.toggleClass('o_fullscreen');
                self.$iframe.contents().find('body').toggleClass('o_fullscreen');
            },
            isFullscreen: function () {
                if (!self.$iframe) {
                    return this._super();
                }
                return self.$iframe.hasClass('o_fullscreen');
            },
        }); */
        return plugins;
    },
    /**
     * This method is called after the iframe is loaded with the editor. This is
     * to activate the bootstrap features that out of the iframe would launch
     * automatically when changing the dom.
     *
     * @private
     */
    _enableBootstrapInIframe: function () {
        var body = this.$iframe[0].contentWindow.document.body;
        var $toolbarButtons = this._summernote.layoutInfo.toolbar.find('[data-toggle="dropdown"]').dropdown({
            boundary: body,
        });

        function hideDrowpdown() {
            var $expended = $toolbarButtons.filter('[aria-expanded="true"]').parent();
            $expended.children().removeAttr('aria-expanded').removeClass('show');
            $expended.removeClass('show');
        }
        $(body).on('mouseup.' + this.id, hideDrowpdown);
        $(document.body).on('click.' + this.id, hideDrowpdown);
    },
    /**
     * Create iframe, inject css and create a link with the content,
     * then inject the target inside.
     *
     * @private
     * @returns {Promise}
     */
    _loadIframe: function () {
        this.$iframe = $('<iframe class="wysiwyg_iframe">').css({
            'min-height': '400px',
            width: '100%'
        });
        var avoidDoubleLoad = 0; // this bug only appears on some configurations.

        // resolve deferred on load

        var def = $.Deferred();
        this.$iframe.data('load-def', def);  // for unit test
        window.top[this._onUpdateIframeId] = function (_avoidDoubleLoad) {
            if (_avoidDoubleLoad !== avoidDoubleLoad) {
                console.warn('Wysiwyg iframe double load detected');
                return;
            }
            delete window.top[this._onUpdateIframeId];
            var $iframeTarget = this.$iframe.contents().find('#iframe_target');
            $iframeTarget.append(this.$target);
            def.resolve();
        }.bind(this);

        // inject content in iframe

        this.$iframe.on('load', function onLoad (ev) {
            var _avoidDoubleLoad = ++avoidDoubleLoad;
            this.defAsset.then(function (asset) {
                if (_avoidDoubleLoad !== avoidDoubleLoad) {
                    console.warn('Wysiwyg immediate iframe double load detected');
                    return;
                }
                var cwindow = this.$iframe[0].contentWindow;
                cwindow.document
                    .open("text/html", "replace")
                    .write(
                        '<head>' +
                            '<meta charset="utf-8">' +
                            '<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1"/>\n' +
                            '<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"/>\n' +
                            _.map(asset.cssLibs, function (cssLib) {
                                return '<link type="text/css" rel="stylesheet" href="' + cssLib + '"/>';
                            }).join('\n') + '\n' +
                            _.map(asset.cssContents, function (cssContent) {
                                return '<style type="text/css">' + cssContent + '</style>';
                            }).join('\n') + '\n' +
                            _.map(asset.jsContents, function (jsContent) {
                                if (jsContent.indexOf('<inline asset>') !== -1) {
                                    return '<script type="text/javascript">' + jsContent + '</script>';
                                }
                            }).join('\n') + '\n' +
                        '</head>\n' +
                        '<body class="o_in_iframe">\n' +
                            '<div id="iframe_target" style="height: calc(100vh - 6px);"></div>\n' +
                            '<script type="text/javascript">' +
                                'if (window.top.' + this._onUpdateIframeId + ') {' +
                                    'window.top.' + this._onUpdateIframeId + '(' + _avoidDoubleLoad + ')' +
                                '}' +
                            '</script>\n' +
                        '</body>');
            }.bind(this));
        }.bind(this));

        this.$iframe.insertAfter(this.$target);

        return def.promise();
    },
});

//--------------------------------------------------------------------------
// Public helper
//--------------------------------------------------------------------------

});
