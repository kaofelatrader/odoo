odoo.define('web_editor.wysiwyg.plugin.transform', function (require) {
'use strict';

var core = require('web.core');
var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var wysiwygOptions = require('wysiwyg.options');

var _t = core._t;


var TransformPlugin = AbstractPlugin.extend({
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Manages transformations on a media.
     */
    transform: function (value, target) {
        var $image = $(target);

        if ($image.data('transfo-destroy')) {
            $image.removeData('transfo-destroy');
            return;
        }

        $image.transfo(); // see web_editor/static/lib/jQuery.transfo.js

        var mouseup = function () {
            $('.note-popover button[data-event="transform"]').toggleClass('active', $image.is('[style*="transform"]'));
        };
        $(document).on('mouseup', mouseup);

        var mousedown = this._wrapCommand(function (event) {
            if (!$(event.target).closest('.transfo-container').length) {
                $image.transfo('destroy');
                $(document).off('mousedown', mousedown).off('mouseup', mouseup);
            }
            if ($(event.target).closest('.note-popover').length) {
                var transformStyles = this.utils.getRegex('', 'g', '[^;]*transform[\\w:]*;?');
                $image.data('transfo-destroy', true).attr('style', ($image.attr('style') || '').replace(transformStyles, ''));
            }
        });
        $(document).on('mousedown', mousedown);
    },
});


// _.extend(wysiwygTranslation.image, {
//     transform: _t('Transform the picture (click twice to reset transformation)'),
// });

Manager.addPlugin('TransformPlugin', TransformPlugin);

return TransformPlugin;

});
