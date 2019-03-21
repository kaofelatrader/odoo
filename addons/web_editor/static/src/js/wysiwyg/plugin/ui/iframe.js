odoo.define('web_editor.wysiwyg.plugin.iframe', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var ajax = require('web.ajax');
var cache = {};


var IframePlugin = AbstractPlugin.extend({
    loaderKey: 'wysiwygPluginIframeOnLoad',
    defaultCSS: 'body {background-color: transparent;}'+
                'editable {width: 100%; display: block; min-height: 92%;}'+
                'editable, editable:focus {outline: none;}',

    /**
     * @override
     **/
    init: function () {
        this._super.apply(this, arguments);

        if (typeof this.options.iframeCssAssets === 'string') {
            this.defAsset = ajax.loadAsset(this.options.iframeCssAssets);
        } else {
            this.defAsset = Promise.resolve({cssLibs: [], cssContents: []});
        }

        if (this.options.iframeWillCached) {
            this._initPreloadIframeCached();
        } else {
            this._initPreloadIframe();
        }

        this._loadIframePromise = this._createIframe();
        this.params.insertAfterContainer(this.iframe);
    },
    isInitialized: function () {
        return Promise.all([this.defAsset, this._preloadIframePromise]);
    },
    /**
     * At this step, the container of the preload iframe is inserted in the DOM. Every plugins have
     * their content into this container.
     *
     * The iframe is allready inside the DOM (not in the container)
     *
     * @override
     **/
    start: function () {
        var promise = this._loadIframePromise.then(this._moveToIframeFromPreload.bind(this));
        if (this.editable.ownerDocument.contains(this.iframe)) {
            return promise;
        } else {
            return Promise.resolve({fakeLoading: 'target is not in the DOM'});
        }
    },
    destroy: function () {
        if (this._preloadIframe && this._preloadIframe.parentNode) {
            this._preloadIframe.parentNode.removeChild(this._preloadIframe);
        }
        delete window.top[this.loaderKey + this.editorId + '_start'];
        delete window.top[this.loaderKey + this.editorId + '_load'];
        this._super();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _initPreloadIframe: function () {
        var self = this;
        this._preloadIframePromise = this._createPreloadIframe();
        document.body.appendChild(this._preloadIframe);

        var cached = cache[this.options.iframeCssAssets+''] = {
            promise: this._preloadIframePromise,
        };

        this._preloadIframePromise.then(function (iframe) {
            var node = document.createElement('editor');
            self.params.addEditableContainer(node);

            cached.node = self._preloadEditorContainer = node;
            cached.style = self._preloadIframeStyle = [].slice.call(iframe.contentDocument.head.childNodes);
        });
    },
    _initPreloadIframeCached: function () {
        var self = this;
        var cached = cache[this.options.iframeCssAssets+''];
        if (cached) {
            cached.promise.then(function () {
                var node = document.createElement('editor');
                self.params.addEditableContainer(node);

                self._preloadEditorContainer = node;
                self._preloadIframeStyle = cached.style;
            });
            this._preloadIframePromise = cached.promise;
        } else {
            this._initPreloadIframe();
        }
    },
    /**
     * Create iframe, inject css and create a link with the content,
     * then inject the target inside.
     *
     * @private
     * @returns {Promise}
     */
    _createPreloadIframe: function () {
        this._preloadIframe = document.createElement('iframe');
        this._preloadIframe.style.display = 'none';
        this._preloadIframe.style.position = 'absolute';
        return this._createPromiseOnLoadIframe('preload', this._preloadIframe);
    },
    _createIframe: function () {
        var self = this;
        this.iframe = document.createElement('iframe');
        var loadPromise = new Promise(function (resolve) {
            self.iframe.addEventListener('load', resolve, false);
        });

        return loadPromise;
    },
    _createPromiseOnLoadIframe: function (step, iframe) {
        var self = this;
        var key = this.loaderKey + '_' + this.editorId + '_' + step;

        var loadPromise = new Promise(function (resolve) {
            iframe.addEventListener('load', resolve, false);
        });

        Promise.all([this.defAsset, loadPromise]).then(function (defResults) {
            self._insertAssetInIframe(step, iframe, defResults[0]);
        });

        return new Promise(function (resolve) {
            // resolve deferred on load the body of this iframe
            window.top[key] = function () {
                delete window.top[key];
                resolve(iframe);
            };
        });
    },
    _insertAssetInIframe: function (step, iframe, assets) {
        var key = this.loaderKey + '_' + this.editorId + '_' + step;
        iframe.name = key;
        iframe.contentDocument
            .open("text/html", "replace")
            .write(
                '<head>' +
                    '<meta charset="utf-8">' +
                    '<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1"/>\n' +
                    '<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"/>\n' +
                    '<style type="text/css">' + this.defaultCSS + '</style>\n' +
                    (assets.cssLibs || []).map(function (cssLib) {
                        return '<link type="text/css" rel="stylesheet" href="' + cssLib + '"/>';
                    }).join('\n') + '\n' +
                    (assets.cssContents || []).map(function (cssContent) {
                        return '<style type="text/css">' + cssContent + '</style>';
                    }).join('\n') + '\n' +
                '</head>\n' +
                '<body></body>');

            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.textContent = "window.top['" + key + "'] && window.top['" + key + "']();";
            var head = iframe.contentDocument.firstElementChild.firstElementChild;
            head.appendChild(script);
    },

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    _moveToIframeFromPreload: function () {
        var self = this;
        var doc = this.iframe.contentDocument;
        doc.body.innerHTML = '';
        doc.body.appendChild(this._preloadEditorContainer);

        this._preloadIframeStyle.forEach(function (node) {
            var defaultView = node.ownerDocument.defaultView;
            var parentIframe = defaultView && defaultView.frameElement;
            if (parentIframe && parentIframe.parentNode && parentIframe !== self._preloadIframe) {
                node = self.utils.clone(node);
            }
            doc.head.appendChild(node);
        });

        if (this._preloadIframe && this._preloadIframe.parentNode) {
            this._preloadIframe.parentNode.removeChild(this._preloadIframe);
        }
    },
});

Manager.addPlugin('Iframe', IframePlugin);

return IframePlugin;

});
