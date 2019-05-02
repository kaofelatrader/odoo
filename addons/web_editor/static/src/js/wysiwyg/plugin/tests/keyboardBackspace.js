odoo.define('web_editor.wysiwyg.plugin.tests.keyboardBackspace', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var TestKeyboardBackspace = AbstractPlugin.extend({
    autoInstall: true,
    dependencies: ['Test', 'TestKeyboard'],

    start: function () {
        this.dependencies.Test.add(this);
        return this._super();
    },

    // range collapsed: ◆
    // range start: ▶
    // range end: ◀

    keyboardTests: [{
        name: "in p: BACKSPACE after span.fa",
        content: '<p>aaa<span class="fa fa-star"></span>bbb</p>',
        steps: [{
            start: "p:contents()[2]->0",
            key: 'BACKSPACE',
        }],
        test: '<p>aaa◆bbb</p>',
    },
    {
        name: "in empty-p: BACKSPACE (must leave it unchanged)",
        content: "<p><br></p>",
        steps: [{
            start: "p->1",
            key: 'BACKSPACE',
        }],
        test: "<p><br/>◆</p>",
    },
    {
        name: "in p (empty-p before): BACKSPACE",
        content: "<p><br></p><p>dom to edit</p>",
        steps: [{
            start: "p:eq(1):contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<p>◆dom to edit</p>",
    },
    {
        name: "in p (empty-p.a before): BACKSPACE",
        content: "<p class=\"a\"><br></p><p>dom to edit</p>",
        steps: [{
            start: "p:eq(1):contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<p class=\"a\">◆dom to edit</p>",
    },
    {
        name: "in p: BACKSPACE within text",
        content: "<p>dom to edit</p>",
        steps: [{
            start: "p:contents()[0]->5",
            key: 'BACKSPACE',
        }],
        test: "<p>dom ◆o edit</p>",
    },
    {
        name: "in p: 2x BACKSPACE within text",
        content: "<p>dom to edit</p>",
        steps: [{
            start: "p:contents()[0]->5",
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }],
        test: "<p>dom◆o edit</p>",
    },
    {
        name: "in p (p > span.a before - span.b after): BACKSPACE at beginning (must attach them)",
        content: '<p><span class="a">dom to</span></p><p><span class="b">edit</span></p>',
        steps: [{
            start: "p:eq(1):contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<p><span class=\"a\">dom to</span><span class=\"b\">◆edit</span></p>",
    },
    {
        name: "in p (p > span.a before - span.a after): BACKSPACE (must merge them)",
        content: '<p><span class="a">dom to </span></p><p><span class="a">edit</span></p>',
        steps: [{
            start: "p:eq(1):contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<p><span class=\"a\">dom to ◆edit</span></p>",
    },
    {
        name: "in p (b before): BACKSPACE",
        content: "<p><b>dom</b> to edit</p>",
        steps: [{
            start: "p:contents()[1]->0",
            key: 'BACKSPACE',
        }],
        test: "<p><b>do◆</b> to edit</p>",
    },
    {
        name: "in p (div > span.a before - span.a after): BACKSPACE at beginning (must do nothing)",
        content: "<div><span class=\"a\">dom to&nbsp;</span></div><p><span class=\"a\">edit</span></p>",
        steps: [{
            start: "p:contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<div><span class=\"a\">dom to&nbsp;</span></div><p><span class=\"a\">◆edit</span></p>",
    },
    {
        name: "in p: BACKSPACE on partial selection",
        content: "<p>dom to edit</p>",
        steps: [{
            start: "p:contents()[0]->1",
            end: "p:contents()[0]->7",
            key: 'BACKSPACE',
        }],
        test: "<p>d◆edit</p>",
    },
    {
        name: "across 2 p's: BACKSPACE on partial selection",
        content: "<p>dom</p><p>to edit</p>",
        steps: [{
            start: "p:contents()[0]->1",
            end: "p:eq(1):contents()[0]->3",
            key: 'BACKSPACE',
        }],
        test: "<p>d◆edit</p>",
    },
    {
        name: "in p: BACKSPACE within text, with space at beginning",
        content: "<p>     dom to edit</p>",
        steps: [{
            start: "p:contents()[0]->10",
            key: 'BACKSPACE',
        }],
        test: "<p>dom ◆o edit</p>",
    },
    {
        name: "in p: BACKSPACE within text, with one space at beginning",
        content: "<p> dom to edit</p>",
        steps: [{
            start: "p:contents()[0]->6",
            key: 'BACKSPACE',
        }],
        test: "<p>&nbsp;dom ◆o edit</p>",
    },
    {
        name: "in p: BACKSPACE within text, with space at end",
        content: "<p>dom to edit     </p>",
        steps: [{
            start: "p:contents()[0]->5",
            key: 'BACKSPACE',
        }],
        test: "<p>dom ◆o edit</p>",
    },
    {
        name: "in p: BACKSPACE within text, with one space at end",
        content: "<p>dom to edit </p>",
        steps: [{
            start: "p:contents()[0]->5",
            key: 'BACKSPACE',
        }],
        test: "<p>dom ◆o edit&nbsp;</p>",
    },
    {
        name: "in p: BACKSPACE within text, with space at beginning and end",
        content: "<p>     dom to edit     </p>",
        steps: [{
            start: "p:contents()[0]->10",
            key: 'BACKSPACE',
        }],
        test: "<p>dom ◆o edit</p>",
    },
    {
        name: "in p: BACKSPACE within text, with one space at beginning and one at end",
        content: "<p> dom to edit </p>",
        steps: [{
            start: "p:contents()[0]->6",
            key: 'BACKSPACE',
        }],
        test: "<p>&nbsp;dom ◆o edit&nbsp;</p>",
    },
    {
        name: "in p: BACKSPACE after \\w<br>\\w",
        content: "<p>dom to edi<br>t</p>",
        steps: [{
            start: "p:contents()[2]->1",
            key: 'BACKSPACE',
        }],
        test: "<p>dom to edi<br>&#65279;◆</p>",
    },
    {
        name: "in p: BACKSPACE -> 'a' within text, after \\s\\w",
        content: "<p>dom t</p>",
        steps: [{
            start: "p:contents()[0]->5",
            key: 'BACKSPACE',
        }, {
            key: 'a',
        }],
        test: "<p>dom&nbsp;a◆</p>",
    },
    {
        name: "in pre: BACKSPACE within text, with space at beginning",
        content: "<pre>     dom to edit</pre>",
        steps: [{
            start: "pre:contents()[0]->10",
            key: 'BACKSPACE',
        }],
        test: "<pre>     dom ◆o edit</pre>",
    },
    {
        name: "in pre: BACKSPACE within text, with one space at beginning",
        content: "<pre> dom to edit</pre>",
        steps: [{
            start: "pre:contents()[0]->6",
            key: 'BACKSPACE',
        }],
        test: "<pre> dom ◆o edit</pre>",
    },
    {
        name: "in pre: BACKSPACE within text, with space at end",
        content: "<pre>dom to edit     </pre>",
        steps: [{
            start: "pre:contents()[0]->5",
            key: 'BACKSPACE',
        }],
        test: "<pre>dom ◆o edit     </pre>",
    },
    {
        name: "in pre: BACKSPACE within text, with one space at end",
        content: "<pre>dom to edit </pre>",
        steps: [{
            start: "pre:contents()[0]->5",
            key: 'BACKSPACE',
        }],
        test: "<pre>dom ◆o edit </pre>",
    },
    {
        name: "in pre: BACKSPACE within text, with space at beginning and end",
        content: "<pre>     dom to edit     </pre>",
        steps: [{
            start: "pre:contents()[0]->10",
            key: 'BACKSPACE',
        }],
        test: "<pre>     ◆dom o edit     </pre>",
    },
    {
        name: "in pre: BACKSPACE within text, with one space at beginning and one at end",
        content: "<pre> dom to edit </pre>",
        steps: [{
            start: "pre:contents()[0]->6",
            key: 'BACKSPACE',
        }],
        test: "<pre> dom ◆o edit </pre>",
    },

    // list UL / OL

    {
        name: "from p to ul > li: BACKSPACE on whole list",
        content: "<p>dom not to edit</p><ul><li><p>dom to edit</p></li></ul>",
        steps: [{
            start: "p:contents()[0]->15",
            end: "p:eq(1):contents()[0)->11",
            key: 'BACKSPACE',
        }],
        test: "<p>dom not to edit◆</p>",
    },
    {
        name: "in ul > second-li > p: BACKSPACE within text",
        content: "<ul><li><p>dom to</p></li><li><p>edit</p></li></ul>",
        steps: [{
            start: "p:eq(1):contents()[0]->4",
            key: 'BACKSPACE',
        }],
        test: "<ul><li><p>dom to</p></li><li><p>edi◆</p></li></ul>",
    },
    {
        name: "in ul > second-li > empty-p: BACKSPACE at beginning",
        content: "<ul><li><p><br></p></li><li><p><br></p></li></ul>",
        steps: [{
            start: "p:eq(1)->1",
            key: 'BACKSPACE',
        }],
        test: "<ul><li><p><br></p></li></ul><p><br/>◆</p>",
    },
    {
        name: "in ul > indented-li (no other li - p before): BACKSPACE at beginning",
        content: "<p>dom to</p><ul><ul><li>edit</li></ul></ul>",
        steps: [{
            start: "li:contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<p>dom to</p><ul><li>◆edit</li></ul>",
    },
    {
        name: "in ul > indented-li (no other li - p before): BACKSPACE -> 'a' at beginning",
        content: "<p>dom to</p><ul><ul><li>edit</li></ul></ul>",
        steps: [{
            start: "li:contents()[0]->0",
            key: 'BACKSPACE',
        }, {
            key: 'a',
        }],
        test: "<p>dom to</p><ul><li>a◆edit</li></ul>",
    },
    {
        name: "in ul > indented-li (no other li - none before): BACKSPACE at beginning",
        content: "<ul><ul><li>dom to edit</li></ul></ul>",
        steps: [{
            start: "li:contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<ul><li>◆dom to edit</li></ul>",
    },
    {
        name: "in li: BACKSPACE on partial selection",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{
            start: "li:contents()[0]->1",
            end: "li:contents()[0]->7",
            key: 'BACKSPACE',
        }],
        test: "<ul><li>d◆edit</li></ul>",
    },
    {
        name: "across 2 li: BACKSPACE on partial selection",
        content: "<ul><li>dom to edit</li><li>dom to edit</li></ul>",
        steps: [{
            start: "li:contents()[0]->1",
            end: "li:eq(1):contents()[0]->7",
            key: 'BACKSPACE',
        }],
        test: "<ul><li>d◆edit</li></ul>",
    },
    {
        name: "in li (no other li): BACKSPACE on selection of all contents",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{
            start: "li:contents()[0]->0",
            end: "li:contents()[0]->11",
            key: 'BACKSPACE',
        }],
        test: "<ul><li><br/>◆</li></ul>",
    },
    {
        name: "in li (no other li): BACKSPACE -> 'a' on selection of all contents",
        content: "<ul><li>dom to edit</li></ul>",
        steps: [{
            start: "li:contents()[0]->0",
            end: "li:contents()[0]->11",
            key: 'BACKSPACE',
        }, {
            key: 'a',
        }],
        test: "<ul><li>a◆</li></ul>",
    },
    {
        name: "in empty-li: BACKSPACE (must remove list)",
        content: "<ul><li><br></li></ul>",
        steps: [{
            start: "li:contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<p><br/>◆</p>",
    },
    {
        name: "in empty-li (no other li - empty-p before): BACKSPACE -> 'a'",
        content: "<p><br></p><ul><li><br></li></ul>",
        steps: [{
            start: "li:contents()[0]->0",
            key: 'BACKSPACE',
        }, {
            key: 'a',
        }],
        test: "<p><br/></p><p>a◆</p>",
    },
    {
        name: "in empty-li (no other li - p before): BACKSPACE",
        content: "<p>toto</p><ul><li><br></li></ul>",
        steps: [{
            start: "li:contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<p>toto</p><p><br/>◆</p>",
    },
    {
        name: "in li (no other li - p before): BACKSPACE at start",
        content: "<p>toto</p><ul><li>&nbsp;<img src='/web_editor/static/src/img/transparent.png'></li></ul>",
        steps: [{
            start: "li:contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<p>toto</p><p>◆&nbsp;<img data-src=\"/web_editor/static/src/img/transparent.png\"></p>",
    },
    {
        name: "in empty-indented-li (other li - no other indented-li): BACKSPACE",
        content: "<ul><li><p>toto</p></li><ul><li><br></li></ul><li><p>tutu</p></li></ul>",
        steps: [{
            start: "ul ul li:contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<ul><li><p>toto</p></li><li><br/>◆</li><li><p>tutu</p></li></ul>",
    },
    {
        name: "in empty-indented-li (other li - other indented-li): BACKSPACE",
        content: "<ul><li><p>toto</p></li><ul><li><br></li><li><br></li></ul><li><p>tutu</p></li></ul>",
        steps: [{
            start: "ul ul li:contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<ul><li><p>toto</p></li><li><br/>◆</li><ul><li><br></li></ul><li><p>tutu</p></li></ul>",
    },
    {
        name: "in empty-indented-li (no other li, no other indented-li): BACKSPACE",
        content: "<ul><ul><li><br></li></ul></ul>",
        steps: [{
            start: "li:contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<ul><li><br/>◆</li></ul>",
    },
    {
        name: "in indented-li (other li, other indented-li): BACKSPACE at start",
        content: "<ul><li><p>toto</p></li><ul><li><p>xxx</p></li><li><p>yyy</p></li></ul><li><p>tutu</p></li></ul>",
        steps: [{
            start: "ul ul li:contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<ul><li><p>toto</p></li><li><p>◆xxx</p></li><ul><li><p>yyy</p></li></ul><li><p>tutu</p></li></ul>",
    },
    {
        name: "in li > second-p: BACKSPACE at start",
        content: "<ul><li><p>toto</p></li><li><p>xxx</p><p>yyy</p></li><li><p>tutu</p></li></ul>",
        steps: [{
            start: "li:eq(1) p:eq(1):contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<ul><li><p>toto</p></li><li><p>xxx◆yyy</p></li><li><p>tutu</p></li></ul>",
    },
    {
        name: "in li (li after): BACKSPACE at start, with spaces",
        content: "<p>dom to edit&nbsp;    </p><ul><li><p>    &nbsp; dom to edit</p></li><li><p>dom not to edit</p></li></ul>",
        steps: [{
            start: "p:eq(1):contents()[0]->6",
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }],
        test: "<p>dom to edit&nbsp; ◆dom to edit</p><ul><li><p>dom not to edit</p></li></ul>",
    },
    {
        name: "in li > p: BACKSPACE after single character",
        content: "<ul><li><p>a</p></li></ul>",
        steps: [{
            start: "p:contents()[0]->1",
            key: 'BACKSPACE',
        }],
        test: "<ul><li><p><br/>◆</p></li></ul>",
    },
    {
        name: "in li > p: BACKSPACE -> 'a' after single character",
        content: "<ul><li><p>a</p></li></ul>",
        steps: [{
            start: "p:contents()[0]->1",
            key: 'BACKSPACE',
        }, {
            key: 'a',
        }],
        test: "<ul><li><p>a◆</p></li></ul>",
    },

    // end list UL / OL

    {
        name: "in p: BACKSPACE on selection of all contents",
        content: "<p>dom to edit</p>",
        steps: [{
            start: "p:contents()[0]->0",
            end: "p:contents()[0]->11",
            key: 'BACKSPACE',
        }],
        test: "<p><br/>◆</p>",
    },
    {
        name: "in p: BACKSPACE -> 'a' on selection of all contents",
        content: "<p>dom to edit</p>",
        steps: [{
            start: "p:contents()[0]->0",
            end: "p:contents()[0]->11",
            key: 'BACKSPACE',
        }, {
            key: 'a',
        }],
        test: "<p>a◆</p>",
    },
    {
        name: "in complex-dom: BACKSPACE on selection of most contents",
        content: "<p><b>dom</b></p><p><b>to<br>partially</b>re<i>m</i>ove</p>",
        steps: [{
            start: "b:contents()[0]->2",
            end: "i:contents()[0]->1",
            key: 'BACKSPACE',
        }],
        test: "<p><b>do</b>◆ove</p>",
    },
    {
        name: "in complex-dom: BACKSPACE on selection of all contents",
        content: "<p><b>dom</b></p><p><b>to<br>completely</b>remov<i>e</i></p>",
        steps: [{
            start: "p:contents()[0]->0",
            end: "i:contents()[0]->1",
            key: 'BACKSPACE',
        }],
        test: "<p><br/>◆</p>",
    },
    {
        name: "in p: BACKSPACE after br",
        content: "<p>dom <br>to edit</p>",
        steps: [{
            start: "p:contents()[2]->0",
            key: 'BACKSPACE',
        }],
        test: "<p>dom ◆to edit</p>",
    },
    {
        name: "in complex-dom (span > b -> ENTER in contents): BACKSPACE",
        content: "<span><b>dom<br></b></span><br><span><b>&nbsp;to edit</b></span>",
        steps: [{
            start: "b:eq(1):contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<span><b>dom<br/>◆&nbsp;to edit</b></span>",
    },
    {
        name: "in complex-dom (span > b -> ENTER in contents): 2 x BACKSPACE",
        content: "<span><b>dom<br></b></span><br><span><b>a to edit</b></span>",
        steps: [{
            start: "b:eq(1):contents()[0]->1",
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }],
        test: "<span><b>dom<br/>◆&nbsp;to edit</b></span>",
    },
    {
        name: "in p (hr before): BACKSPACE",
        content: '<p>aaa</p><hr><p>bbb</p>',
        steps: [{
            start: "p:eq(1):contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: '<p>aaa</p><p>◆bbb</p>',
    },
    {
        name: "in p with multi br[id] (p before and after) (1)",
        content: '<p>dom not to edit</p><p><br id="br-1"><br id="br-2"><br id="br-3"><br id="br-4"></p><p>dom not to edit</p>',
        steps: [{
            start: "p:eq(1)->2",
            key: 'BACKSPACE',
        }],
        test: '<p>dom not to edit</p><p><br id="br-1"/><br id="br-3"/>◆<br id="br-4"/></p><p>dom not to edit</p>',
    },
    {
        name: "in p with multi br[id] (p before and after) (2)",
        content: '<p>dom not to edit</p><p><br id="br-1"><br id="br-2"><br id="br-3"><br id="br-4"></p><p>dom not to edit</p>',
        steps: [{
            start: "br:eq(2)->0",
            key: 'BACKSPACE',
        }],
        test: '<p>dom not to edit</p><p><br id="br-1"/><br id="br-3"/>◆<br id="br-4"/></p><p>dom not to edit</p>',
    },
    {
        name: "in p with multi br[id] (p before and after): 2x BACKSPACE",
        content: '<p>dom not to edit</p><p><br id="br-1"><br id="br-2"><br id="br-3"><br id="br-4"></p><p>dom not to edit</p>',
        steps: [{
            start: "p:eq(1)->2",
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }],
        test: '<p>dom not to edit</p><p><br id="br-3"/>◆<br id="br-4"/></p><p>dom not to edit</p>',
    },
    {
        name: "in p with multi br (p before and after) (1)",
        content: '<p>dom not to edit</p><p><br><br><br><br></p><p>dom not to edit</p>',
        steps: [{
            start: "p:eq(1)->2",
            key: 'BACKSPACE',
        }],
        test: '<p>dom not to edit</p><p><br/><br/>◆<br/></p><p>dom not to edit</p>',
    },
    {
        name: "in p with multi br (p before and after) (2)",
        content: '<p>dom not to edit</p><p><br><br><br><br></p><p>dom not to edit</p>',
        steps: [{
            start: "br:eq(2)->0",
            key: 'BACKSPACE',
        }],
        test: '<p>dom not to edit</p><p><br/><br/>◆<br/></p><p>dom not to edit</p>',
    },
    {
        name: "in p with multi br (p before and after): 2x BACKSPACE",
        content: '<p>dom not to edit</p><p><br><br><br><br></p><p>dom not to edit</p>',
        steps: [{
            start: "p:eq(1)->2",
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }],
        test: '<p>dom not to edit</p><p><br/>◆<br/></p><p>dom not to edit</p>',
    },
    {
        name: "in p: BACKSPACE within text after \w+<br>",
        content: '<p>dom to<br>edit</p>',
        steps: [{
            start: "p:contents()[2]->3",
            key: 'BACKSPACE',
        }],
        test: '<p>dom to<br/>ed◆t</p>',
    },

    // table

    {
        name: "in empty-td (td before): BACKSPACE -> 'a' at start",
        content: '<table class="table table-bordered"><tbody><tr><td><p><br></p></td><td><p><br></p></td></tr></tbody></table>',
        steps: [{
            start: "p:eq(1)->1",
            key: 'BACKSPACE',
        }, {
            key: 'a',
        }],
        test: '<table class="table table-bordered"><tbody><tr><td><p><br></p></td><td><p>a◆</p></td></tr></tbody></table>',
    },
    {
        name: "in td (td before): 2x BACKSPACE -> 'a' after first character",
        content: '<table class="table table-bordered"><tbody><tr><td><p>dom not to edit</p></td><td><p>dom to edit</p></td></tr></tbody></table>',
        steps: [{
            start: "p:eq(1):contents()[0]->1",
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }, {
            key: 'a',
        }],
        test: '<table class="table table-bordered"><tbody><tr><td><p>dom not to edit</p></td><td><p>a◆om to edit</p></td></tr></tbody></table>',
    },
    {
        name: "in td (no other td): BACKSPACE within text",
        content: '<table class="table table-bordered"><tbody><tr><td><p>dom to edit</p></td></tr></tbody></table>',
        steps: [{
            start: "p:contents()[0]->5",
            key: 'BACKSPACE',
        }],
        test: '<table class="table table-bordered"><tbody><tr><td><p>dom ◆o edit</p></td></tr></tbody></table>',
    },
    {
        name: "in complex-dom (empty-td (td before) -> 2x SHIFT-ENTER): 3x BACKSPACE -> 'a'",
        content: '<table class="table table-bordered"><tbody><tr><td><p>dom not to edit</p></td><td><p><br><br><br></p></td></tr></tbody></table>',
        steps: [{
            start: 'p:eq(1)->2',
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }, {
            key: 'a',
        }],
        test: '<table class="table table-bordered"><tbody><tr><td><p>dom not to edit</p></td><td><p>a◆</p></td></tr></tbody></table>',
    },
    {
        name: "in h1: BACKSPACE on full selection -> 'a'",
        content: '<h1>dom to delete</h1>',
        steps: [{
            start: 'h1:contents()[0]->0',
            end: 'h1:contents()[0]->13',
            key: 'BACKSPACE',
        }, {
            key: 'a',
        }],
        test: '<h1>a◆</h1>',
    },
    {
        name: "in h1: BACKSPACE on full selection -> BACKSPACE -> 'a'",
        content: '<h1>dom to delete</h1>',
        steps: [{
            start: 'h1:contents()[0]->0',
            end: 'h1:contents()[0]->13',
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }, {
            key: 'a',
        }],
        test: '<p>a◆</p>',
    },
    {
        name: "in h1: BACKSPACE on full selection -> DELETE -> 'a'",
        content: '<h1>dom to delete</h1>',
        steps: [{
            start: 'h1:contents()[0]->0',
            end: 'h1:contents()[0]->13',
            key: 'BACKSPACE',
        }, {
            key: 'DELETE',
        }, {
            key: 'a',
        }],
        test: '<p>a◆</p>',
    },

    // merging non-similar blocks

    {
        name: "in p (h1 before): BACKSPACE at start",
        content: '<h1>node to merge with</h1><p>node to merge</p>',
        steps: [{
            start: 'p:contents()[0]->0',
            key: 'BACKSPACE',
        }],
        test: '<h1>node to merge with◆node to merge</h1>',
    },
    {
        name: "in empty-p (h1 before): BACKSPACE",
        content: "<h1>dom to edit</h1><p><br></p>",
        steps: [{
            start: "p->0",
            key: 'BACKSPACE',
        }],
        test: "<h1>dom to edit◆</h1>",
    },
    {
        name: "in empty-p (h1 before): 2x BACKSPACE",
        content: "<h1>dom to edit</h1><p><br></p>",
        steps: [{
            start: "p->0",
            key: 'BACKSPACE',
        }, {
            key: 'BACKSPACE',
        }],
        test: "<h1>dom to edi◆</h1>",
    },
    {
        name: "in p (ul before): BACKSPACE at start",
        content: '<ul><li><p>node to merge with</p></li></ul><p>node to merge</p>',
        steps: [{
            start: 'p:eq(1):contents()[0]->0',
            key: 'BACKSPACE',
        }],
        test: '<ul><li><p>node to merge with◆node to merge</p></li></ul>',
    },
    {
        name: "in p > b (ul before, i after): BACKSPACE at start",
        content: '<ul><li><p>node to merge with</p></li></ul><p><b>node</b><i> to merge</i></p>',
        steps: [{
            start: 'b:contents()[0]->0',
            key: 'BACKSPACE',
        }],
        test: '<ul><li><p>node to merge with<b>◆node</b><i> to merge</i></p></li></ul>',
    },
    {
        name: "in p > b (ul > i before, i after): BACKSPACE at start",
        content: '<ul><li><p><i>node to merge with</i></p></li></ul><p><b>node</b><i> to merge</i></p>',
        steps: [{
            start: 'b:contents()[0]->0',
            key: 'BACKSPACE',
        }],
        test: '<ul><li><p><i>node to merge with</i><b>◆node</b><i> to merge</i></p></li></ul>',
    },
    {
        name: "in p.c (p.a > span.b before - span.b after): BACKSPACE at beginning",
        content: "<p class=\"a\"><span class=\"b\">dom to </span></p><p class=\"c\"><span class=\"b\">edit</span></p>",
        steps: [{
            start: "p:eq(1):contents()[0]->0",
            key: 'BACKSPACE',
        }],
        test: "<p class=\"a\"><span class=\"b\">dom to ◆edit</span></p>",
    },
    {
        name: "from h1 to p: BACKSPACE",
        content: '<h1>node to merge with</h1><p>node to merge</p>',
        steps: [{
            start: 'h1:contents()[0]->5',
            end: 'p:contents()[0]->2',
            key: 'BACKSPACE',
        }],
        test: '<h1>node ◆de to merge</h1>',
    },
    {
        name: "from h1 to p: BACKSPACE at start",
        content: '<h1><b>node to merge with</b></h1><p>node to merge</p>',
        steps: [{
            start: 'b:contents()[0]->0',
            end: 'p:contents()[0]->2',
            key: 'BACKSPACE',
        }],
        test: '<p>◆de to merge</p>',
    },
],

    test: function (assert) {
        return this.dependencies.TestKeyboard.test(assert, this.keyboardTests);
    },
});

Manager.addPlugin('TestKeyboardBackspace', TestKeyboardBackspace);

});
