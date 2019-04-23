odoo.define('web_editor.wysiwyg.plugin.tests.arch', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var TestArchAndRules = AbstractPlugin.extend({
    autoInstall: true,
    dependencies: ['Test'],

    start: function () {
        this.dependencies.Test.add(this);
        return this._super();
    },

    doms: [
        {
            name: "Auto wrap ul in a ul",
            content: "<ul><ul>text</ul></ul>",
            test: "<ul><li><ul><li>text</li></ul></li></ul>",
        },
        {
            name: "Fix a complex DOM",
            content: `
                Bonjour,
                <br>
                <b>comment va-<i>tu</i> ?</b>
                <table><td>wrong TD</td> free text in table</table>
                <i><font color="red">comment</font> <font color="blue">va-<b>tu</b></font> ?</i>
                <div>
                    text dans div ?

                    if (div) {
                        console.log('div');
                    }
                </div>
                <pre> 
                    if (tata) {
                        console.log('tutu');
                    }

                    <span>OKI</span>
                </pre>

                <section>
                    <block>
                        % if toto:
                        TOTO
                        %end
                    </block>
                </section>
                <p>
                    <i>iiii</i> <iframe data-src="/test"/> <b>bbb</b>
                </p>
            `,
            test: `<p>Bonjour,<br/><b>comment va-<i>tu</i> ?</b></p><table><tbody><tr><td>wrong TD</td></tr><tr><td>free text in table</td></tr></tbody></table><p><i><font color="red">comment</font> <font color="blue">va-<b>tu</b></font> ?</i></p><div><p>text dans div ? if (div) { console.log('div'); }</p></div><pre> 
                    if (tata) {
                        console.log('tutu');
                    }

                    <span>OKI</span>
                </pre><section><block><p>% if toto: TOTO %end</p></block></section><p><i>iiii</i><iframe data-src="/test"/><b>bbb</b></p>`,
        },
    ],
    domsArchitecturalSpace: [
        {
            name: "Fix a complex DOM and add the architectural spaces",
            content: `
                Bonjour,
                <br>
                <b>comment va-<i>tu</i> ?</b>
                <table><td>wrong TD</td> free text in table</table>
                <i><font color="red">comment</font> <font color="blue">va-<b>tu</b></font> ?</i>
                <div>
                    text dans div ?

                    if (div) {
                        console.log('div');
                    }
                </div>
                <pre> 
                    if (tata) {
                        console.log('tutu');
                    }

                    <span>OKI</span>
                </pre>

                <section>
                    <block>
                        % if toto:
                        TOTO
                        %end
                    </block>
                </section>
                <p>
                    <i>iiii</i> <iframe data-src="/test"/> <b>bbb</b>
                </p>
            `,
            test: `<p>
    Bonjour,
    <br/>
    <b>comment va-<i>tu</i> ?</b>
</p>
<table>
    <tbody>
        <tr>
            <td>
                wrong TD
            </td>
        </tr>
        <tr>
            <td>
                free text in table
            </td>
        </tr>
    </tbody>
</table>
<p>
    <i><font color="red">comment</font> <font color="blue">va-<b>tu</b></font> ?</i>
</p>
<div>
    <p>
        text dans div ? if (div) { console.log('div'); }
    </p>
</div>
<pre> 
                    if (tata) {
                        console.log('tutu');
                    }

                    <span>OKI</span>
                </pre>
<section>
    <block>
        <p>
            % if toto: TOTO %end
        </p>
    </block>
</section>
<p>
    <i>iiii</i>
    <iframe data-src="/test"/>
    <b>bbb</b>
</p>`,
        },
    ],

    test: function (assert) {
        var self = this;
        this.doms.forEach(function (test) {
            self.dependencies.Arch.setEditorValue(test.content);
            var value = self.dependencies.Arch.getValue();
            assert.strictEqual(value, test.test, test.name)
        });
        this.domsArchitecturalSpace.forEach(function (test) {
            self.dependencies.Arch.setEditorValue(test.content);
            var value = self.dependencies.Arch.getValue({architecturalSpace: true});
            assert.strictEqual("#" + value + "#", "#" + test.test + "#", test.name);
        });
    },
});

Manager.addPlugin('TestArchAndRules', TestArchAndRules);

});
