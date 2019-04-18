odoo.define('wysiwyg.plugin.arch.renderer', function (require) {
'use strict';

function Renderer (editable) {
    this.editable = editable;
    this.reset();
}
Renderer.prototype = {
    getElement: function (id) {
        return this.elements[id];
    },
    update: function (newJSON) {
        if (newJSON.forEach) {
            newJSON.forEach(this._update.bind(this));
        } else {
            this._update(newJSON);
        }
        this._clean();
        this.redraw();
    },
    redraw: function (options) {
        var self = this;
        options = options || {};

        if (options.forceDirty) {
            this._markAllDirty();
        }

        Object.keys(this.changes).forEach(function (id) {
            var changes = self.changes[id];
            delete self.changes[id];
            if (self.jsonById[id]) {
                self._redraw(self.jsonById[id], changes, options);
            }
        });
    },
    reset: function (json) {
        this.changes = {};
        this.jsonById = {
            '1': {
                id: 1,
                childNodes: [],
            },
        };
        this.elements = {
            '1': this.editable,
        };

        if (json) {
            this.update(json);
        }
    },
    whoIsThisNode: function (element) {
        for (var k in this.elements) {
            if (this.elements[k] === element) {
                return this.jsonById[k].id;
            }
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _update: function (newJSON) {
        var oldJSON = this.jsonById[newJSON.id] || {id: newJSON.id};
        this.jsonById[newJSON.id] = oldJSON;

        if (newJSON.nodeName && !oldJSON.nodeName) {
            oldJSON.nodeName = newJSON.nodeName;
        }

        var changes = {};
        if (oldJSON.nodeValue !== newJSON.nodeValue) {
            changes.nodeValue = newJSON.nodeValue;
            oldJSON.nodeValue = newJSON.nodeValue;
        }
        if (newJSON.attributes || oldJSON.attributes) {
            if (!oldJSON.attributes) {
                changes.attributes = newJSON.attributes.slice();
            } else {
                var attributes = [];
                oldJSON.attributes.forEach(function (attribute) {
                    for (var k = 0; k < newJSON.attributes.length; k++) {
                        if (newJSON.attributes[k][0] === attribute[0]) {
                            return;
                        }
                    }
                    attributes.push([attribute[0], false]);
                });
                (newJSON.attributes || []).slice().forEach(function (attribute) {
                    for (var k = 0; k < oldJSON.attributes.length; k++) {
                        if (oldJSON.attributes[k][0] === attribute[0]) {
                            if (oldJSON.attributes[k][1] === attribute[1]) {
                                return;
                            }
                            attributes.push(attribute);
                        }
                    }
                });
                if (attributes.length) {
                    changes.attributes = attributes;
                }
            }
            oldJSON.attributes = newJSON.attributes.slice();
        }
        if (newJSON.childNodes || oldJSON.childNodes) {
            newJSON.childNodes = newJSON.childNodes || [];
            var childNodesIds = newJSON.childNodes.map(function (json) { return json.id; });

            if (!oldJSON.childNodes) {
                changes.childNodes = childNodesIds;
            } else if (oldJSON.childNodes.length !== newJSON.childNodes.length) {
                changes.childNodes = childNodesIds;
            } else {
                for (var k = 0; k < childNodesIds.length; k++) {
                    if (oldJSON.childNodes[k] !== childNodesIds[k]) {
                        changes.childNodes = childNodesIds;
                        break;
                    }
                }
            }
            newJSON.childNodes.forEach(this._update.bind(this));
            oldJSON.childNodes = childNodesIds;
        }

        if (Object.keys(changes).length) {
            this.changes[newJSON.id] = changes;
        }
    },
    _allIds: function (id) {
        var ids = [id];
        var json = this.jsonById[id];
        if (json.childNodes) {
            for (var k = 0; k < json.childNodes.length; k++) {
                ids.push.apply(ids, this._allIds(json.childNodes[k]));
            }
        }
        return ids;
    },
    _clean: function () {
        var self = this;
        var ids = this._allIds(1);
        Object.keys(this.jsonById).forEach(function (id) {
            if (ids.indexOf(+id) === -1) {
                delete self.jsonById[id];
                delete self.elements[id];
            }
        });
    },
    _getElement: function (id, target) {
        var json = this.jsonById[id];
        var el = this.elements[json.id];
        var freeElement = target && target !== el && !this.whoIsThisNode(target) ? target : null;

        if (el && freeElement) {
            freeElement.parentNode.removeChild(freeElement);
        }
        if (!el && freeElement) {
            el = freeElement;
        }

        if (!el) {
            if (json.nodeValue) {
                el = document.createTextNode(json.nodeValue);
            } else {
                el = document.createElement(json.nodeName);
            }
        } else { // virtual node can mutate or try to use a free element
            var isText = 'nodeValue' in json;
            if (el.tagName && isText) {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
                el = document.createTextNode(json.nodeValue);
            } else if (!isText && json.nodeName && (!el.tagName || el.tagName.toLowerCase() !== json.nodeName)) {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
                el = document.createElement(json.nodeName);
            }
        }
        this.elements[json.id] = el;
        return el;
    },
    _markAllDirty: function () {
        Object.keys(this.jsonById).forEach(function (id) {
            var json = Object.assign({}, self.jsonById[id]);
            self.changes[id] = json;
            if (json.childNodes) {
                json.childNodes = json.childNodes.map(function (json) {
                    return json.id;
                });
            }
        });
    },
    _redraw: function (json, changes, options) {
        var self = this;
        options = options || {};
        var node;
        if (json.isVirtual && !options.keepVirtual) {
            node = document.createDocumentFragment();
        } else {
            node = self._getElement(json.id);

            if (changes.attributes) {
                changes.attributes.forEach(function (attribute) {
                    if (!attribute[1] || !attribute[1].length) {
                        node.removeAttribute(attribute[0]);
                    } else {
                        node.setAttribute(attribute[0], attribute[1]);
                    }
                });
            }

            if (options.displayId) {
                node.setAttribute('data-archnode-id', json.id);
            }
        }

        if ('nodeValue' in changes) {
            node.textContent = changes.nodeValue;
        }

        if (changes.childNodes) {
            // sort nodes and add new nodes
            changes.childNodes.forEach(function (id, index) {
                id = +id;
                var childNode = self._getElement(id, node.childNodes[index]);
                var childIndex = [].indexOf.call(node.childNodes, childNode);
                if (childIndex !== index) {
                    if (!node.childNodes[index]) {
                        node.appendChild(childNode);
                    } else {
                        node.insertBefore(childNode, node.childNodes[index]);
                    }
                }
            });
            // remove unknown and removed nodes
            [].slice.call(node.childNodes).forEach(function (childNode) {
                for (var id in self.elements) {
                    id = +id;
                    if (self.elements[id] === childNode) {
                        break;
                    }
                }
                if (changes.childNodes.indexOf(id) === -1 || self.elements[id] !== childNode) {
                    childNode.parentNode.removeChild(childNode);
                }
            });
        }

        return node;
    },
};

return Renderer;

});
