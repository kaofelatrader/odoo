odoo.define('web_editor.wysiwyg.plugin.dropblock', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');


var DropBlock = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_dropblock.xml'],
    buttons: {
        template: 'wysiwyg.buttons.dropblock',
        active: '_isActive',
        enabled: '_enabled',
    },

    sidebarEvents: {
        'mousedown': '_onMouseDownBlock',
    },
    handleEvents: {
        //'mousedown': '_onMouseDownHandle',
    },
    documentDomEvents: {
        'mousemove': '_onMouseMove',
        'mouseup': '_onMouseUp',
    },
    pluginEvents: {
        'dropzone': '_onDragAndDropNeedDropZone',
        'drag': '_onDragAndDropStart',
        'dragAndDrop': '_onDragAndDropMove',
        'drop': '_onDragAndDropEnd',
    },

    /**
     *
     * @override
     *
     * @param {Object} parent
     * @param {Object} params
     *
     * @param {Object} params.dropblocks
     * @param {string} params.dropblocks.title
     * @param {Object[]} params.dropblocks.blocks
     * @param {string} params.dropblocks.blocks.title
     * @param {string} params.dropblocks.blocks.thumbnail
     * @param {string} params.dropblocks.blocks.html
     **/
    init: function (parent, params) {
        this._super.apply(this, arguments);

        this._blockHandle = document.createElement('dropblock-handle');
        this._blockContainer = document.createElement('dropblock');
        if (this.options.dropblocks) {
            this._createBlocks(this.options.dropblocks);
        }
        params.insertBeforeEditable(this._blockContainer);
        params.insertBeforeEditable(this._blockHandle);

        this._dragAndDropMoveSearch = this._throttled(50, this._dragAndDropMoveSearch.bind(this));
    },
    start: function () {
        var self = this;
        var promise = this._super();
        if (!this.options.dropblocks) {
            promise = promise.then(this._loadTemplateBlocks.bind(this, this.options.dropBlockTemplate || 'wysiwyg.dropblock.defaultblocks'));
        }
        return promise.then(this._bindEvents.bind(this));
    },
    /**
     * Prepares the page so that it may be saved:
     * - Asks the snippet editors to clean their associated snippet
     * - Remove the 'contentEditable' attributes
     **/
    saveEditor: function () {
    },
    blurEditor: function () {
        this._dragAndDropEnd();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Toggle the code view
     **/
    toggle: function () {
        this.isOpen = !this.isOpen;
        this._blockContainer.style.display = this.isOpen ? 'block' : 'none';
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     *
     * @private
     **/
    _bindEvents: function () {
        this._bindDOMEvents(this._blockContainer, this.sidebarEvents);
        this._bindDOMEvents(this._blockHandle, this.handleEvents);
    },
    /**
     * 
     * @params {object[]}   dropblocks
     * @params {string}     dropblocks[0].title
     * @params {object[]}   dropblocks[0].blocks
     * @params {string}     dropblocks[0].blocks.title
     * @params {string}     dropblocks[0].blocks.thumbnail
     * @params {string}     dropblocks[0].blocks.html
     **/
    _createBlocks: function (dropblocks) {
        var self = this;
        var blocks = [];
        var blockContainer = this._blockContainer;
        dropblocks.forEach(function (groupBlocks) {
            var nodeBlocks = document.createElement('blocks');

            var title = document.createElement('wysiwyg-title');
            title.innerHTML = groupBlocks.title;
            nodeBlocks.appendChild(title);

            groupBlocks.blocks.forEach(function (block) {
                var blockNode = document.createElement('block');
                var thumbnail = self._createBlockThumbnail(block);
                var content = document.createElement('content');
                content.innerHTML = block.html;
                blocks.push(blockNode);
                nodeBlocks.appendChild(blockNode);
                blockNode.appendChild(thumbnail);
                blockNode.appendChild(content);
            });

            blockContainer.appendChild(nodeBlocks);
        });
        this._blockNodes = blocks;
    },
    _createBlockThumbnail: function (thumbnailParams) {
        var thumbnail = document.createElement('dropblock-thumbnail');
        var preview = document.createElement('preview');
        preview.style.backgroundImage = 'url(' + thumbnailParams.thumbnail + ')';
        var title = document.createElement('wysiwyg-title');
        title.innerHTML = thumbnailParams.title;
        thumbnail.appendChild(preview);
        thumbnail.appendChild(title);
        return thumbnail;
    },
    /**
     * Return true if the codeview is active
     *
     * @returns {Boolean}
     **/
    _enabled: function () {
        return true;
    },
    /**
     * Return true if the container is open
     *
     * @returns {Boolean}
     **/
    _isActive: function () {
        return this.isOpen;
    },
    /**
     * The template must have the same structure created by '_createBlocks'
     * method
     * 
     * @params {string} dropBlockTemplate
     **/
    _loadTemplateBlocks: function (dropBlockTemplate) {
        this._blockContainer.innerHTML = this.options.renderTemplate('DropBlock', dropBlockTemplate);
        this._blockNodes = this._blockContainer.querySelectorAll('block');
    },
    _dragAndDropStartCloneSidebarElements: function (block) {
        var thumbnail = block.querySelector('dropblock-thumbnail');
        var box = thumbnail.getBoundingClientRect();

        this._dragAndDrop = {
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            thumbnail: this.utils.clone(thumbnail),
            contents: [].slice.call(this.utils.clone(block.querySelector('content')).children),
        };
    },
    _dragAndDropStartCloneEditableElements: function (block) {
        var thumbnail = this._createBlockThumbnail({
            thumbnail: '/web_editor/static/src/img/picture.png',
            title: '',
        });

        var box = this._blockContainer.querySelector('dropblock-thumbnail').getBoundingClientRect();
        this._dragAndDrop = {
            width: box.width,
            height: box.height,
            thumbnail: thumbnail,
            contents: [block],
        };

        var nextSibling = block.nextSibling;
        var parent = block.parentNode;
        parent.removeChild(block);
        this._dragAndDropMoveBlock = function reset () {
            if (nextSibling) {
                parent.insertBefore(block, nextSibling);
            } else {
                parent.appendChild(block);
            }
            return blocks;
        };
    },
    _dragAndDropStart: function (ev) {
        var handlePosition = this._blockHandle.getBoundingClientRect();
        this._blockHandle.appendChild(this._dragAndDrop.thumbnail);
        this._dragAndDrop.thumbnail.style.width = this._dragAndDrop.width + 'px';
        this._dragAndDrop.thumbnail.style.height = this._dragAndDrop.height + 'px';
        this._dragAndDrop.clientX = ev.clientX;
        this._dragAndDrop.clientY = ev.clientY;
        this._dragAndDrop.dx = parseInt(this._dragAndDrop.left - ev.clientX - handlePosition.left);
        this._dragAndDrop.dy = parseInt(this._dragAndDrop.top - ev.clientY - handlePosition.top);
        this._dragAndDropMove(ev);
        this._enabledDropZones = [];
        this._createDropZoneOriginPosition();
        var dropZones = [];
        this.trigger('dropzone', this._dragAndDrop.contents.slice(), dropZones);
        this.trigger('drag', this._dragAndDrop.contents.slice(), dropZones);
    },
    _dragAndDropMove: function (ev) {
        if (!this._dragAndDrop) {
            return;
        }
        var left = ev.clientX + this._dragAndDrop.dx;
        var top = ev.clientY + this._dragAndDrop.dy;
        this._dragAndDrop.thumbnail.style.left = (left >= 0 ? '+' : '') + left + 'px';
        this._dragAndDrop.thumbnail.style.top = (top >= 0 ? '+' : '') + top + 'px';
        this._dragAndDrop.clientX = ev.clientX;
        this._dragAndDrop.clientY = ev.clientY;
    },
    _dragAndDropMoveSearch: function () {
        var editableBox = this._blockHandle.getBoundingClientRect();
        var originBox = this._origin.getBoundingClientRect();
        var dragAndDrop = this._dragAndDrop;
        var top = dragAndDrop.clientY - (this._originBox.top - originBox.top) - editableBox.top;
        var left = dragAndDrop.clientX - (this._originBox.left - originBox.left) - editableBox.left;
        if (this.isOpen) {
            left -= this._blockContainer.getBoundingClientRect().width;
        }

        var select;
        this._enabledDropZones.forEach(function (dropzone) {
            if (top >= (dropzone.box.top - 10) && top <= (dropzone.box.top + dropzone.box.height + 10) &&
                left >= (dropzone.box.left - 10) && left <= (dropzone.box.left + dropzone.box.width + 10)) {
                select = dropzone;
            }
        });


        if (select) {
            if (this._selectedDragAndDrop !== select.node) {
                this.trigger('dragAndDrop', this._dragAndDrop.contents.slice(), select.node, this._selectedDragAndDrop);
                this._selectedDragAndDrop = select.node;
            }
        } else if (this._selectedDragAndDrop) {
            this.trigger('dragAndDrop', this._dragAndDrop.contents.slice(), null, this._selectedDragAndDrop);
            this._selectedDragAndDrop = null;
        }
    },
    _dragAndDropEnd: function (ev) {
        if (!this._dragAndDrop) {
            return;
        }
        if (this._dragAndDropMoveBlock) {
            this._dragAndDropMoveBlock();
            this._dragAndDropMoveBlock = null;
        }
        this._blockHandle.removeChild(this._dragAndDrop.thumbnail);

        if (this._selectedDragAndDrop) {
            this._dragAndDrop.contents.forEach(function (node) {
                node.parentNode.removeChild(node);
            });
        }

        this._removeDropZoneOriginPosition();
        this.trigger('drop', this._dragAndDrop.contents.slice(), this._selectedDragAndDrop);
        this._dragAndDrop = null;
        this._selectedDragAndDrop = null;
    },
    _removeDropZones: function (dropzone) {
        this._enabledDropZones.forEach(function (zone) {
            if (zone.node !== dropzone) {
                zone.node.parentNode.removeChild(zone.node);
            }
        });
        if (dropzone) {
            var index = [].indexOf.call(dropzone.parentNode.childNodes, dropzone) - 1;
            dropzone.parentNode.removeChild(dropzone);
            return index;
        }
    },

    /*
    _insertDropZoneChild: function (parent) {
        var self = this;
        var css = this.window.getComputedStyle(parent);
        var parentCss = this.window.getComputedStyle(parent.parentNode);
        var float = css.float || css.cssFloat;
        var parentDisplay = parentCss.display;
        var parentFlex = parentCss.flexDirection;
        var dropzones = [];

        function isFullWidth (child) {
            return child.parent.clientWidth === child.clientWidth;
        }
        function _insertDropZoneChildOrientation (parent, child, insert) {
            var dropzone;
            var test = !!(child && ((!child.tagName && child.textContent.match(/\S/)) || child.tagName === 'BR'));
            if (test) {
                dropzone = self._insertDropZoneVertical(child, insert);
            } else if (float === 'left' || float === 'right' || (parentDisplay === 'flex' && parentFlex === 'row')) {
                dropzone = isFullWidth(parent) ? self._insertDropZoneHorizontal(child, insert) : self._insertDropZoneVertical(child, insert);
                dropzone.style.float = float;
            }
        }

        _insertDropZoneChildOrientation(parent, parent.lastChild, function (child) {
            dropzones.push(child);
            parent.appendChild(child);
        });
        _insertDropZoneChildOrientation(parent, parent.firstChild, function (child, test) {
            dropzones.push(child);
            self.utils.prependChild(parent, child);
        });

        return dropzones;
    },
    */
    _removeDropZoneOriginPosition: function () {
        this._origin.parentNode.removeChild(this._origin);
    },
    /**
     *
     * @params {enum<before|after|append|prepend>} position
     * @params {Node} node
     * @params {boolean} [vertical]
     * @returns {Node}
     **/
    _createDropZone: function (position, node, vertical) {
        if (node.tagName === 'DROPBLOCK-DROPZONE-ORIGIN') {
            return;
        }

        var dropzone = document.createElement('dropblock-dropzone');
        if (vertical) {
            dropzone.setAttribute('orientation', 'vertical');
            dropzone.style.float = 'node';
            dropzone.style.display = 'inline-block';
        }
        switch (position) {
            case 'before':
                if (node.previousSibling && node.previousSibling.tagName === 'DROPBLOCK-DROPZONE') {
                    return;
                }
                node.parentNode.insertBefore(dropzone, node);
                break;
            case 'after':
                if (node.nextSibling && node.nextSibling.tagName === 'DROPBLOCK-DROPZONE') {
                    return;
                }
                if (node.nextSibling) {
                    node.parentNode.insertBefore(dropzone, node.nextSibling);
                } else {
                    node.parentNode.appendChild(dropzone);
                }
                break;
            case 'append':
                if (node.lastChild && node.lastChild.tagName === 'DROPBLOCK-DROPZONE') {
                    return;
                }
                node.appendChild(dropzone);
                break;
            case 'prepend':
                if (node.firstChild && node.firstChild.tagName === 'DROPBLOCK-DROPZONE') {
                    return;
                }
                var firstChild = node.firstChild;
                if (firstChild.tagName === 'DROPBLOCK-DROPZONE-ORIGIN') {
                    firstChild = firstChild.nextSibling;
                }
                if (firstChild) {
                    node.insertBefore(dropzone, firstChild);
                } else {
                    node.appendChild(dropzone);
                }
                break;
        }

        this._getDropZoneBoundingClientRect(dropzone, vertical);

        // _insertDropZoneChild => dropzone size
    },
    _getDropZoneBoundingClientRect: function (dropzone, vertical) {
        var box = dropzone.getBoundingClientRect();
        this._enabledDropZones.push({
            node: dropzone,
            box: {
                top: box.top + (vertical ? 0 : 20) - this._originBox.top,
                left: box.left - this._originBox.left,
                width: box.width,
                height: box.height,
            },
        });
    },
    _createDropZones: function (dropZones) {
        var self = this;
        dropZones.forEach(function (dropZone) {
            if (dropZone.dropIn) {
                dropZone.dropIn.forEach(function (dropIn) {
                    [].slice.call(dropIn.children).map(function (child) {
                        self._createDropZone('before', child);
                    });
                    self._createDropZone('append', dropIn);
                });
            }
            if (dropZone.dropNear) {
                dropZone.dropNear.forEach(function (dropNear) {
                    self._createDropZone('before', dropNear);
                    self._createDropZone('after', dropNear);
                });
            }
        });
    },
    _createDropZoneOriginPosition: function () {
        this._origin = document.createElement('dropblock-dropzone-origin');
        if (this.editable.firstChild) {
            this.editable.insertBefore(this._origin, this.editable.firstChild);
        } else {
            this.editable.appendChild(this._origin);
        }
        this._originBox = this._origin.getBoundingClientRect();
    },

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    _onDragAndDropEnd: function (dragAndDropContents, dropzone) {
        if (!dropzone) {
            this._removeDropZones();
            return;
        }
        var node = dragAndDropContents[0];
        if (dragAndDropContents.length > 1) {
            node = document.createDocumentFragment();
            dragAndDropContents.forEach(function (node) {
                node.appendChild(node);
            });
        }

        var parent = dropzone.parentNode;
        var index = this._removeDropZones(dropzone);
        this.dependencies.Arch.insert(node, parent, index);
    },
    _onDragAndDropMove: function (dragAndDropContents, dropzone, previousDropzone) {
        if (previousDropzone) {
            previousDropzone.style.display = '';
        }

        if (dropzone) {
            dragAndDropContents.forEach(function (node) {
                dropzone.parentNode.insertBefore(node, dropzone);
            });
            dropzone.style.display = 'none';
        } else {
            dragAndDropContents.forEach(function (node) {
                node.parentNode.removeChild(node);
            });
        }
    },
    _onDragAndDropNeedDropZone: function (dragAndDropContents, dropZones) {
        dropZones.push({
            dropIn: [this.editable],
            // dropNear: this.editable.children,
        });
    },
    _onDragAndDropStart: function (dragAndDropContents, dropZones) {
        this._createDropZones(dropZones);
    },
    _onMouseDownBlock: function (ev) {
        this._dragAndDropEnd();
        var block;
        this._blockNodes.forEach(function (blockNode) {
            if (blockNode.contains(ev.target)) {
                block = blockNode;
            }
        });
        if (!block) {
            return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        this._dragAndDropStartCloneSidebarElements(block);
        this._dragAndDropStart(ev);
    },
    _onMouseDownHandle: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this._dragAndDropStartCloneEditableElements(block);
        this._dragAndDrop.left = ev.clientX - box.width/2;
        this._dragAndDrop.top = ev.clientY - box.height/2;
        this._dragAndDropStart(ev);
    },
    _onMouseMove: function (ev) {
        if (this._dragAndDrop) {
            this._dragAndDropMove(ev);
            this._dragAndDropMoveSearch();
        }
    },
    _onMouseUp: function (ev) {
        this._dragAndDropEnd();
    },
});

Manager.addPlugin('DropBlock', DropBlock);

});
