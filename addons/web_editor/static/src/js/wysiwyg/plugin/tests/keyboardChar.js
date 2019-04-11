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

    keyboardTests: [
        {
            name: "visible char in a p tag",
            content: "<p>dom to edit</p>",
            steps: [{
                start: "p:contents()[0]->3",
                keyCode: 66,
            }],
            test: {
                content: "<p>domB to edit</p>",
                start: "p:contents()[0]->4",
                end: null,
            },
        },
        {
            name: "visible char in a link tag entirely selected",
            content: '<div><a href="#">dom to edit</a></div>',
            steps: [{
                start: "a:contents()[0]->0",
                end: "a:contents()[0]->11",
                key: 'a',
            }],
            test: {
                content: '<div><a href="#">a</a></div>',
                start: "a:contents()[0]->1",
            },
        },
        {
            name: "'a' on a selection of most contents of a complex dom",
            content: "<p><b>dom</b></p><p><b>to<br>partly</b>remov<i>e</i></p>",
            steps: [{
                start: "b:eq(1):contents()[0]->0",
                end: "i:contents()[0]->1",
                key: 'a',
            }],
            test: {
                content: "<p><b>dom</b></p><p>a</p>", // should it keep the b instead ?
                start: "p:eq(1):contents()[0]->1",
            },
        },
        {
            name: "'a' on a selection of all the contents of a complex dom",
            content: "<p><b>dom</b></p><p><b>to<br>completely</b>remov<i>e</i></p>",
            steps: [{
                start: "p:contents()[0]->0",
                end: "i:contents()[0]->1",
                key: 'a',
            }],
            test: {
                content: "<p>a</p>", // should it keep the b instead ?
                start: "p:contents()[0]->1",
            },
        },
        {
            name: "'a' on a selection of all the contents of a complex dom (2)",
            content: "<h1 class=\"a\"><font style=\"font-size: 62px;\"><b>dom to</b>edit</font></h1>",
            steps: [{
                start: "font:contents()[0]->0",
                end: "font:contents()[1]->4",
                key: 'a',
            }],
            test: {
                content: "<p>a</p>",
                start: "p:contents()[0]->1",
            },
        },
        {
            name: "'a' before an image",
            content: '<p>xxx <img src="/web_editor/static/src/img/transparent.png"> yyy</p>',
            steps: [{
                start: "p:contents()[0]->4",
                key: 'a',
            }],
            test: {
                content: '<p>xxx a<img data-src="/web_editor/static/src/img/transparent.png"> yyy</p>',
                start: "p:contents()[0]->5",
            },
        },
        {
            name: "'a' before an image (2)",
            content: '<p>xxx <img src="/web_editor/static/src/img/transparent.png"> yyy</p>',
            steps: [{
                start: "img->0",
                key: 'a',
            }],
            test: {
                content: '<p>xxx a<img data-src="/web_editor/static/src/img/transparent.png"> yyy</p>',
                start: "p:contents()[0]->5",
            },
        },
        {
            name: "'a' before an image in table",
            content: '<table><tbody><tr><td><p>xxx</p></td><td><p><img src="/web_editor/static/src/img/transparent.png"></p></td><td><p>yyy</p></td></tr></tbody></table>',
            steps: [{
                start: "img->0",
                key: 'a',
            }],
            test: {
                content: '<table><tbody><tr><td><p>xxx</p></td><td><p>a<img data-src="/web_editor/static/src/img/transparent.png"></p></td><td><p>yyy</p></td></tr></tbody></table>',
                start: "p:eq(1):contents()[0]->1",
            },
        },
        {
            name: "'a' on invisible text before an image in table",
            content: '<table><tbody><tr><td><p>xxx</p></td><td><p><img src="/web_editor/static/src/img/transparent.png"></p></td><td><p>yyy</p></td></tr></tbody></table>',
            steps: [{
                start: "p:eq(1)->0",
                key: 'a',
            }],
            test: {
                content: '<table><tbody><tr><td><p>xxx</p></td><td><p>a<img data-src="/web_editor/static/src/img/transparent.png"></p></td><td><p>yyy</p></td></tr></tbody></table>',
                start: "p:eq(1):contents()[0]->1",
            },
        },
        {
            name: "'a' before an image in table without spaces",
            content: '<table><tbody><tr><td><p>xxx</p></td><td><p><img src="/web_editor/static/src/img/transparent.png"></p></td><td><p>yyy</p></td></tr></tbody></table>',
            steps: [{
                start: "img->0",
                key: 'a',
            }],
            test: {
                content: '<table><tbody><tr><td><p>xxx</p></td><td><p>a<img data-src="/web_editor/static/src/img/transparent.png"></p></td><td><p>yyy</p></td></tr></tbody></table>',
                start: "p:eq(1):contents()[0]->1",
            },
        },
        {
            name: "'a' before an image in table without spaces (2)",
            content: '<table><tbody><tr><td><p>xxx</p></td><td><p><img src="/web_editor/static/src/img/transparent.png"></p></td><td><p>yyy</p></td></tr></tbody></table>',
            steps: [{
                start: "td:eq(1)->0",
                key: 'a',
            }],
            test: {
                content: '<table><tbody><tr><td><p>xxx</p></td><td><p>a<img data-src="/web_editor/static/src/img/transparent.png"></p></td><td><p>yyy</p></td></tr></tbody></table>',
                start: "p:eq(1):contents()[0]->1",
            },
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
                '           <p><img src="/web_editor/static/src/img/transparent.png"></p>\n' +
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
            test: {
                content:
                    '<table><tbody>\n' +
                    '   <tr>\n' +
                    '       <td>\n' +
                    '           <p>xxx</p>\n' +
                    '       </td>\n' +
                    '       <td>\n' +
                    '           <p>a<img data-src="/web_editor/static/src/img/transparent.png"></p>\n' +
                    '       </td>\n' +
                    '       <td>\n' +
                    '           <p>yyy</p>\n' +
                    '       </td>\n' +
                    '   </tr>\n' +
                    '</tbody></table>',
                start: "p:eq(1):contents()[0]->1",
            },
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
                '           <p><img src="/web_editor/static/src/img/transparent.png"></p>\n' +
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
            test: {
                content:
                    '<table><tbody>\n' +
                    '   <tr>\n' +
                    '       <td>\n' +
                    '           <p>xxx</p>\n' +
                    '       </td>\n' +
                    '       <td>\n' +
                    '           <p>a<img data-src="/web_editor/static/src/img/transparent.png"></p>\n' +
                    '       </td>\n' +
                    '       <td>\n' +
                    '           <p>yyy</p>\n' +
                    '       </td>\n' +
                    '   </tr>\n' +
                    '</tbody></table>',
                start: "p:eq(1):contents()[0]->1",
            },
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
                '           <p><img src="/web_editor/static/src/img/transparent.png"></p>\n' +
                '       </td>\n' +
                '       <td>\n' +
                '           <p>yyy</p>\n' +
                '       </td>\n' +
                '   </tr>\n' +
                '</tbody></table>',
            steps: [{
                start: "td:eq(1):contents()[0]->12",
                key: 'a',
            }],
            test: {
                content:
                    '<table><tbody>\n' +
                    '   <tr>\n' +
                    '       <td>\n' +
                    '           <p>xxx</p>\n' +
                    '       </td>\n' +
                    '       <td>\n' +
                    '           <p>a<img data-src="/web_editor/static/src/img/transparent.png"></p>\n' +
                    '       </td>\n' +
                    '       <td>\n' +
                    '           <p>yyy</p>\n' +
                    '       </td>\n' +
                    '   </tr>\n' +
                    '</tbody></table>',
                start: "p:eq(1):contents()[0]->1",
            },
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
        */
        {
            name: "'a' on all contents of p starting with an icon",
            content: '<p><span class="fa fa-star"></span>bbb</p>',
            steps: [{
                start: "span->0",
                end: 'p:contents(1)->3',
                key: 'a',
            }],
            test: {
                content: '<p>a</p>',
                start: "p:contents()[0]->1",
            },
        },
        {
            name: "' ' at start of p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->0",
                key: ' ',
            }],
            test: {
                content: '<p>&nbsp;dom to edit</p>',
                start: "p:contents()[0]->1",
            },
        },
        {
            name: "' ' at end of p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->11",
                key: ' ',
            }],
            test: {
                content: '<p>dom to edit&nbsp;</p>',
                start: "p:contents()[0]->12",
            },
        },
        {
            name: "' ' within p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->2",
                key: ' ',
            }],
            test: {
                content: '<p>do&nbsp;m to edit</p>',
                start: "p:contents()[0]->3",
            },
        },
        {
            name: "' ' before space within p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->3",
                key: ' ',
            }],
            test: {
                content: '<p>dom&nbsp; to edit</p>',
                start: "p:contents()[0]->4",
            },
        },
        {
            name: "' ' after space within p",
            content: '<p>dom to edit</p>',
            steps: [{
                start: "p:contents()[0]->4",
                key: ' ',
            }],
            test: {
                content: '<p>dom &nbsp;to edit</p>',
                start: "p:contents()[0]->5",
            },
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
            test: {
                content: '<p>&nbsp;&nbsp;&nbsp;dom to edit</p>',
                start: "p:contents()[0]->3",
            },
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
            test: {
                content: '<p>dom to edit&nbsp;&nbsp;&nbsp;</p>',
                start: "p:contents()[0]->14",
            },
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
            test: {
                content: '<p>do&nbsp;&nbsp;&nbsp;m to edit</p>',
                start: "p:contents()[0]->5",
            },
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
            test: {
                content: '<p>dom&nbsp;&nbsp;&nbsp; to edit</p>',
                start: "p:contents()[0]->6",
            },
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
            test: {
                content: '<p>dom &nbsp;&nbsp;&nbsp;to edit</p>',
                start: "p:contents()[0]->7",
            },
        },
        {
            name: "'a' in unbreakable with font",
            content: '<div class="unbreakable">dom <span class="fa fa-heart"></span>to edit</div>',
            steps: [{
                start: "div:contents(2)->2",
                key: 'a',
            }],
            test: {
                content: '<div class="unbreakable">dom <span class="fa fa-heart"></span>toa edit</div>',
                start: "div:contents(2)->3",
            },
        },
        {
            name: "'a' on begin of unbreakable inline node",
            content: 'dom <strong class="unbreakable">to</strong> edit',
            steps: [{
                start: "strong:contents(0)->0",
                key: 'a',
            }],
            test: {
                content: 'dom <strong class="unbreakable">ato</strong> edit',
                start: "strong:contents(0)->1",
            },
        },
        {
            name: "'a' on end of unbreakable inline node",
            content: '<div>dom <strong class="unbreakable">to</strong> edit</div>',
            steps: [{
                start: "strong:contents(0)->2",
                key: 'a',
            }],
            test: {
                content: '<div>dom <strong class="unbreakable">toa</strong> edit</div>',
                start: "strong:contents(0)->3",
            },
        },
        {
            name: "'1' on begin of value of a field currency",
            content:
                '<noteditable>\n' +
                      '<b data-oe-type="monetary" class="oe_price editable">$&nbsp;<span class="oe_currency_value">750.00</span></b>\n' +
                '</noteditable>',
            steps: [{
                start: "span:contents(0)->0",
                key: '1',
            }],
            test: {
                content:
                    '<noteditable>\n' +
                          '<b data-oe-type="monetary" class="oe_price editable">$&nbsp;<span class="oe_currency_value">1750.00</span></b>\n' +
                    '</noteditable>',
                start: "span:contents(0)->1",
            },
        },
        {
            name: "'1' on end of value of a field currency",
            content:
                '<noteditable>\n' +
                      '<b data-oe-type="monetary" class="oe_price editable">$&nbsp;<span class="oe_currency_value">750.00</span></b>\n' +
                '</noteditable>',
            steps: [{
                start: "span:contents(0)->6",
                key: '1',
            }],
            test: {
                content:
                    '<noteditable>\n' +
                          '<b data-oe-type="monetary" class="oe_price editable">$&nbsp;<span class="oe_currency_value">750.001</span></b>\n' +
                    '</noteditable>',
                start: "span:contents(0)->7",
            },
        },
        {
            name: "'1' on begin of editable in noteditable",
            content:
                '<noteditable contenteditable="false">\n' +
                      '<b data-oe-type="monetary" class="oe_price editable" contenteditable="true">$&nbsp;<span class="oe_currency_value">750.00</span></b>\n' +
                '</noteditable>',
            steps: [{
                start: "span:contents(0)->0",
                key: '1',
            }],
            test: {
                content:
                    '<noteditable>\n' +
                          '<b data-oe-type="monetary" class="oe_price editable">$&nbsp;<span class="oe_currency_value">1750.00</span></b>\n' +
                    '</noteditable>',
                start: "span:contents(0)->1",
            },
        },
        {
            name: "'1' on end of editable in noteditable",
            content:
                '<noteditable contenteditable="false">\n' +
                      '<b data-oe-type="monetary" class="oe_price editable" contenteditable="true">$&nbsp;<span class="oe_currency_value">750.00</span></b>\n' +
                '</noteditable>',
            steps: [{
                start: "span:contents(0)->6",
                key: '1',
            }],
            test: {
                content:
                    '<noteditable>\n' +
                          '<b data-oe-type="monetary" class="oe_price editable">$&nbsp;<span class="oe_currency_value">750.001</span></b>\n' +
                    '</noteditable>',
                start: "span:contents(0)->7",
            },
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
            test: {
                content:
                    '<style>#test-before-after:before { content: "placeholder";} #test-before-after:after { content: "\\00a0";}</style>\n' +
                    '<noteditable>\n' +
                          '<b id="test-before-after" class="editable">a</b>\n' +
                    '</noteditable>',
                start: "b:contents(0)->1",
            },
        },
    ],

    test: function (assert) {
        return this.dependencies.TestKeyboard.test(assert, this.keyboardTests);
    },
});

Manager.addPlugin('TestKeyboardChar', TestKeyboardChar);

});
