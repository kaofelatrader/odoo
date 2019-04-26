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
     */
    test: function (assert, keyboardTests) {
        var self = this;
        var nTests = keyboardTests.length;
        var nOKTests = 0;
        var defPollTest = Promise.resolve();
        keyboardTests = JSON.parse(JSON.stringify(keyboardTests || []));

        function pollTest(test) {
            var def = Promise.resolve();
            self.trigger_up('set_value', {value: test.content});

            function poll(step) {
                return new Promise(function (resolve) {
                    var target;
                    if (step.start) {
                        try {
                            self._selectText(test.name, assert, step.start, step.end);
                        } catch (e) {
                            assert.notOk(e.message, test.name);
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
                            target = self.dependencies.Arch.getRange().ec;
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
                                target = self.dependencies.Arch.getRange().ec;
                                target = !target || target.tagName ? target : target.parentNode;
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
                                    assert.notOk("Should have a target to trigger the keyup", test.name);
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
                // test content
                if (test.test) {
                    var value = self.dependencies.Test.getValue();
                    if (assert.strictEqual(value, test.test, test.name)) {
                        nOKTests += 1;
                    }
                }
            });
        }
        while (keyboardTests.length) {
            defPollTest = defPollTest.then(pollTest.bind(null, keyboardTests.shift()));
        }


        return defPollTest.then(function () {
            var success = nTests - nOKTests === 0;
            var message = success ? 'All ' + nTests + ' tests OK.' :
                'Result: ' + nOKTests + '/' + nTests + ' passed. ' + (nTests - nOKTests) + ' to go.';
            var bgColor = success ? 'green' : 'yellow';
            var textColor = success ? 'white' : 'black';
            var css = 'background-color: ' + bgColor + '; color: ' + textColor + ';';
            console.info('%c' + message, css);
        });
    },
    keydown: function (target, keyPress) {
        var self = this;
        target = target.tagName ? target : target.parentNode;
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
        this.dependencies.Test.triggerNativeEvents(target, 'keydown', keyPress).then(function (events) {
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
    _querySelectorAllWithEq: function(selector, document) {
        var remainingSelector = selector;
        var baseElement = document;
        var firstEqIndex = remainingSelector.indexOf(':eq(');

        while (firstEqIndex !== -1) {
            var leftSelector = remainingSelector.substring(0, firstEqIndex);
            var rightBracketIndex = remainingSelector.indexOf(')', firstEqIndex);
            var eqNum = remainingSelector.substring(firstEqIndex + 4, rightBracketIndex);
            eqNum = parseInt(eqNum, 10);

            var selectedElements = baseElement.querySelectorAll(leftSelector);
            if (eqNum >= selectedElements.length) {
               return [];
            }
            baseElement = selectedElements[eqNum];

            remainingSelector = remainingSelector.substring(rightBracketIndex + 1).trim();
            // Note - for now we just ignore direct descendants:
            // 'a:eq(0) > i' gets transformed into 'a:eq(0) i'; we could maybe use :scope
            // to fix this later but support is iffy
            if (remainingSelector.charAt(0) === '>') {
                remainingSelector = remainingSelector.substring(1).trim();
            }

            firstEqIndex = remainingSelector.indexOf(':eq(');
        }

        if (remainingSelector !== '') {
            return Array.from(baseElement.querySelectorAll(remainingSelector));
        }

        return [baseElement];
    },
    _querySelectorAllWithContents: function (testName, assert, selector) {
        // eg: ".class:contents()[0]->1" selects the first contents of the 'class' class, with an offset of 1
        var sel = selector.match(reDOMSelection);
        try {
            var node = this._querySelectorAllWithEq(sel[1], this.editable)
            // var node = this.editable.querySelectorAll(sel[1]);
        } catch (e) {
            assert.notOk(e.message, testName);
            var node = $(sel[1], this.editable);
        }
        node = node[0];
        var point = new BoundaryPoint(
            sel[3] ? node.childNodes[+sel[4]] : node,
            sel[5] ? +sel[6] : 0
        );
        if (!point.node || point.offset > (point.node.tagName ? point.node.childNodes : point.node.textContent).length) {
            assert.notOk("Node not found: '" + selector + "' " + (point.node ? "(container: '" + (node.outerHTML || node.textContent) + "')" : ""), testName);
        }
        return point;
    },
    _selectText: function (testName, assert, start, end) {
        start = this._querySelectorAllWithContents(testName, assert, start);
        var target = start.node;
        target = target.tagName ? target : target.parentNode;
        this.dependencies.Test.triggerNativeEvents(target, 'mousedown');
        if (end) {
            end = this._querySelectorAllWithContents(testName, assert, end);
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
