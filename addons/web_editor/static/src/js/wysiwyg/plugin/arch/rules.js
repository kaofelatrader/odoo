odoo.define('wysiwyg.plugin.arch.rules', function (require) {
'use strict';

var ArchNode = require('wysiwyg.plugin.arch.node');
var text = require('wysiwyg.plugin.arch.text');

ArchNode.include({
    applyRules: function () {
        this._applyRulesCustom();
        if (!this.__removed) {
            this._applyRulesArchNode();
        }
        if (!this.__removed) {
            this._applyRulesOrder();
        }
        if (!this.__removed) {
            this._applyRulesCheckParents();
        }
        if (!this.__removed) {
            this._applyRulesPropagation();
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _applyRulesArchNode: function () {
    },
    _applyRulesOrder: function () {
    },
    _applyRulesCustom: function () {
        var rules = this._applyRulesFilterRules(this.params.customRules);
        var ruleMethod;
        while (ruleMethod = rules.pop()) {
            var json = ruleMethod(this.toJSON());
            var fragment = this.params.import(json);
            if (fragment) {
                var childNodes = fragment.childNodes.slice();
                this.parent.insertBefore(fragment, this);
                this.remove();
                childNodes.forEach(function (archNode) {
                    archNode.applyRules();
                });
                break;
            }
        }
    },
    _applyRulesGenerateParent: function (nodeName) {
        if (nodeName === 'EDITABLE') {
            return;
        }
        var newParent = this.params._create(nodeName, []);
        newParent.__applyRulesCheckParentsFlag = true;
        this.parent.insertBefore(newParent, this);
        newParent.append(this);
        newParent.applyRules();
    },
    _applyRulesCheckParents: function () {
        var rules = this.params.parentedRules;
        var parentedRule = this._applyRulesFilterRules(rules);
        if (!(!parentedRule.length || parentedRule.indexOf(null) !== -1)) {

            // We seek to minimize the number of parents to create
            var parentName = this.parent.nodeName === 'FRAGMENT' ? 'EDITABLE' : this.parent.nodeName;
            var allreadyParents = [parentName];
            var availableCandidates = [parentName];
            var nextAvailables = [];
            // add children who match everthing for check next level
            for (var i = 0; i < rules.length; i++) {
                if (rules[i][0].indexOf(null) === -1) {
                    continue;
                }
                rules[i][1].forEach(function (value) {
                    if (allreadyParents.indexOf(value) === -1) {
                        allreadyParents.push(value);
                        nextAvailables.push(value)
                    }
                });
            }

            while (availableCandidates.length) {
                for (var k = 0; k < availableCandidates.length; k++) {

                    // check if a parent can match at this level
                    var candidate = availableCandidates[k];
                    if (parentedRule.indexOf(candidate) !== -1) {
                        if (parentName === candidate) {
                            return;
                        }
                        return this._applyRulesGenerateParent(candidate);
                    }

                    // add children for check next level
                    for (var i = 0; i < rules.length; i++) {
                        if (rules[i][0].indexOf(candidate) === -1) {
                            continue;
                        }
                        rules[i][1].forEach(function (value) {
                            if (allreadyParents.indexOf(value) === -1) {
                                allreadyParents.push(value);
                                nextAvailables.push(value)
                            }
                        });
                    }
                }
                availableCandidates = nextAvailables;
                nextAvailables = [];
            }

            if (parentedRule.indexOf(parentName) === -1 && parentedRule.indexOf('EDITABLE') === -1) {
                this._applyRulesGenerateParent(parentedRule[0]);
            }
        }
    },
    _applyRulesPropagation: function () {
        var childNodes = this.childNodes.slice();
        childNodes.forEach(function (archNode) {
            archNode.applyRules();
        });
        var newParents = [];
        this.childNodes.forEach(function (archNode) {
            if (childNodes.indexOf(archNode) === -1 && archNode.__applyRulesCheckParentsFlag) {
                archNode.__applyRulesCheckParentsFlag = false;
                newParents.push(archNode);
            }
        });
        this._applyRulesMergeExcessStructure(newParents);
    },
    _applyRulesFilterRules: function (rules) {
        var selectedRules = [];
        for (var k = 0; k < rules.length; k++) {
            var children = rules[k][1];
            for (var i = 0; i < children.length; i++) {
                var check = children[i];
                if ((typeof check === 'function' && check(this.toJSON())) || this.nodeName === check) {
                    selectedRules = selectedRules.concat(rules[k][0]);
                    break;
                }
            }
        }
        return selectedRules;
    },
    _applyRulesMergeExcessStructure: function (newParents) {
        for (var k = 0; k < newParents.length; k++) {
            var item = newParents[k];
            var prev = item.previousSibling(function (n) {
                return !(n instanceof VirtualTextNode) && !(n instanceof text.ArchitecturalSpaceNode);
            });
            if (prev && prev.nodeName === item.nodeName && newParents.indexOf(prev) !== -1 && item.attributes.toString() === prev.attributes.toString()) {
                item.childNodes.slice().forEach(function (node) {
                    prev.append(node);
                });
                item.remove();
                continue;
            }

            var next = item.previousSibling(function (n) {
                return !(n instanceof VirtualTextNode) && !(n instanceof text.ArchitecturalSpaceNode);
            });
            if (next && next.nodeName === item.nodeName && newParents.indexOf(next) !== -1 && item.attributes.toString() === next.attributes.toString()) {
                item.childNodes.slice().forEach(function (node) {
                    next.append(node);
                });
                item.remove();
                continue;
            }
        }
    },
    _architecturalSpaceNodePropagation: function () {
        if (this.__removed || this instanceof text.ArchitecturalSpaceNode) {
            return;
        }
        if (this.parent) {
            this._addArchitecturalSpaceNode();
        }
        if (!(this instanceof TextNode) && !this.ancestor(this.isPre)) {
            this.childNodes.slice().forEach(function (archNode) {
                archNode._ArchitecturalSpaceNodePropagation();
            });
        }
    },
    _addArchitecturalSpaceNode: function () {
        var prev = this.previousSibling();
        if (prev instanceof text.ArchitecturalSpaceNode && this.isText() && this.nodeValue[0] === '\n') {
            console.log(prev.previousSibling());
            prev.remove();
        }

        if (!this.isBlock() && !this.parent.isBlock()) {
            return;
        }

        if (!(prev instanceof text.ArchitecturalSpaceNode) && (!this.isText() || this.nodeValue[0] !== '\n')) {
            this.parent.insertBefore(new text.ArchitecturalSpaceNode(this.params), this);
        }

        if (this.isBlock() && !this.isPre() && !this.isText() && !this.isVoid() && this.childNodes.length) {
            this.append(new text.ArchitecturalSpaceNode(this.params), this);
        }
    },
});

});
