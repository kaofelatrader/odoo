odoo.define('wysiwyg.options', function (require) {
'use strict';

return {
    plugins: {
        History: true,
        Toolbar: true,
        Popover: true,
        // Unbreakable: true,
        // Handle: true,
        // KeyMap: true,
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
        // 'Help'
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
            'ENTER': 'insertParagraph',
            'CTRL+Z': 'undo',
            'CTRL+Y': 'redo',
            'TAB': 'tab',
            'SHIFT+TAB': 'untab',
            'CTRL+B': 'bold',
            'CTRL+I': 'italic',
            'CTRL+U': 'underline',
            'CTRL+SHIFT+S': 'strikethrough',
            'CTRL+BACKSLASH': 'removeFormat',
            'CTRL+SHIFT+L': 'justifyLeft',
            'CTRL+SHIFT+E': 'justifyCenter',
            'CTRL+SHIFT+R': 'justifyRight',
            'CTRL+SHIFT+J': 'justifyFull',
            'CTRL+SHIFT+NUM7': 'insertUnorderedList',
            'CTRL+SHIFT+NUM8': 'insertOrderedList',
            'CTRL+LEFTBRACKET': 'outdent',
            'CTRL+RIGHTBRACKET': 'indent',
            'CTRL+NUM0': 'formatPara',
            'CTRL+NUM1': 'formatH1',
            'CTRL+NUM2': 'formatH2',
            'CTRL+NUM3': 'formatH3',
            'CTRL+NUM4': 'formatH4',
            'CTRL+NUM5': 'formatH5',
            'CTRL+NUM6': 'formatH6',
            'CTRL+ENTER': 'insertHorizontalRule',
            'CTRL+K': 'linkDialog.show'
        },
        mac: {
            'ENTER': 'insertParagraph',
            'CMD+Z': 'undo',
            'CMD+SHIFT+Z': 'redo',
            'TAB': 'tab',
            'SHIFT+TAB': 'untab',
            'CMD+B': 'bold',
            'CMD+I': 'italic',
            'CMD+U': 'underline',
            'CMD+SHIFT+S': 'strikethrough',
            'CMD+BACKSLASH': 'removeFormat',
            'CMD+SHIFT+L': 'justifyLeft',
            'CMD+SHIFT+E': 'justifyCenter',
            'CMD+SHIFT+R': 'justifyRight',
            'CMD+SHIFT+J': 'justifyFull',
            'CMD+SHIFT+NUM7': 'insertUnorderedList',
            'CMD+SHIFT+NUM8': 'insertOrderedList',
            'CMD+LEFTBRACKET': 'outdent',
            'CMD+RIGHTBRACKET': 'indent',
            'CMD+NUM0': 'formatPara',
            'CMD+NUM1': 'formatH1',
            'CMD+NUM2': 'formatH2',
            'CMD+NUM3': 'formatH3',
            'CMD+NUM4': 'formatH4',
            'CMD+NUM5': 'formatH5',
            'CMD+NUM6': 'formatH6',
            'CMD+ENTER': 'insertHorizontalRule',
            'CMD+K': 'linkDialog.show'
        }
    },
};

});
