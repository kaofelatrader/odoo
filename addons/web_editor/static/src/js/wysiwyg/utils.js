odoo.define('wysiwyg.utils', function (require) {
'use strict';

return {
    /**
     * HTML for blank contents of an element, for carret position.
     *
     * @property {String} blank
     */
    blank: '<br>',
    /**
     * A list of default style tags, in lower case.
     *
     * @property {String []} defaultStyleTags
     */
    defaultStyleTags: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'],
    /**
     * HTML for an empty paragraph.
     *
     * @property {String} emptyPara
     */
    emptyPara: (function () {
        return "<p>" + this.blank + "</p>";
    }),
    /**
     * List of removeFormat candidates (tags that format text inline).
     *
     * @see: https://dvcs.w3.org/hg/editing/raw-file/tip/editing.html#removeformat-candidate
     * @property {String []} formatTags
     */
    formatTags: [
        'abbr',
        'acronym',
        'b',
        'bdi',
        'bdo',
        'big',
        'blink',
        'cite',
        'code',
        'dfn',
        'em',
        'font',
        'i',
        'ins',
        'kbd',
        'mark',
        'nobr',
        'q',
        's',
        'samp',
        'small',
        'span',
        'strike',
        'strong',
        'sub',
        'sup',
        'tt',
        'u',
        'var',
    ],
    /**
     * Name and tag of text format nodes.
     *
     * @property {Object} textFormats
     */
    textFormats: {
        bold: 'B',
        italic: 'I',
        underline: 'U',
        strikethrough: 'S',
        superscript: 'SUP',
        subscript: 'SUB',
    },
    /**
     * This dictionary contains oft-used regular expressions,
     * for performance and readability purposes. It can be
     * accessed and extended by the getRegex() method.
     *
     * @property {Object} {
     *      expressionName: {
     *          flagName|'noflag': expression (RegEx),
     *      }
     * }
     */
    regex: {
        char: {
            noflag: /\S|\u00A0|\uFEFF/,
        },
        emptyElemWithBR: {
            noflag: /^\s*<br\/?>\s*$/,
        },
        endInvisible: {
            noflag: /\uFEFF$/,
        },
        endNotChar: {
            noflag: /[^\S\u00A0\uFEFF]+$/,
        },
        endSingleSpace: {
            noflag: /[\S\u00A0\uFEFF]\s$/,
        },
        endSpace: {
            noflag: /\s+$/,
        },
        invisible: {
            noflag: /\uFEFF/,
        },
        notWhitespace: {
            noflag: /\S/,
        },
        onlyEmptySpace: {
            noflag: /^[\s\u00A0\uFEFF]*(<br>)?[\s\u00A0\uFEFF]*$/,
        },
        semicolon: {
            noflag: / ?; ?/,
        },
        space: {
            noflag: /\s+/,
            g: /\s+/g,
        },
        spaceOrNewline: {
            noflag: /[\s\n\r]+/,
            g: /[\s\n\r]+/g,
        },
        startAndEndInvisible: {
            noflag: /^\uFEFF|\uFEFF$/,
            g: /^\uFEFF|\uFEFF$/g,
        },
        startAndEndSpace: {
            noflag: /^\s+|\s+$/,
            g: /^\s+|\s+$/g,
        },
        startAndEndSemicolon: {
            noflag: /^ ?;? ?| ?;? ?$/,
        },
        startInvisible: {
            noflag: /^\uFEFF/,
        },
        startNotChar: {
            noflag: /^[^\S\u00A0\uFEFF]+/,
        },
        startSingleSpace: {
            noflag: /^\s[\S\u00A0\uFEFF]/,
        },
        startSpace: {
            noflag: /^\s+/,
        },
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Find nearest ancestor predicate hit.
     *
     * @param {Node} node
     * @param {Function} pred - predicate function
     * @returns {Node|null}
     */
    ancestor: function (node, pred) {
        if (!pred) {
            return null;
        }
        pred = pred.bind(this);
        while (node) {
            if (pred(node)) {
                return node;
            }
            if (this.isEditable(node)) {
                break;
            }
            node = node.parentNode;
        }
        return null;
    },
    /**
     * Append a given collection of nodes to a given node.
     *
     * @param {Node} node
     * @param {Collection} children
     * @returns {Node}
     */
    appendChildNodes: function (node, children) {
        $.each(children, function (idx, child) {
            node.appendChild(child);
        });
        return node;
    },
    /**
     * Get a unicode or HTML escaped String for a special character.
     *
     * Possible values for `name`:
     * - 'nbsp'         non-breakable space
     * - 'zeroWidth'    zero-width character
     *
     * @param {Object} name
     * @param {Boolean} isEscaped
     * @returns {String}
     */
    char: function (name, isEscaped) {
        var esc = {
            nbsp: '&nbsp;',
            zeroWidth: '&#65279;',
        };
        var unicode = {
            nbsp: '\u00A0',
            zeroWidth: '\uFEFF',
        };
        return isEscaped ? esc[name] : unicode[name];
    },
    /**
     * Find the nearest common ancestor node between two nodes.
     *
     * @param {Node} nodeA
     * @param {Node} nodeB
     * @returns {Node|null}
     */
    commonAncestor: function (nodeA, nodeB) {
        var ancestors = this.listAncestor(nodeA);
        for (var n = nodeB; n; n = n.parentNode) {
            if ($.inArray(n, ancestors) > -1) {
                return n;
            }
        }
        return null; // difference document area
    },
    /**
     * Compares two nodes to see if they are similar.
     * "Similar" means that they have the same tag, styles, classes and attributes.
     *
     * @param {Node} node
     * @param {Node} otherNode
     * @returns {Boolean} true if the nodes are similar
     */
    compareNodes: function (node, otherNode) {
        if (!otherNode || !node) {
            return false;
        }
        if (node.tagName !== otherNode.tagName) {
            return false;
        }
        if (this.isText(node)) {
            return true;
        }
        this.removeBlankAttrs(node);
        this.removeBlankAttrs(otherNode);
        this.orderClass(node);
        this.orderStyle(node);
        this.orderClass(otherNode);
        this.orderStyle(otherNode);
        if (node.attributes.length !== otherNode.attributes.length) {
            return false;
        }
        for (var i = 0; i < node.attributes.length; i++) {
            var attr = node.attributes[i];
            var otherAttr = otherNode.attributes[i];
            if (attr.name !== otherAttr.name || attr.value !== otherAttr.value) {
                return false;
            }
        }
        return true;
    },
    /**
     * Return the number of leading breakable space in the give text node.
     * Note: return 0 if the node is not of type text.
     *
     * @param {Node}
     * @returns {Number}
     */
    countLeadingBreakableSpace: function (node) {
        if (!this.isText(node)) {
            return 0;
        }
        var clone = $(node).clone()[0];
        var breakableSpace = this.removeExtremeBreakableSpace(clone, 0).start;
        return breakableSpace === 1 ? 0 : breakableSpace;
    },
    /**
     * Return the number of trailing breakable space in the given text node.
     * Note: return 0 if the node is not of type text.
     *
     * @param {Node} node
     * @returns {Number}
     */
    countTrailingBreakableSpace: function (node) {
        if (!this.isText(node)) {
            return 0;
        }
        var clone = $(node).clone()[0];
        var breakableSpace = this.removeExtremeBreakableSpace(clone, 0).end;
        return breakableSpace === 1 ? 0 : breakableSpace;
    },
    /**
     * Find the given node's `editable` ancestor, if any.
     *
     * @param {Node} node
     * @returns {Node}
     */
    editableAncestor: function (node) {
        return this.ancestor(node, this.isEditable);
    },
    /**
     * Get the "leaf" children of a list of nodes.
     * In this context, a "leaf" is understood as
     * either a text node or a node that doesn't expect text contents.
     *
     * @param {Node[]} nodes
     * @returns {Node[]}
     */
    filterLeafChildren: function (nodes) {
        var self = this;
        return _.compact(_.map(nodes, function (node) {
            if (node.firstChild) {
                node = node.firstChild;
            }
            if (
                node.tagName === "BR" ||
                self.isVisibleText(node) ||
                self.isFont(node) ||
                self.isImg(node) ||
                self.isDocument(node)
            ) {
                return node;
            }
        }));
    },
    /**
     * Get the first ancestor of a node, that is of block type (or itself).
     *
     * @param {Node} node
     * @returns {Node}
     */
    firstBlockAncestor: function (node) {
        var self = this;
        return this.ancestor(node, function (n) {
            return self.isNodeBlockType(n);
        });
    },
    /**
     * Synctactic shorthand for `firstLeafUntil` without predicate function.
     *
     * @see firstLeafUntil
     * @param {Node} node
     * @returns {Node}
     */
    firstLeaf: function (node) {
        return this.firstLeafUntil(node);
    },
    /**
     * Get the first leaf of a node, that meets the optional conditions
     * set in predicate function.
     * In this context, a leaf node is understood as a childless node.
     *
     * @param {Node} node
     * @param {(Node) => Boolean} [pred]
     * @returns {Node}
     */
    firstLeafUntil: function (node, pred) {
        while (node.firstChild && (!pred || pred(node))) {
            node = node.firstChild;
        }
        return node;
    },
    /**
     * Get the first leaf of a node, that is an element and not a BR.
     * In this context, a leaf node is understood as a childless node.
     *
     * @param {Node} node
     * @returns {Node} node
     */
    firstNonBRElementLeaf: function (node) {
        while (node.firstElementChild && node.firstElementChild.tagName !== 'BR') {
            node = node.firstElementChild;
        }
        return node;
    },
    /**
     * Returns the node targeted by a path
     *
     * @param {Object[]} list of object (tagName, offset)
     * @returns {Node}
     */
    fromPath: function (path) {
        var node = this.editableAncestor(path[0]);
        var to;
        path = path.slice();
        while ((to = path.shift())) {
            node = _.filter(node.childNodes, function (node) {
                return !to.tagName && node.tagName === 'BR' || node.tagName === to.tagName;
            })[to.offset];
        }
        return node;
    },
    /**
     * Returns (and creates if necessary) a regular expression.
     * If a regular expression with the given name exists, simply returns it.
     * Otherwise, creates a new one with the given name, exp and flag.
     *
     * @param {String} name
     * @param {String} [flag] optional
     * @param {String} [exp] optional
     * @returns {RegExp}
     */
    getRegex: function (name, flag, exp) {
        var flagName = flag || 'noflag';
        flag = flag || '';
        // If the regular expression exists, but not with this flag:
        // retrieve whichever version of it and apply the new flag to it,
        // then save that new version in the `regex` object.
        if (this.regex[name] && !this.regex[name][flagName]) {
            if (exp) {
                console.warn("A regular expression already exists with the name: " + name + ". The expression passed will be ignored.");
            }
            var firstVal = this.regex[name][Object.keys(this.regex[name])[0]];
            this.regex[name][flagName] = new RegExp(firstVal, flag);
        } else if (!this.regex[name]) {
            // If the regular expression does not exist:
            // save it into the `regex` object, with the name, expression
            // and flag passed as arguments (if any).
            if (!exp) {
                throw new Error("Cannot find a regular expression with the name " + name + ". Pass an expression to create it.");
            }
            this.regex[name] = {};
            this.regex[name][flagName] = new RegExp(exp, flag);
        }
        return this.regex[name][flagName];
    },
    /**
     * Returns (and creates if necessary) a regular expression
     * targetting a string made ONLY of some combination of the
     * characters enabled with options.
     * If a regular expression with the given options exists, simply returns it.
     * eg: getRegexBlank({space: true, nbsp: true}) => /^[\s\u00A0]*$/
     *
     * @param {Object} [options] optional
     * @param {Boolean} options.not ^ (not all that follows)
     * @param {Boolean} options.space \s (a whitespace)
     * @param {Boolean} options.notspace \S (not a whitespace)
     * @param {Boolean} options.nbsp \u00A0 (a non-breakable space)
     * @param {Boolean} options.invisible \uFEFF (a zero-width character)
     * @param {Boolean} options.newline \n|\r (a new line or a carriage return)
     * @param {Boolean} options.atLeastOne + (do not target blank strings)
     * @returns {RegExp}
     */
    getRegexBlank: function (options) {
        options = options || {};
        var charMap = {
            notspace: {
                name: 'NotSpace',
                exp: '\\S',
            },
            space: {
                name: 'Space',
                exp: '\\s',
            },
            nbsp: {
                name: 'Nbsp',
                exp: '\\u00A0',
            },
            invisible: {
                name: 'Invisible',
                exp: '\\uFEFF',
            },
            newline: {
                name: 'Newline', 
                exp: '\\n\\r',
            },
        };
        var name = 'only';
        var exp = '';
        var atLeastOne = options.atLeastOne;
        options.atLeastOne = false;

        // Build the expression and its name
        if (options.not) {
            name += 'Not';
            exp += '^';
            options.not = false;
        }
        _.each(options, function (value, key) {
            if (value && charMap[key]) {
                name += charMap[key].name;
                exp += charMap[key].exp;
            }
        });

        exp = '^[' + exp + ']' + (atLeastOne ? '+' : '*') + '$';
        name += atLeastOne ? 'One' : '';
        return this.getRegex(name, undefined, exp);
    },
    /**
     * Return true if the given node has children.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    hasChildren: function (node) {
        return !!(node && node.childNodes && node.childNodes.length);
    },
    /**
     * Return true if the given node is an anchor element (A, BUTTON, .btn).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isAnchor: function (node) {
        return (
                node.tagName === 'A' ||
                node.tagName === 'BUTTON' ||
                $(node).hasClass('btn')
            ) &&
            !$(node).hasClass('fa') &&
            !$(node).hasClass('o_image');
    },
    /**
     * Returns true if the node is a text node containing nothing
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isBlankText: function (node) {
        return this.isText(node) &&
            this.getRegexBlank({
                not: true,
                notspace: true,
                nbsp: true,
                invisible: true,
            })
            .test(node.textContent);
    },
    /**
     * Returns true if the node is blank.
     * In this context, a blank node is understood as
     * a node expecting text contents (or with children expecting text contents)
     * but without any.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isBlankNode: function (node) {
        if (this.isVoid(node) || this.isIcon && this.isIcon(node)) {
            return false;
        }
        if (this.getRegexBlank({
                space: true,
            }).test(node[this.isText(node) ? 'textContent' : 'innerHTML'])) {
            return true;
        }
        if (node.childNodes.length && _.all(node.childNodes, this.isBlankNode.bind(this))) {
            return true;
        }
        return false;
    },
    /**
     * Return true if the given node is a block.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isBlock: function (node) {
        return !this.isInline(node);
    },
    /**
     * Return true if the given node is a line break element (BR).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isBR: function (node) {
        return this.makePredByNodeName('BR')(node);
    },
    /**
     * Return true if the given node is a table cell element (TD, TH).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isCell: function (node) {
        return node && /^TD|^TH/.test(node.nodeName.toUpperCase());
    },
    /**
     * Return true if the given node is a data element (DATA).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isData: function (node) {
        return this.makePredByNodeName('DATA')(node);
    },
    /**
     * Return true if the given node is `note-editable`.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isEditable: function (node) {
        return node && $(node).hasClass('note-editable');
    },
    /**
     * Return true if the given node's type is element (1).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isElement: function (node) {
        return node && node.nodeType === 1;
    },
    /**
     * Return true if the given node is empty.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isEmpty: function (node) {
        var len = this.nodeLength(node);
        if (len === 0) {
            return true;
        }
        if (!this.isText(node) && len === 1 && node.innerHTML === this.blank) {
            // ex) <p><br></p>, <span><br></span>
            return true;
        }
        if (_.all(node.childNodes, this.isText) && node.innerHTML === '') {
            // ex) <p></p>, <span></span>
            return true;
        }
        return false;
    },
    /**
     * Return true if the given node is a font (FONT, or this.isIcon if that method exists).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isFont: function (node) {
        return node && node.tagName === "FONT" || this.isIcon && this.isIcon(node);
    },
    /**
     * Returns true if the node is a "format" node.
     * In this context, a "format" node is understood as
     * an editable block or an editable element expecting text
     * (eg.: p, h1, span).
     *
     * @param {Node} node
     * @param {String []} [styleTags]
     * @returns {Boolean}
     */
    isFormatNode: function (node, styleTags) {
        styleTags = styleTags || this.defaultStyleTags;
        return node.tagName && styleTags.indexOf(node.tagName.toLowerCase()) !== -1;
    },
    /**
     * Return true if the given node is an image element (IMG).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isImg: function (node) {
        return this.makePredByNodeName('IMG')(node);
    },
    /**
     * Returns true if the node is within a table.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isInTable: function (node) {
        return !!this.ancestor(node, function (n) {
            return n.tagName === 'TABLE';
        });
    },
    /**
     * Return true if the given node is contained within a node of given tag name.
     *
     * @param {Node} node
     * @param {Boolean} tag eg: 'B', 'I', 'U'
     * @returns {Boolean}
     */
    isInTag: function (node, tag) {
        return !!this.ancestor(node, this.makePredByNodeName(tag));
    },
    /**
     * Return true if the given node is an inline element.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isInline: function (node) {
        return !this.isCell(node) && 
            !this.isEditable(node) &&
            !this.isList(node) &&
            !this._isHr(node) &&
            !this._isPara(node) &&
            !this._isTable(node) &&
            !this._isBlockquote(node) &&
            !this.isData(node);
    },
    /**
     * Return true if the given node is contained within a list element.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isInList: function (node) {
        return !!this.ancestor(node, this.isList);
    },
    /**
     * Return true if the given node is the left-most node of given ancestor.
     *
     * @param {Node} node
     * @param {Node} ancestor
     * @returns {Boolean}
     */
    isLeftEdgeOf: function (node, ancestor) {
        while (node && node !== ancestor) {
            if (this.position(node) !== 0) {
                return false;
            }
            node = node.parentNode;
        }
        return true;
    },
    /**
     * Return true if the given node is a list item element (LI).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isLi: function (node) {
        return this.makePredByNodeName('LI')(node);
    },
    /**
     * Return true if the given node is a (un-)ordered list element (UL, OL).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isList: function (node) {
        return node && /^UL|^OL/.test(node.nodeName.toUpperCase());
    },
    /**
     * Returns true if the node is a block.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isNodeBlockType: function (node) {
        if (this.isText(node)) {
            return false;
        }
        var display = window.getComputedStyle(node).display;
        // All inline elements have the word 'inline' in their display value, except 'contents'
        return display.indexOf('inline') === -1 && display !== 'contents';
    },
    /**
     * Return true if the given node is a preformatted text element (PRE).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isPre: function (node) {
        return this.makePredByNodeName('PRE')(node);
    },
    /**
     * Return true if the given node is the right-most node of given ancestor.
     *
     * @param {Node} node
     * @param {Node} ancestor
     * @returns {Boolean}
     */
    isRightEdgeOf: function (node, ancestor) {
        if (!ancestor) {
            return false;
        }
        while (node && node !== ancestor) {
            if (this.position(node) !== this.nodeLength(node.parentNode) - 1) {
                return false;
            }
            node = node.parentNode;
        }
        return true;
    },
    /**
     * Return true if the given node is a span element (SPAN).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isSpan: function (node) {
        return this.makePredByNodeName('SPAN')(node);
    },
    /**
     * Return true if the given node's type is text (3).
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isText: function (node) {
        return node && node.nodeType === 3;
    },
    /**
     * Returns true if the node is a text node with visible text.
     *
     * @param {Node} node
     * @returns {Boolean}
     */
    isVisibleText: function (node) {
        return !node.tagName && this.getRegex('char').test(node.textContent);
    },
    /**
     * Return true if the given node is a void element (BR, COL, EMBED, HR, IMG, INPUT, ...).
     *
     * @see http://www.w3.org/html/wg/drafts/html/master/syntax.html#void-elements
     * @param {Node} node
     * @returns {Boolean}
     */
    isVoid: function (node) {
        return node && /^BR|^IMG|^HR|^IFRAME|^BUTTON|^INPUT/.test(node.nodeName.toUpperCase());
    },
    /**
     * Find farthest ancestor predicate hit.
     *
     * @param {Node} node
     * @param {Function} pred predicate function
     * @returns {Node}
     */
    lastAncestor: function (node, pred) {
        var ancestors = this.listAncestor(node).filter(pred.bind(this));
        return ancestors[ancestors.length - 1];
    },
    /**
     * Get the last leaf of a node, that is editable and not a media.
     * In this context, a leaf node is understood as a childless node.
     *
     * @param {Node} node
     * @returns {Node}
     */
    lastLeaf: function (node) {
        while (node.lastChild && (!this.isMedia || !this.isMedia(node))) {
            node = node.lastChild;
        }
        return node;
    },
    /**
     * Return a new array of ancestor nodes (until optional predicate hit).
     *
     * @param {Node} node
     * @param {Function} [pred] predicate function
     * @returns {Node[]}
     */
    listAncestor: function (node, pred) {
        var self = this;
        var ancestors = [];
        this.ancestor(node, function (el) {
            if (!self.isEditable(el)) {
                ancestors.push(el);
            }
            return pred ? pred(el) : false;
        });
        return ancestors;
    },
    /**
     * Return a new array of decendant nodes (until optional predicate hit).
     *
     * @param {Node} node
     * @param {Function} [pred] predicate function
     * @returns {Node[]}
     */
    listDescendant: function (node, pred) {
        var descendants = [];
        // start DFS(depth first search) with node
        (function fnWalk(current) {
            if (node !== current && (!pred || pred(current))) {
                descendants.push(current);
            }
            for (var idx = 0, len = current.childNodes.length; idx < len; idx++) {
                fnWalk(current.childNodes[idx]);
            }
        })(node);
        return descendants;
    },
    /**
     * Return a new array of the given node's next siblings (until optional predicate hit).
     *
     * @param {Node} node
     * @param {Function} [pred] predicate function
     * @returns {Node[]}
     */
    listNext: function (node, pred) {
        var nodes = [];
        while (node) {
            if (pred && pred(node)) {
                break;
            }
            nodes.push(node);
            node = node.nextSibling;
        }
        return nodes;
    },
    /**
     * Return a new array of the given node's previous siblings (until optional predicate hit).
     *
     * @private
     * @param {Node} node
     * @param {Function} [pred] predicate function
     * @returns {Node[]}
     */
    listPrev: function (node, pred) {
        var nodes = [];
        while (node) {
            if (pred && pred(node)) {
                break;
            }
            nodes.push(node);
            node = node.previousSibling;
        }
        return nodes;
    },
    /**
     * Return a predicate function returning true if a given node has the given nodeName.
     *
     * @param {String} nodeName
     * @returns {Function}
     */
    makePredByNodeName: function (nodeName) {
        nodeName = nodeName.toUpperCase();
        return function (node) {
            return node && node.nodeName.toUpperCase() === nodeName;
        };
    },
    /**
     * Return the given node's length (text length if text node or number of child nodes).
     *
     * @param {Node} node
     * @returns {Number}
     */
    nodeLength: function (node) {
        if (this.isText(node)) {
            return node.nodeValue.length;
        }
        if (node) {
            return node.childNodes.length;
        }
        return 0;
    },
    /**
     * Return true if the `container` contains the `contained` and only
     * the `contained` (blank text nodes are ignored).
     *
     * @param {Node} container
     * @param {Node} contained
     * @returns {Boolean}
     */
    onlyContains: function (container, contained) {
        var self = this;
        if (!$.contains(container, contained)) {
            return false;
        }
        var $contents = $(container).contents();
        var otherContents = $contents.filter(function (index, node) {
            if (node === contained || self.isText(node) && !self.isVisibleText(node)) {
                return false;
            }
            return true;
        });
        return !otherContents.length;
    },
    /**
     * Reorders the classes in the node's class attribute and returns it.
     *
     * @param {Node} node
     * @returns {String}
     */
    orderClass: function (node) {
        var className = node.getAttribute && node.getAttribute('class');
        if (!className) {
            return null;
        }
        className = className.replace(this.getRegex('spaceOrNewline', 'g'), ' ')
            .replace(this.getRegex('startAndEndSpace', 'g'), '')
            .replace(this.getRegex('space', 'g'), ' ');
        className = className.replace('o_default_snippet_text', '')
            .replace('o_checked', '');
        if (!className.length) {
            node.removeAttribute("class");
            return null;
        }
        className = className.split(" ");
        className.sort();
        className = className.join(" ");
        node.setAttribute('class', className);
        return className;
    },
    /**
     * Reorders the styles in the node's style attributes and returns it.
     *
     * @param {Node} node
     * @returns {String}
     */
    orderStyle: function (node) {
        var style = node.getAttribute('style');
        if (!style) {
            return null;
        }
        style = style.replace(this.getRegex('spaceOrNewline'), ' ')
            .replace(this.getRegex('startAndEndSemicolon', 'g'), '')
            .replace(this.getRegex('semicolon', 'g'), ';');
        if (!style.length) {
            node.removeAttribute("style");
            return null;
        }
        style = style.split(";");
        style.sort();
        style = style.join("; ") + ";";
        node.setAttribute('style', style);
        return style;
    },
    /**
     * Returns the path from the editable node to the given node.
     *
     * @param {Node} node
     * @returns {Object[]} list of objects (tagName, offset)
     */
    path: function (node) {
        var path = [];
        while (node && !this.isEditable(node)) {
            var tagName = node.tagName;
            path.unshift({
                tagName: tagName,
                offset: _.filter(node.parentNode.childNodes, function (node) {
                    return node.tagName === tagName;
                }).indexOf(node),
            });
            node = node.parentNode;
        }
        return path;
    },
    /**
     * Returns the given node's offset from its parent.
     *
     * @param {Node} node
     * @returns {Number}
     */
    position: function (node) {
        var offset = 0;
        while ((node = node.previousSibling)) {
            offset += 1;
        }
        return offset;
    },
    /**
     * Removes all attributes without a value from the given node.
     *
     * @param {Node} node
     * @returns {Node}
     */
    removeBlankAttrs: function (node) {
        _.each([].slice.call(node.attributes), function (attr) {
            if (!attr.value) {
                node.removeAttribute(attr.name);
            }
        });
        return node;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    
    /**
     * Return true if the given node is a block quote element (BLOCKQUOTE).
     *
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    _isBlockquote: function (node) {
        return this.makePredByNodeName('BLOCKQUOTE')(node);
    },
    /**
     * Return true if the given node is a horizontal rule element (HR).
     *
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    _isHr: function (node) {
        return this.makePredByNodeName('HR')(node);
    },
    /**
     * Return true if the given node is a paragraph element (DIV, P, LI, H[1-7]).
     *
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    _isPara: function (node) {
        if (this.isEditable(node)) {
            return false;
        }
        // Chrome(v31.0), FF(v25.0.1) use DIV for paragraph
        return node && /^DIV|^P|^LI|^H[1-7]/.test(node.nodeName.toUpperCase());
    },
    /**
     * Return true if the given node is a table element (TABLE).
     *
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    _isTable: function (node) {
        return this.makePredByNodeName('TABLE')(node);
    },
    /**
     * Return true if the given node is a text area element (TEXTAREA).
     *
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    _isTextarea: function (node) {
        return this.makePredByNodeName('TEXTAREA')(node);
    },
};

});
