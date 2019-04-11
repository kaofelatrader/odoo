odoo.define('web_editor.wysiwyg.plugin.tests.keyboard', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var BoundaryPoint = require('wysiwyg.BoundaryPoint');

/**
 * Char codes.
 */
var keyboardMap = {
    "8": "BACKSPACE",
    "9": "TAB",
    "13": "ENTER",
    "16": "SHIFT",
    "17": "CONTROL",
    "18": "ALT",
    "19": "PAUSE",
    "20": "CAPS_LOCK",
    "27": "ESCAPE",
    "32": "SPACE",
    "33": "PAGE_UP",
    "34": "PAGE_DOWN",
    "35": "END",
    "36": "HOME",
    "37": "LEFT",
    "38": "UP",
    "39": "RIGHT",
    "40": "DOWN",
    "45": "INSERT",
    "46": "DELETE",
    "91": "OS_KEY", // 'left command': Windows Key (Windows) or Command Key (Mac)
    "93": "CONTEXT_MENU", // 'right command'
};
new Array(128 - 40).forEach(function (keyCode) {
    keyCode += 40;
    if (!keyboardMap[keyCode]) {
        keyboardMap[keyCode] = String.fromCharCode(keyCode);
    }
});

var reDOMSelection = /^(.+?)(:contents(\(\)\[|\()([0-9]+)[\]|\)])?(->([0-9]+))?$/;


var TestKeyboard = AbstractPlugin.extend({
    dependencies: ['Test'],

    /**
     * Perform a series of tests (`keyboardTests`) for using keyboard inputs.
     *
     * @see wysiwyg_keyboard_tests.js
     * @see wysiwyg_tests.js
     *
     * @param {object} assert
     * @param {object[]} keyboardTests
     * @param {string} keyboardTests.name
     * @param {string} keyboardTests.content
     * @param {object[]} keyboardTests.steps
     * @param {string} keyboardTests.steps.start
     * @param {string} [keyboardTests.steps.end] default: steps.start
     * @param {string} keyboardTests.steps.key
     * @param {object} keyboardTests.test
     * @param {string} [keyboardTests.test.content]
     * @param {string} [keyboardTests.test.start]
     * @param {string} [keyboardTests.test.end] default: steps.start
     * @param {function} [keyboardTests.test.check]
     */
    test: function (assert, keyboardTests) {
        var self = this;
        var defPollTest = Promise.resolve();
        keyboardTests = (keyboardTests || []).slice();

        function pollTest(test) {
            var def = Promise.resolve();
            self.trigger_up('set_value', {value: test.content});

            function poll(step) {
                return new Promise(function (resolve) {
                    if (step.start) {
                        try {
                            self._selectText(assert, step.start, step.end);
                        } catch (e) {
                            assert.notOk(e.message, "Should set the new range");
                        }
                        if (!self.dependencies.Arch.getRange()) {
                            throw 'Wrong range! \n' +
                                'Test: ' + test.name + '\n' +
                                'Selection: ' + step.start + '" to "' + step.end + '"\n' +
                                'DOM: ' + self.dependencies.Arch.getValue();
                        }
                    }
                    setTimeout(function () {
                        if (step.keyCode || step.key) {
                            var target = self.dependencies.Arch.getRange().ec;
                            if (window.location.search.indexOf('notrycatch') !== -1) {
                                self.keydown(target, {
                                    key: step.key,
                                    keyCode: step.keyCode,
                                    ctrlKey: !!step.ctrlKey,
                                    shiftKey: !!step.shiftKey,
                                    altKey: !!step.altKey,
                                    metaKey: !!step.metaKey,
                                });
                            } else {
                                try {
                                    self.keydown(target, {
                                        key: step.key,
                                        keyCode: step.keyCode,
                                        ctrlKey: !!step.ctrlKey,
                                        shiftKey: !!step.shiftKey,
                                        altKey: !!step.altKey,
                                        metaKey: !!step.metaKey,
                                    });
                                } catch (e) {
                                    assert.notOk(e.name + '\n\n' + e.stack, test.name);
                                }
                            }
                        }
                        setTimeout(function () {
                            if (step.keyCode || step.key) {
                                target = target.tagName ? target : target.parentNode;
                                if (target) {
                                    self.dependencies.Test.triggerNativeEvents(target, 'keyup', {
                                        key: step.key,
                                        keyCode: step.keyCode,
                                        ctrlKey: !!step.ctrlKey,
                                        shiftKey: !!step.shiftKey,
                                        altKey: !!step.altKey,
                                        metaKey: !!step.metaKey,
                                    });
                                } else {
                                    assert.ok(target, "Should have a target to trigger the keyup");
                                }
                            }
                            setTimeout(resolve);
                        });
                    });
                });
            }
            while (test.steps.length) {
                def = def.then(poll.bind(null, test.steps.shift()));
            }

            return def.then(function () {
                if (!test.test) {
                    return;
                }

                if (test.test.check) {
                    test.test.check();
                }

                // test content
                if (test.test.content) {
                    var value = self.dependencies.Arch.getValue();
                    var allInvisible = /\uFEFF/g;
                    value = value.replace(allInvisible, '&#65279;');
                    var result = test.test.content.replace(allInvisible, '&#65279;');
                    assert.strictEqual(value, result, test.name);

                    if (test.test.start && value !== result) {
                        assert.notOk("Wrong DOM (see previous assert)", test.name + " (carret position)");
                        return;
                    }
                }

                // test carret position
                if (test.test.start) {
                    var start = self._select(assert, test.test.start);
                    var range = self.dependencies.Arch.getRange();
                    if ((range.sc !== range.ec || range.so !== range.eo) && !test.test.end) {
                        assert.ok(false, test.name + ": the carret is not colapsed and the 'end' selector in test is missing");
                        return;
                    }
                    var end = test.test.end ? self._select(assert, test.test.end) : start;
                    if (start.node && end.node) {
                        range = self.dependencies.Arch.getRange();
                        var startPoint = self._endOfAreaBetweenTwoNodes(range.getStartPoint());
                        var endPoint = self._endOfAreaBetweenTwoNodes(range.getEndPoint());
                        var sameDOM = (startPoint.node.outerHTML || startPoint.node.textContent) === (start.node.outerHTML || start.node.textContent);
                        var stringify = function (obj) {
                            if (!sameDOM) {
                                delete obj.sameDOMsameNode;
                            }
                            return JSON.stringify(obj, null, 2)
                                .replace(/"([^"\s-]+)":/g, "\$1:")
                                .replace(/([^\\])"/g, "\$1'")
                                .replace(/\\"/g, '"');
                        };
                        assert.deepEqual(stringify({
                                startNode: startPoint.node.outerHTML || startPoint.node.textContent,
                                startOffset: startPoint.offset,
                                endPoint: endPoint.node.outerHTML || endPoint.node.textContent,
                                endOffset: endPoint.offset,
                                sameDOMsameNode: sameDOM && startPoint.node === start.node,
                            }),
                            stringify({
                                startNode: start.node.outerHTML || start.node.textContent,
                                startOffset: start.offset,
                                endPoint: end.node.outerHTML || end.node.textContent,
                                endOffset: end.offset,
                                sameDOMsameNode: true,
                            }),
                            test.name + " (carret position)");
                    }
                }
            });
        }
        while (keyboardTests.length) {
            defPollTest = defPollTest.then(pollTest.bind(null, keyboardTests.shift()));
        }

        return defPollTest;
    },
    keydown: function (target, keyPress) {
        var self = this;
        var target = target.tagName ? target : target.parentNode;
        if (!keyPress.keyCode) {
            for (var keyCode in keyboardMap) {
                if (keyboardMap[keyCode] === keyPress.key) {
                    keyPress.keyCode = +keyCode;
                    break;
                }
            }
        } else {
            keyPress.key = keyboardMap[keyPress.keyCode] || String.fromCharCode(keyPress.keyCode);
        }
        keyPress.keyCode = keyPress.keyCode;
        var promise = this.dependencies.Test.triggerNativeEvents(target, 'keydown', keyPress).then(function (events) {
            var promise = self.dependencies.Test.triggerNativeEvents(target, 'keydown', keyPress)

            var event = events[0]; // (only one event was triggered)
            if (!event.defaultPrevented) {
                if (keyPress.key.length === 1) {
                    self._textInput(target, keyPress.key);
                    document.execCommand("insertText", 0, keyPress.key);
                } else {
                    console.warn('Native "' + keyPress.key + '" is not supported in test');
                }
            }
        });
        this.dependencies.Test.triggerNativeEvents(target, 'keyup', keyPress);
        return target;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _textInput: function (target, char) {
        var ev = new CustomEvent('textInput', {
            bubbles: true,
            cancelBubble: false,
            cancelable: true,
            composed: true,
            data: char,
            defaultPrevented: false,
            detail: 0,
            eventPhase: 3,
            isTrusted: true,
            returnValue: true,
            sourceCapabilities: null,
            type: "textInput",
            which: 0,
        });
        ev.data = char;
        target.dispatchEvent(ev);

         if (!ev.defaultPrevented) {
            document.execCommand("insertText", 0, ev.data);
        }
    },
    _select: function (assert, selector) {
        // eg: ".class:contents()[0]->1" selects the first contents of the 'class' class, with an offset of 1
        var sel = selector.match(reDOMSelection);
        try {
            var node = this.editable.querySelectorAll(sel[1]);
        } catch (e) {
            assert.ok(false, e.message);
            var node = $(sel[1], this.editable);
        }
        if (node.length > 1) {
            assert.notOk("More of one node are found: '" + sel[1] + "'");
        }
        node = node[0];
        var point = new BoundaryPoint(
            sel[3] ? node.childNodes[+sel[4]] : node,
            sel[5] ? +sel[6] : 0
        );
        if (!point.node || point.offset > (point.node.tagName ? point.node.childNodes : point.node.textContent).length) {
            assert.notOk("Node not found: '" + selector + "' " + (point.node ? "(container: '" + (point.node.outerHTML || point.node.textContent) + "')" : ""));
        }
        return point;
    },
    _selectText: function (assert, start, end) {
        start = this._select(assert, start);
        var target = start.node;
        target = target.tagName ? target : target.parentNode;
        this.dependencies.Test.triggerNativeEvents(target, 'mousedown');
        if (end) {
            end = this._select(assert, end);
            this.dependencies.Arch.setRange({
                sc: start.node,
                so: start.offset,
                ec: end.node,
                eo: end.offset,
            });
        } else {
            this.dependencies.Arch.setRange({
                sc: start.node,
                so: start.offset,
            });
        }
        target = end ? end.node : start.node;
        this.dependencies.Test.triggerNativeEvents(target, 'mouseup');
    },
    _endOfAreaBetweenTwoNodes: function (point) {
        // move the position because some browsers put the carret at the end of the previous area after normalize
        if (
            !point.node.tagName &&
            point.offset === point.node.textContent.length &&
            !/\S|\u00A0/.test(point.node.textContent)
        ) {
            var startNode = point.node;
            point = Object.assing({}, point).nextUntilNode(function (node) {
                return node !== startNode && (!node.tagName || !node.textContent.length);
            }) || point;
        }
        return point;
    },
});

Manager.addPlugin('TestKeyboard', TestKeyboard);

});
