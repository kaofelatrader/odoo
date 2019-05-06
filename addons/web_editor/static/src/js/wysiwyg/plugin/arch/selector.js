odoo.define('web_editor.wysiwyg.plugin.Selector', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');
var ArchNode = require('wysiwyg.plugin.arch.node');

var booleans = "checked|selected|disabled|readonly|required",
    // http://www.w3.org/TR/css3-selectors/#whitespace
    whitespace = "[\\x20\\t\\r\\n\\f]",
    // http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
    identifier = "(?:\\\\.|[\\w-]|[^\0-\\xa0])+",
    // Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
    attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +
        // Operator (capture 2)
        "*([*^$|!~]?=)" + whitespace +
        // "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
        "*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
        "*\\]",
    pseudos = ":(" + identifier + ")(?:\\((" +
        // To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
        // 1. quoted (capture 3; capture 4 or capture 5)
        "('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
        // 2. simple (capture 6)
        "((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
        // 3. anything else (capture 2)
        ".*" +
        ")\\)|)",
    // Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
    rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
    rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),
    // CSS escapes
    // http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
    runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
    funescape = function( _, escaped, escapedWhitespace ) {
        var high = "0x" + escaped - 0x10000;
        // NaN means non-codepoint
        // Support: Firefox<24
        // Workaround erroneous numeric interpretation of +"0x"
        return high !== high || escapedWhitespace ?
            escaped :
            high < 0 ?
                // BMP codepoint
                String.fromCharCode( high + 0x10000 ) :
                // Supplemental Plane codepoint (surrogate pair)
                String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
    },
    rpseudo = new RegExp( pseudos ),
    nthchild = /^\s*(([+-])?([0-9]+)?n\s*)?([+-])?\s*([0-9]+)$/,
    reqExp = {
        "ID": new RegExp( "^#(" + identifier + ")" ),
        "CLASS": new RegExp( "^\\.(" + identifier + ")" ),
        "TAG": new RegExp( "^(" + identifier + "|[*])" ),
        "ATTR": new RegExp( "^" + attributes ),
        "PSEUDO": new RegExp( "^" + pseudos ),
    };

var Selector = AbstractPlugin.extend({
    dependencies: ['Arch'],

    _cacheSearchToken: {},

    start: function () {
        var string = 'p, section#eee, .parallax, :not(.o_gallery > .container) > .carousel:first-child span.toto[truc="33"]';

        var self = this;
        setTimeout(function () {
            console.log(string);
            console.log(self.search(string));
        }, 2000);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {ArchNode} [archNode]
     * @param {string} string
     * @param {boolean} [noCache]
     **/
    search: function (archNode, string) {
        var self = this;
        if (typeof archNode === 'string') {
            string = archNode;
            archNode = this.dependencies.Arch._arch;
        } else if (!archNode) {
            archNode = this.dependencies.Arch._arch;
        }

        string = string.trim();
        var ids = [];
        this._tokenize(string).token.forEach(function (token) {
            token = self._tokenizeForSearch(token);
            self._searchFromToken([archNode], token).forEach(function (archNode) {
                if (ids.indexOf(archNode.id) === -1) {
                    ids.push(archNode.id);
                }
            });
        });
        return ids;
    },
    /**
     * @param {ArchNode|Element} [archNode]
     * @param {string} string
     * @param {boolean} [noCache]
     **/
    is: function (archNode, string) {
        var self = this;
        if (!(archNode instanceof ArchNode)) {
            archNode = this.dependencies.Arch._parseElement(archNode);
        }
        var is = false;
        this._tokenize(string.trim()).token.forEach(function (token) {
            if (is) {
                return;
            }
            var hasChild = false;
            token.forEach(function (t) {
                if (t.type === 'BROWSE') {
                    hasChild = true;
                }
            })
            if (hasChild) {
                token = self._tokenizeForSearch(token);
                var archNodes = self._searchFromToken([self.dependencies.Arch._arch], token);
                is = archNodes.indexOf(archNode) !== -1;
            } else {
                is = !!self._searchFromToken([archNode], token).length;
            }
        });
        return is;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _tokenizeForSearch: function (token) {
        if (token[0].type !== 'BROWSE' && (token[0].type !== 'TAG' || token[0].identifier !== 'EDITABLE')) {
            token = [{
                type: 'BROWSE',
                identifier: ' ',
            }].concat(token);
        }
        return token;
    },
    _tokenize: function (selector) {
        var matched, match, tokens, type, soFar, groups;

        if (this._cacheSearchToken[selector]) {
            return this._cacheSearchToken[selector];
        }

        soFar = selector;
        groups = [];

        while ( soFar ) {

            // Comma and first run
            if ( !matched || (match = rcomma.exec( soFar )) ) {
                if ( match ) {
                    // Don't consume trailing commas as valid
                    soFar = soFar.slice( match[0].length ) || soFar;
                }
                groups.push( (tokens = []) );
            }

            matched = false;

            // Filters
            for (var type in this) {
                if (!type.indexOf('_tokenizeExpr_') && (match = this[ type ]( soFar ))) {
                    matched = true;
                    type = type.slice(14);
                    tokens.push({
                        type: type,
                        identifier: type === 'TAG' && match[1] !== 'EDITABLE' ? match[1].toLowerCase() : match[1],
                        value: match[2],
                    });
                    soFar = soFar.slice( match[0].length );
                }
            };

            if ( !matched ) {
                break;
            }
        }

        if (soFar) {
            console.error( selector );
        }

        this._cacheSearchToken[selector] = {
            token: groups,
            rest: soFar,
        };

        return this._cacheSearchToken[selector];
    },

    _tokenizeExpr_ID: function (string) {
        return reqExp.ID.exec(string);
    },
    _tokenizeExpr_CLASS: function (string) {
        return reqExp.CLASS.exec(string);
    },
    _tokenizeExpr_TAG: function (string) {
        return reqExp.TAG.exec(string);
    },
    _tokenizeExpr_ATTR: function (string) {
        var match = reqExp.ATTR.exec(string);
        if (!match) {
            return;
        }

        match[1] = match[1].replace( runescape, funescape );
        // Move the given value to match[3] whether quoted or unquoted
        match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );
        if ( match[2] === "~=" ) {
            match[3] = " " + match[3] + " ";
        }
        return [match[0], match[1], match.slice( 2, 4 )]
    },
    _tokenizeExpr_BROWSE: function (string) {
        return rcombinators.exec(string);
    },
    _tokenizeExpr_PSEUDO: function (string) {
        var match = reqExp.PSEUDO.exec(string);
        if (!match) {
            return;
        }

        var excess,
            unquoted = !match[6] && match[2];

        // Accept quoted arguments as-is
        if ( match[3] ) {
            match[2] = match[4] || match[5] || "";

        // Strip excess characters from unquoted arguments
        } else if ( unquoted && rpseudo.test( unquoted ) &&
            // Get excess from tokenize (recursively)
            (excess = this._tokenize( unquoted ).rest.length) &&
            // advance to the next closing parenthesis
            (excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

            // excess is a negative index
            match[0] = match[0].slice( 0, excess );
            match[2] = unquoted.slice( 0, excess );
        }

        // Return only captures needed by the pseudo filter method (type and argument)
        return match.slice( 0, 3 );
    },


    _searchFromToken: function (archNodes, token) {
        for (var k = 0; k < token.length; k++) {
            var t = token[k];
            archNodes = this['_searchFromToken_' + t.type](archNodes, t.identifier, t.value);
        }
        return archNodes;
    },


    _getChildren: function (archNode, loop) {
        var self = this;
        var nodes = [];
        if (archNode.childNodes) {
            archNode.childNodes.forEach(function (archNode) {
                if (!archNode.isVirtual() || !archNode.isText()) {
                    nodes.push(archNode);
                }
                if (loop) {
                    nodes.concat(self._getChildren(archNode, loop));
                }
            });
        }
        return nodes;
    },
    _searchFromTokenLoop: function (archNodes, callback) {
        var nodes = [];
        archNodes.forEach(function (archNode) {
            if (callback(archNode)) {
                nodes.push(archNode);
            }
        })
        return nodes;
    },


    _searchFromToken_ID: function (archNodes, identifier) {
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return archNode.attributes && archNode.attributes.id && archNode.attributes.id.toLowerCase() === identifier;
        });
    },
    _searchFromToken_CLASS: function (archNodes, identifier) {
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return archNode.attributes && archNode.attributes.class.contains(identifier);
        });
    },
    _searchFromToken_ATTR: function (archNodes, identifier, value) {
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            var val = archNode.attributes && archNode.attributes[identifier];
            if (!val) {
                return false;
            }
            val = val.toSting();
            switch (identifier[0]) {
                case '=': return val == identifier[1];
                default: debugger;
            }
        });
    },
    _searchFromToken_TAG: function (archNodes, identifier) {
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return archNode.nodeName === identifier;
        });
    },
    _searchFromToken_BROWSE: function (archNodes, identifier) {
        var self = this;
        var nodes = [];
        if (identifier === '>') {
            archNodes.forEach(function (archNode) {
                nodes = nodes.concat(self._getChildren(archNode));
            });
        } else if (identifier === '+') {
            debugger;
        } else if (identifier === '-') {
            debugger;
        } else {
            archNodes.forEach(function (archNode) {
                nodes = nodes.concat(self._getChildren(archNode, true));
            });
        }
        return nodes;
    },
    _searchFromToken_PSEUDO: function (archNodes, identifier, value) {
        return this['_searchFromToken_PSEUDO_' + identifier](archNodes, value);
    },


    _searchFromToken_PSEUDO_lang: function (archNodes, value) {
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return archNode.attributes.lang === value;
        });
    },
    _searchFromToken_PSEUDO_enabled: function (archNodes) {
        var self = this;
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return !self._searchFromToken_PSEUDO_disabled([archNode])[0];
        });
    },
    _searchFromToken_PSEUDO_disabled: function (archNodes) {
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return archNode.attributes.disabled !== 'false' && !!archNode.attributes.disabled;
        });
    },
    _searchFromToken_PSEUDO_checked: function (archNodes) {
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return archNode.attributes.checked !== 'false' && !!archNode.attributes.checked;
        });
    },

    _getSiblingsType: function (archNode) {
        var siblings = this._getChildren(archNode.parent);
        var group = {__group__: []};
        for (var k = 0, len = siblings; k < len ; k++) {
            var sibling = siblings[k];
            if (!group[sibling.nodeName]) {
                group.__group__.push(sibling.nodeName);
                group[sibling.nodeName] = [];
            }
            group[sibling.nodeName].push(sibling);
        }
        return group;
    },
    '_searchFromToken_PSEUDO_nth-child': function (archNodes, value, nthOfType) {
        if (value === 'odd') {
            odd = '2n+1';
        }
        if (value === 'even') {
            odd = '2n';
        }

        var pos = value.match(nthchild);
        if (!pos) {
            throw new Error('Wrong value "' + value + '" for "nth-child" selector');
        }

        var negVal = pos[4] && pos[4] === '-';
        if (pos[1] && negVal) {
            throw new Error('Wrong value "' + value + '" for "nth-child" selector');
        }

        var self = this;
        var neg = pos[2] && pos[2] === '-';
        var n = pos[3];
        var val = pos[5];
        var nodes = [];
        archNodes.forEach(function (archNode) {
            var group = this._getSiblingsType(archNode);
            var siblings = nthOfType ? this._getSiblingsType(archNode)[archNode.nodeName] : this._getChildren(archNode.parent);
            var archNodeIndex = siblings.indexOf(archNode);
            var max =   neg ? val : siblings.length;
            var index = neg ? 0 : negVal ? max - val : val;

            while (index < max) {
                if (archNodeIndex === index) {
                    nodes.push(archNodes[i]);
                    break;
                }
                if (n === 0) {
                    break;
                } else if (neg && !n) {
                    index++;
                } else {
                    index += n;
                }
            }
        });
        return nodes;
    },
    '_searchFromToken_PSEUDO_nth-last-child': function (archNodes, value) {
        var nodes = this['_searchFromToken_PSEUDO_nth-child'](archNodes, value);
        return nodes.length ? [nodes[nodes.length - 1]] : [];
    },
    '_searchFromToken_PSEUDO_nth-of-type': function (archNodes, value) {
        return this['_searchFromToken_PSEUDO_nth-child'](archNodes, value, true);
    },
    '_searchFromToken_PSEUDO_nth-last-of-type': function (archNodes, value) {
        var nodes = this['_searchFromToken_PSEUDO_nth-child'](archNodes, value, true);
        return nodes.length ? [nodes[nodes.length - 1]] : [];
    },
    '_searchFromToken_PSEUDO_first-child': function (archNodes) {
        return this['_searchFromToken_PSEUDO_nth-child'](archNodes, '1');
    },
    '_searchFromToken_PSEUDO_last-child': function (archNodes) {
        return this['_searchFromToken_PSEUDO_nth-child'](archNodes, '-1');
    },
    '_searchFromToken_PSEUDO_first-of-type': function (archNodes) {
        return this['_searchFromToken_PSEUDO_nth-child'](archNodes, '1', true);
    },
    '_searchFromToken_PSEUDO_last-of-type': function (archNodes) {
        return this['_searchFromToken_PSEUDO_nth-child'](archNodes, '-1', true);
    },
    '_searchFromToken_PSEUDO_only-child': function (archNodes) {
        var self = this;
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return self._getChildren(archNode).length === 1;
        });
    },
    '_searchFromToken_PSEUDO_only-of-type': function (archNodes) {
        var self = this;
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return self._getSiblingsType(archNode)[archNode.nodeName].length === 1;
        });
    },

    _searchFromToken_PSEUDO_eq: function (archNodes, value) {
        return archNodes.slice(+value, 1);
    },
    _searchFromToken_PSEUDO_empty: function (archNodes) {
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return archNode.isEmpty();
        });
    },
    _searchFromToken_PSEUDO_is: function (archNodes, value) {
        var self = this;
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return self.is(archNode, value);
        });
    },
    _searchFromToken_PSEUDO_not: function (archNodes, value) {
        var self = this;
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return !self._searchFromToken_PSEUDO_is([archNode], value)[0];
        });
    },
    _searchFromToken_PSEUDO_has: function (archNodes, value) {
        var self = this;
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return !!self.search(archNode, value).length;
        });
    },
    _searchFromToken_PSEUDO_val: function (archNodes, value) {
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return archNode.attributes.value === value;
        });
    },
    _searchFromToken_PSEUDO_contains: function (archNodes, value) {
        return this._searchFromTokenLoop(archNodes, function (archNode) {
            return archNode.attributes.textContent().indexOf(value) !== -1;
        });
    },
});

Manager.addPlugin('Selector', Selector);


});
