odoo.define('wysiwyg.options', function (require) {
'use strict';

var isSupportAmd = typeof define === 'function' && define.amd; // eslint-disable-line
/**
 * returns whether font is installed or not.
 *
 * @param {String} fontName
 * @return {Boolean}
 */
var userAgent = navigator.userAgent;
var isEdge = /Edge\/\d+/.test(userAgent);
var env = {
    isMac: navigator.appVersion.indexOf('Mac') > -1,
    isMSIE: /MSIE|Trident/i.test(userAgent),
    isEdge: isEdge,
    isFF: !isEdge && /firefox/i.test(userAgent),
    isPhantom: /PhantomJS/i.test(userAgent),
    isWebkit: !isEdge && /webkit/i.test(userAgent),
    isChrome: !isEdge && /chrome/i.test(userAgent),
    isSafari: !isEdge && /safari/i.test(userAgent),
    isSupportTouch: (('ontouchstart' in window) ||
        (navigator.MaxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0)),
};

return {
    env: env,
    plugins: {
        History: true,
        Toolbar: true,
        Popover: true,
        // Unbreakable: true,
        // Handle: true,
        KeyMap: true,
    },
    lang: 'en_US',
    // toolbar
    followingToolbar: true,
    toolbar: [
        'FontStyle',
        'FontSize',
        // 'FontName',
        'ForeColor', 'BgColor',
        'List',
        'Paragraph',
        'TablePicker',
        'LinkCreate',
        'Media',
        'History',
        'CodeView',
        'FullScreen',
        'KeyMap',
    ],
    // popover
    popover: {
        'Image.get': ['Padding', 'MediaSize', 'Float', 'Media'/*, 'Alt'*/],
        'Video.get': ['Padding', 'MediaSize', 'Float', 'Media'],
        'Icon.get':  ['Padding', /*'IconSize', */'Float', /*'FaSpin',*/ 'Media'],
        'Document.get': ['Float', 'Media'],
        'Link.get': ['Link'],
        'Table.get':  ['Table'],
        // 'Text.get': ['FontStyle', 'FontSize', 'ForeColor', 'BgColor'],
    },
    // air mode: inline editor
    width: null,
    height: null,
    linkTargetBlank: true,
    tabSize: 4,
    shortcuts: true,
    tooltip: 'auto',
    maxTextLength: 0,
    styleTags: [
        'p',
        {
            title: 'Blockquote',
            tag: 'div', // div by default
            className: 'blockquote',
        },
        'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ],
    fontNames: [
        'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New',
        'Helvetica Neue', 'Helvetica', 'Impact', 'Lucida Grande',
        'Tahoma', 'Times New Roman', 'Verdana'
    ],
    fontSizes: ['8', '9', '10', '11', '12', '14', '18', '24', '36'],
    lineHeights: ['1.0', '1.2', '1.4', '1.5', '1.6', '1.8', '2.0', '3.0'],
    // pallete colors(n x n)
    colors: [
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
    ],
    insertTableMaxSize: {
        col: 10,
        row: 10
    },
    maximumImageFileSize: null,
    keyMap: {
        pc: {
            'CTRL+Z':           'History.undo',
            'CTRL+Y':           'History.redo',
            // 'TAB':              'tab',
            // 'SHIFT+TAB':        'untab',
            'CTRL+B':           'FontStyle.formatText:B',
            'CTRL+I':           'FontStyle.formatText:I',
            'CTRL+U':           'FontStyle.formatText:U',
            'CTRL+SHIFT+S':     'FontStyle.formatText:S',
            'CTRL+BACKSLASH':   'FontStyle.removeFormat',
            'CTRL+SHIFT+L':     'Paragraph.formatBlockStyle:justifyLeft',
            'CTRL+SHIFT+E':     'Paragraph.formatBlockStyle:justifyCenter',
            'CTRL+SHIFT+R':     'Paragraph.formatBlockStyle:justifyRight',
            'CTRL+SHIFT+J':     'Paragraph.formatBlockStyle:justifyFull',
            'CTRL+SHIFT+NUM7':  'List.insertList:u',
            'CTRL+SHIFT+NUM8':  'List.insertList:o',
            'CTRL+LEFTBRACKET': 'Paragraph.outdent',
            'CTRL+RIGHTBRACKET':'Paragraph.indent',
            'CTRL+NUM0':        'FontStyle.formatBlock:P',
            'CTRL+NUM1':        'FontStyle.formatBlock:H1',
            'CTRL+NUM2':        'FontStyle.formatBlock:H2',
            'CTRL+NUM3':        'FontStyle.formatBlock:H3',
            'CTRL+NUM4':        'FontStyle.formatBlock:H4',
            'CTRL+NUM5':        'FontStyle.formatBlock:H5',
            'CTRL+NUM6':        'FontStyle.formatBlock:H6',
            'CTRL+NUM7':        'FontStyle.formatBlock:BLOCKQUOTE',
            'CTRL+NUM8':        'FontStyle.formatBlock:PRE',
            // 'CTRL+ENTER':       'insertHorizontalRule',
            'CTRL+K':           'Media.showImageDialog'
        },
        mac: {
            'CMD+Z':           'History.undo',
            'CMD+SHIFT+Z':      'History.redo',
            // 'TAB':              'tab',
            // 'SHIFT+TAB':        'untab',
            'CMD+B':            'FontStyle.formatText:B',
            'CMD+I':            'FontStyle.formatText:I',
            'CMD+U':            'FontStyle.formatText:U',
            'CMD+SHIFT+S':      'FontStyle.formatText:S',
            'CMD+BACKSLASH':    'FontStyle.removeFormat',
            'CMD+SHIFT+L':      'Paragraph.formatBlockStyle:justifyLeft',
            'CMD+SHIFT+E':      'Paragraph.formatBlockStyle:justifyCenter',
            'CMD+SHIFT+R':      'Paragraph.formatBlockStyle:justifyRight',
            'CMD+SHIFT+J':      'Paragraph.formatBlockStyle:justifyFull',
            'CMD+SHIFT+NUM7':   'List.insertList:u',
            'CMD+SHIFT+NUM8':   'List.insertList:o',
            'CMD+LEFTBRACKET':  'Paragraph.outdent',
            'CMD+RIGHTBRACKET': 'Paragraph.indent',
            'CMD+NUM0':         'FontStyle.formatBlock:P',
            'CMD+NUM1':         'FontStyle.formatBlock:H1',
            'CMD+NUM2':         'FontStyle.formatBlock:H2',
            'CMD+NUM3':         'FontStyle.formatBlock:H3',
            'CMD+NUM4':         'FontStyle.formatBlock:H4',
            'CMD+NUM5':         'FontStyle.formatBlock:H5',
            'CMD+NUM6':         'FontStyle.formatBlock:H6',
            'CMD+NUM7':         'FontStyle.formatBlock:BLOCKQUOTE',
            'CMD+NUM8':         'FontStyle.formatBlock:PRE',
            // 'CMD+ENTER':       'insertHorizontalRule',
            'CMD+K':            'Media.showImageDialog'
        }
    },
};

});
