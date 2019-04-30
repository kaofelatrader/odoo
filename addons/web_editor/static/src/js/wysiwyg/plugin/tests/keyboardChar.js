odoo.define('web_editor.wysiwyg.plugin.tests.keyboardChar', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var TestKeyboardChar = AbstractPlugin.extend({
    autoInstall: true,
    dependencies: ['Test', 'TestKeyboard'],

    start: function () {
        this.dependencies.Test.add(this);
        return this._super();
    },

    // range collapsed: ◆
    // range start: ▶
    // range end: ◀

    keyboardTests: [
        {
            name: "no changes",
            content: "<p>dom to edit</p>",
            steps: [{
                start: "p:contents()[0]->3",
                end: "p:contents()[0]->6",
            }],
            test: "<p>dom▶ to◀ edit</p>",
        },
        {
            name: "visible char in a p tag",
            content: "<p>dom to edit</p>",
            steps: [{
                start: "p:contents()[0]->3",
                keyCode: 66,
            }],
            test: "<p>domB◆ to edit</p>",
        },
        {
            name: "visible char in a b tag in a p tag",
            content: "<p>do<b>m to</b> edit</p>",
            steps: [{
                start: "b:contents()[0]->1",
                keyCode: 66,
            }],
            test: "<p>do<b>mB◆ to</b> edit</p>",
        },
        {
            name: "visible char in a link tag entirely selected",
            content: '<div><a href="#">dom to edit</a></div>',
            steps: [{
                start: "a:contents()[0]->0",
                end: "a:contents()[0]->11",
                key: 'a',
            }],
            test: '<div><a href="#">a◆</a></div>',
        },
        {
            name: "'a' on a selection of most contents of a complex dom",
            content: "<p><b>dom</b></p><p><b>to<br>partly</b>remov<i>e</i></p>",
            steps: [{
                start: "b:eq(1):contents()[0]->0",
                end: "i:contents()[0]->1",
                key: 'a',
            }],
            test: "<p><b>dom</b></p><p><b>a◆</b></p>",
        },
        {
            name: "'a' on a selection of all the contents of a complex dom",
            content: "<p><b>dom</b></p><p><b>to<br>completely</b>remov<i>e</i></p>",
            steps: [{
                start: "p:contents()[0]->0",
                end: "i:contents()[0]->1",
                key: 'a',
            }],
            test: "<p><b>a◆</b></p>",
        },
        {
            name: "'a' on a selection of all the contents of a complex dom (2)",
            content: "<h1 class=\"a\"><font style=\"font-size: 62px;\"><b>dom to</b>edit</font></h1>",
            steps: [{
                start: "font:contents()[0]->0",
                end: "font:contents()[1]->4",
                key: 'a',
            }],
            test: "<h1 class=\"a\"><font style=\"font-size: 62px;\"><b>a◆</b></font></h1>",
        },
        {
            name: "'a' before an image",
            content: '<p>xxx <img src="/web_editor/static/src/img/transparent.png"/> yyy</p>',
            steps: [{
                start: "p:contents()[0]->4",
                key: 'a',
            }],
            test: '<p>xxx a◆<img src="/web_editor/static/src/img/transparent.png"/> yyy</p>',
        },
        {
            name: "'a' before an image (2)",
            content: '<p>xxx <img src="/web_editor/static/src/img/transparent.png"/> yyy</p>',
            steps: [{
                start: "img->0",
                key: 'a',
            }],
            test: '<p>xxx a◆<img src="/web_editor/static/src/img/transparent.png"/> yyy</p>',
        },
        {
            name: "'a' before an image in table",
            content: '<table><tbody><tr><td><p>xxx</p></td><td><p><img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
            steps: [{
                start: "img->0",
                key: 'a',
            }],
            test: '<table><tbody><tr><td><p>xxx</p></td><td><p>a◆<img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
        },
        {
            name: "'a' on invisible text before an image in table",
            content: '<table><tbody><tr><td><p>xxx</p></td><td><p><img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
            steps: [{
                start: "p:eq(1)->0",
                key: 'a',
            }],
            test: '<table><tbody><tr><td><p>xxx</p></td><td><p>a◆<img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
        },
        {
            name: "'a' before an image in table without spaces",
            content: '<table><tbody><tr><td><p>xxx</p></td><td><p><img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
            steps: [{
                start: "img->0",
                key: 'a',
            }],
            test: '<table><tbody><tr><td><p>xxx</p></td><td><p>a◆<img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
        },
        {
            name: "'a' before an image in table without spaces (2)",
            content: '<table><tbody><tr><td><p>xxx</p></td><td><p><img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
            steps: [{
                start: "td:eq(1)->0",
                key: 'a',
            }],
            test: '<table><tbody><tr><td><p>xxx</p></td><td><p>a◆<img src="/web_editor/static/src/img/transparent.png"/></p></td><td><p>yyy</p></td></tr></tbody></table>',
        },
        {
            name: "'a' before an image in table with spaces",
            content:
                '<table><tbody>\n' +
                '   <tr>\n' +
                '       <td>\n' +
                '           <p>xxx</p>\n' +
                '       </td>\n' +
                '       <td>\n' +
                '           <p><img src="/web_editor/static/src/img/transparent.png"/></p>\n' +
                '       </td>\n' +
                '       <td>\n' +
                '           <p>yyy</p>\n' +
                '       </td>\n' +
                '   </tr>\n' +
                '</tbody></table>',
            steps: [{
                start: "img->0",
                key: 'a',
            }],
            test:   '<table><tbody>' +
                        '<tr>' +
                            '<td>' +
                                '<p>xxx</p>' +
                            '</td>' +
                            '<td>' +
                                '<p>a◆<img src="/web_editor/static/src/img/transparent.png"/></p>' +
                            '</td>' +
                            '<td>' +
                                '<p>yyy</p>' +
                            '</td>' +
                        '</tr>' +
                    '</tbody></table>',
        },
        {
            name: "'a' before an image in table with spaces (2)",
            content:
                '<table><tbody>\n' +
                '   <tr>\n' +
                '       <td>\n' +
                '           <p>xxx</p>\n' +
                '       </td>\n' +
                '       <td>\n' +
                '           <p><img src="/web_editor/static/src/img/transparent.png"/></p>\n' +
                '       </td>\n' +
                '       <td>\n' +
                '           <p>yyy</p>\n' +
                '       </td>\n' +
                '   </tr>\n' +
                '</tbody></table>',
            steps: [{
                start: "td:eq(1)->1",
                key: 'a',
            }],
            test:   '<table><tbody>' +
                        '<tr>' +
                            '<td>' +
                                '<p>xxx</p>' +
                            '</td>' +
                            '<td>' +
                                '<p>a◆<img src="/web_editor/static/src/img/transparent.png"/></p>' +
                            '</td>' +
                            '<td>' +
                                '<p>yyy</p>' +
                            '</td>' +
                        '</tr>' +
                    '</tbody></table>',
        },
        {
            name: "'a' before an image in table with spaces (3)",
            content:
                '<table><tbody>\n' +
                '   <tr>\n' +
                '       <td>\n' +
                '           <p>xxx</p>\n' +
                '       </td>\n' +
                '       <td>\n' +
                '           <p><img src="/web_editor/static/src/img/transparent.png"/></p>\n' +
                '       </td>\n' +
                '       <td>\n' +
                '           <p>yyy</p>\n' +
                '       </td>\n' +
                '   </tr>\n' +
                '</tbody></table>',
            steps: [{
                start: "p:eq(1):contents()[0]->0",
                key: 'a',
            }],
            test:   '<table><tbody>' +
                        '<tr>' +
                            '<td>' +
                                '<p>xxx</p>' +
                            '</td>' +
                            '<td>' +
                                '<p>a◆<img src="/web_editor/static/src/img/transparent.png"/></p>' +
                            '</td>' +
                            '<td>' +
                                '<p>yyy</p>' +
                            '</td>' +
                        '</tr>' +
                    '</tbody></table>',
        },
        /* TODO: fix... This test can't be reproduced manually so what is it supposed to simulate?
        {
            name: "'a' on begin of a span with fake_editable",
            content:
                '<div class="o_fake_not_editable" contentEditable="false">\n' +
                '   <div>\n' +
                '     <label>\n' +
                '       <input type="checkbox"/>\n' +
                '       <span class="o_fake_editable" contentEditable="true">\n' +
                '         dom to edit\n' +
                '       </span>\n' +
                '     </label>\n' +
                '   </div>\n' +
                '</div>',
            steps: [{
                start: "span:contents(0)->10",
                key: 'a',
            }],
            test: {
                content:
                    '<div>\n' +
                    '   <div>\n' +
                    '     <label>\n' +
                    '       <input type="checkbox">\n' +
                    '       <span>\n' +
                    '         adom to edit\n' +
                    '       </span>\n' +
                    '     </label>\n' +
                    '   </div>\n' +
                    '</div>',
                start: "span:contents(0)->11",
            },
        },
        {
            name: "'a' on all contents of p starting with an icon",
            content: '<p><span class="fa fa-star"></span>bbb</p>',
            steps: [{
                start: "span->0",
                end: 'p:contents(1)->3',
                key: 'a',
            }],
            test: '<p>a◆</p>',
        },
        */
        {
            name: "' ' at start of p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->0",
                key: ' ',
            }],
            test: '<p>&nbsp;◆dom to edit</p>',
        },
        {
            name: "' ' at end of p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->11",
                key: ' ',
            }],
            test: '<p>dom to edit ◆</p>',
        },
        {
            name: "' ' within p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->2",
                key: ' ',
            }],
            test: '<p>do ◆m to edit</p>',
        },
        {
            name: "' ' before space within p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->3",
                key: ' ',
            }],
            test: '<p>dom ◆ to edit</p>',
        },
        {
            name: "' ' after space within p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->4",
                key: ' ',
            }],
            test: '<p>dom &nbsp;◆to edit</p>',
        },
        {
            name: "3x ' ' at start of p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->0",
                key: ' ',
            }, {
                key: ' ',
            }, {
                key: ' ',
            }],
            test: '<p>&nbsp;&nbsp; ◆dom to edit</p>',
        },
        {
            name: "3x ' ' at end of p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->11",
                key: ' ',
            }, {
                key: ' ',
            }, {
                key: ' ',
            }],
            test: '<p>dom to edit &nbsp; ◆</p>',
        },
        {
            name: "3x ' ' within p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->2",
                key: ' ',
            }, {
                key: ' ',
            }, {
                key: ' ',
            }],
            test: '<p>do &nbsp; ◆m to edit</p>',
        },
        {
            name: "3x ' ' before space in p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->3",
                key: ' ',
            }, {
                key: ' ',
            }, {
                key: ' ',
            }],
            test: '<p>dom &nbsp; ◆ to edit</p>',
        },
        {
            name: "3x ' ' after space in p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->4",
                key: ' ',
            }, {
                key: ' ',
            }, {
                key: ' ',
            }],
            test: '<p>dom &nbsp; &nbsp;◆to edit</p>',
        },
        {
            name: "'a' in unbreakable with font",
            content: '<div class="unbreakable"><p>dom <span class="fa fa-heart"></span>to edit</p></div>',
            steps: [{
                start: "p:contents(2)->2",
                key: 'a',
            }],
            test: '<div class="unbreakable"><p>dom <span class="fa fa-heart"></span>toa◆ edit</p></div>',
        },
        {
            name: "'a' on begin of unbreakable inline node",
            content: '<p>dom <strong class="unbreakable">to</strong> edit</p>',
            steps: [{
                start: "strong:contents(0)->0",
                key: 'a',
            }],
            test: '<p>dom <strong class="unbreakable">a◆to</strong> edit</p>',
        },
        {
            name: "'a' on end of unbreakable inline node",
            content: '<div><p>dom <strong class="unbreakable">to</strong> edit</p></div>',
            steps: [{
                start: "strong:contents(0)->2",
                key: 'a',
            }],
            test: '<div><p>dom <strong class="unbreakable">toa◆</strong> edit</p></div>',
        },
        {
            name: "'1' on begin of value of a field currency",
            content:
                '<noteditable>\n' +
                      '<p><b data-oe-type="monetary" class="oe_price editable">$&nbsp;<span class="oe_currency_value">750.00</span></b></p>\n' +
                '</noteditable>',
            steps: [{
                start: "span:contents(0)->0",
                key: '1',
            }],
            test: '<noteditable>' +
                    '<p><b data-oe-type="monetary" class="editable oe_price">$&nbsp;<span class="oe_currency_value">1◆750.00</span></b></p>' +
                '</noteditable>',
        },
        {
            name: "'1' on end of value of a field currency",
            content:
                '<noteditable>\n' +
                      '<p><b data-oe-type="monetary" class="oe_price editable">$&nbsp;<span class="oe_currency_value">750.00</span></b></p>\n' +
                '</noteditable>',
            steps: [{
                start: "span:contents(0)->6",
                key: '1',
            }],
            test: '<noteditable>' +
                    '<p><b data-oe-type="monetary" class="editable oe_price">$&nbsp;<span class="oe_currency_value">750.001◆</span></b></p>' +
                '</noteditable>',
        },
        {
            name: "'1' on begin of editable in noteditable",
            content:
                '<noteditable contenteditable="false">\n' +
                      '<p><b data-oe-type="monetary" class="oe_price editable" contenteditable="true">$&nbsp;<span class="oe_currency_value">750.00</span></b></p>\n' +
                '</noteditable>',
            steps: [{
                start: "span:contents(0)->0",
                key: '1',
            }],
            test:   '<noteditable contenteditable="false">' +
                          '<p><b data-oe-type="monetary" class="editable oe_price" contenteditable="true">$&nbsp;<span class="oe_currency_value">1◆750.00</span></b></p>' +
                    '</noteditable>',
        },
        /* {
            name: "'1' on end of editable in noteditable",
            content:
                '<noteditable contenteditable="false">\n' +
                      '<b data-oe-type="monetary" class="oe_price editable" contenteditable="true">$&nbsp;<span class="oe_currency_value">750.00</span></b>\n' +
                '</noteditable>',
            steps: [{
                start: "span:contents(0)->6",
                key: '1',
            }],
            test:   '<noteditable>\n' +
                          '<b data-oe-type="monetary" class="oe_price editable">$&nbsp;<span class="oe_currency_value">750.001◆</span></b>\n' +
                    '</noteditable>',
        },
        {
            name: "'a' on editable with before&after in noteditable",
            content:
                '<style>#test-before-after:before { content: "placeholder";} #test-before-after:after { content: "\\00a0";}</style>\n' +
                '<noteditable contenteditable="false">\n' +
                      '<b id="test-before-after" class="editable" contenteditable="true"></b>\n' +
                '</noteditable>',
            steps: [{
                start: "b->0",
                key: 'a',
            }],
            test:   '<style>#test-before-after:before { content: "placeholder";} #test-before-after:after { content: "\\00a0";}</style>\n' +
                    '<noteditable>\n' +
                          '<b id="test-before-after" class="editable">a◆</b>\n' +
                    '</noteditable>',
        }, */
    ],

    test: function (assert) {
        return this.dependencies.TestKeyboard.test(assert, this.keyboardTests);
    },
});

Manager.addPlugin('TestKeyboardChar', TestKeyboardChar);

});
