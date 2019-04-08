odoo.define('web_editor.wysiwyg.plugin.dropblock', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $ = require('web_editor.jquery');
var _ = require('web_editor._');


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
        // 'drag-allowed': '_onDropZoneCheck', // trigger with dragAndDrop & callback = hasDropZone
        'drag': '_onDragAndDropStart',
        'dragAndDrop': '_onDragAndDropMove',
        'drop': '_onDragAndDropEnd',
    },

    /**
     * @override
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

        this._triggerDragAndDrop = this._throttled(50, this._triggerDragAndDrop.bind(this));
    },
    start: function () {
        var self = this;
        var promise = this._super();
        if (!this.options.dropblocks) {
            promise = promise.then(this._loadTemplateBlocks.bind(this, this.options.dropBlockTemplate));
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
        this._blockContainer.innerHTML = this.options.renderTemplate('DropBlock', dropBlockTemplate || 'wysiwyg.dropblock.defaultblocks');
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
            contents: [].slice.call(this.utils.clone(block.querySelector('content')).childNodes),
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
        this.trigger('drag', Object.assign({}, this._dragAndDrop));
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

        this.trigger('drop', this._dragAndDrop, this._selectedDragAndDrop);
        this._dragAndDrop = null;
        this._selectedDragAndDrop = null;
    },
    /**
     *
     * @params {enum<before|after|append|prepend>} position
     * @params {Node} node
     * @params {boolean} [vertical]
     * @returns {Node}
     **/
    _createDropZone: function (position, node, vertical) {
        var dropzone = document.createElement('dropblock-dropzone');
        if (vertical) {
            dropzone.setAttribute('orientation', 'vertical');
            dropzone.style.float = 'node';
            dropzone.style.display = 'inline-block';
        }
        switch (position) {
            case 'before':
                node.parentNode.insertBefore(dropzone, node);
                break;
            case 'after':
                if (node.nextSibling) {
                    node.parentNode.insertBefore(dropzone, node.nextSibling);
                }
                node.parentNode.appendChild(dropzone);
                break;
            case 'append':
                node.appendChild(dropzone);
                break;
            case 'prepend':
                if (node.firstChild) {
                    node.insertBefore(dropzone, node.firstChild);
                } else {
                    node.appendChild(dropzone);
                }
                break;
        }

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
    _triggerDragAndDrop: function () {
        this.trigger('dragAndDrop');
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

    _addDropZone: function () {
        var self = this;
        var children = [].slice.call(this.editable.children);

        this._origin = document.createElement('dropblock-dropzone-origin');
        if (this.editable.firstChild) {
            this.editable.insertBefore(this._origin, this.editable.firstChild);
        } else {
            this.editable.appendChild(this._origin);
        }
        this._originBox = this._origin.getBoundingClientRect();

        var dropzones = children.map(function (child) {
            return self._createDropZone('before', child);
        });
        this._createDropZone('append', this.editable);
    },

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    _onDragAndDropEnd: function (dragAndDrop, dropzone) {
        dragAndDrop.contents.forEach(function (node) {
            dropzone.parentNode.insertBefore(node, dropzone);
        });
        this._origin.parentNode.removeChild(this._origin);
        this._enabledDropZones.forEach(function (dropzone) {
            dropzone.node.parentNode.removeChild(dropzone.node);
        });
    },
    _onDragAndDropMove: function () {
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
            this._dragAndDrop.contents.forEach(function (node) {
                select.node.parentNode.insertBefore(node, select.node);
            });
            if (this._selectedDragAndDrop && this._selectedDragAndDrop !== select.node) {
                this._selectedDragAndDrop.style.display = '';
            }
            this._selectedDragAndDrop = select.node;
            this._selectedDragAndDrop.style.display = 'none';
        } else if (this._selectedDragAndDrop) {
            this._dragAndDrop.contents.forEach(function (node) {
                node.parentNode.removeChild(node);
            });
            this._selectedDragAndDrop.style.display = '';
            this._selectedDragAndDrop = null;
        }
    },
    _onDragAndDropStart: function (dragAndDrop) {
        this._addDropZone();
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
            this._triggerDragAndDrop();
        }
    },
    _onMouseUp: function (ev) {
        this._dragAndDropEnd();
    },
});

Manager.addPlugin('DropBlock', DropBlock);

});
