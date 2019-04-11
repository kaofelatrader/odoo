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
    lang: 'en_US',
    plugins: {
        History: true,
        Toolbar: true,
        Popover: true,
        // Handle: true,
        KeyMap: true,
        Keyboard: true,
        Jinja: false,
        Iframe: false,
        Test: true,
    },
    // toolbar
    toolbar: [
        'DropBlock',
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
        // 'Text.get': ['FontStyle', 'FontSize', 'ForeColor', 'BgColor'], // eg for air mode
    },
    iframeWillCached: true,
    width: null,
    height: null,
    minHeight: 180,
    tabSize: 4,
    maxTextLength: 0,
    disableDragAndDrop: null,
    maximumImageFileSize: null,
    styleTags: [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        {
            title: 'Blockquote',
            tag: 'div', // div by default
            className: 'blockquote',
        },
        'pre'
    ],
    fontNames: [
        'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New',
        'Helvetica Neue', 'Helvetica', 'Impact', 'Lucida Grande',
        'Tahoma', 'Times New Roman', 'Verdana'
    ],
    fontSizes: ['Default', '8', '9', '10', '11', '12', '13', '14', '18', '24', '36', '48', '62'],
    lineHeights: ['1.0', '1.2', '1.4', '1.5', '1.6', '1.8', '2.0', '3.0'],
    // palette colors(n x n)
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
    keyMap: {
        pc: {
            'CTRL+Z':           'History.undo',
            'CTRL+Y':           'History.redo',
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
            'CTRL+SHIFT+NUM9':  'List.insertList:checklist',
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
            'CTRL+J':           'Media.showImageDialog',
            'CTRL+K':           'Link.showLinkDialog',
            // 'CTRL+ENTER':       'insertHorizontalRule',
            'TAB':              'Keyboard.handleTab',
            'SHIFT+TAB':        'Keyboard.handleTab:true',
        },
        mac: {
            'CMD+Z':            'History.undo',
            'CMD+SHIFT+Z':      'History.redo',
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
            'CMD+SHIFT+NUM9':   'List.insertList:checklist',
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
            'CMD+J':            'Media.showImageDialog',
            'CMD+K':            'Link.showLinkDialog',
            'TAB':              'Keyboard.handleTab',
            'SHIFT+TAB':        'Keyboard.handleTab:true',
            // 'CMD+ENTER':       'insertHorizontalRule',
        },
        help: {
            'History.undo':             'Undoes the last command',
            'History.redo':             'Redoes the last command',
            'FontStyle.formatText:B':   'Set a bold style',
            'FontStyle.formatText:I':   'Set a italic style',
            'FontStyle.formatText:U':   'Set a underline style',
            'FontStyle.formatText:S':   'Set a strikethrough style',
            'FontStyle.removeFormat':   'Clean a style',
            'Paragraph.formatBlockStyle:justifyLeft':   'Set left align',
            'Paragraph.formatBlockStyle:justifyCenter': 'Set center align',
            'Paragraph.formatBlockStyle:justifyRight':  'Set right align',
            'Paragraph.formatBlockStyle:justifyFull':   'Set full align',
            'List.insertList:u':        'Toggle unordered list',
            'List.insertList:o':        'Toggle ordered list',
            'List.insertList:checklist':'Toggle checklist',
            'Paragraph.outdent':        'Outdent current paragraph',
            'Paragraph.indent':         'Indent current paragraph',
            'FontStyle.formatBlock:P':  'Change current block\'s format as a paragraph(P tag)',
            'FontStyle.formatBlock:H1': 'Change current block\'s format as H1',
            'FontStyle.formatBlock:H2': 'Change current block\'s format as H2',
            'FontStyle.formatBlock:H3': 'Change current block\'s format as H3',
            'FontStyle.formatBlock:H4': 'Change current block\'s format as H4',
            'FontStyle.formatBlock:H5': 'Change current block\'s format as H5',
            'FontStyle.formatBlock:H6': 'Change current block\'s format as H6',
            'FontStyle.formatBlock:BLOCKQUOTE': 'Change current block\'s format as BLOCKQUOTE',
            'FontStyle.formatBlock:PRE':'Change current block\'s format as PRE for code',
            'Media.showImageDialog':    'Show Media Dialog (image, document, video, font)',
            'Link.showLinkDialog':      'Show Link Dialog',
            'Keyboard.handleTab':       'Indent (when at the start of a line)',
            'Keyboard.handleTab:true': 'Outdent (when at the start of a line)',
            // insertHorizontalRule: 'Insert horizontal rule'),
        }
    },

    dropBlockTemplate: 'wysiwyg.dropblock.defaultblocks',
    // dropblocks: [{
    //     title: 'Structure',
    //     blocks: [{
    //         title: 'Title block',
    //         thumbnail: '/web_editor/static/src/img/title.png',
    //         html: '<section style="text-align: center;"><h1>Your Site Title</h1></section>',
    //     }, {
    //         title: 'Image block',
    //         thumbnail: '/web_editor/static/src/img/title.png',
    //         html: '<section style="text-align: center;"><h1>Your Site Title</h1><img src="/web_editor/static/src/img/picture.png"/></section>',
    //     }],
    // }],

   // methods

    getColors: null,
    renderTemplate: null,
    loadTemplates: null,
    translate: null,
};

});
