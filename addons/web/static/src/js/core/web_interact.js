odoo.define('web.interact', function (require) {
"use strict";

var _draggable = function (el, options) {

    var interactOptions = {
        onstart: function (ev) {
            var target = ev.target;

            target.classList.add('o_currently_dragged');

            target.setAttribute('data-originalHeight', target.style.height);
            target.setAttribute('data-originalLeft', target.style.left);
            target.setAttribute('data-originalPosition', target.style.position);
            target.setAttribute('data-originalTop', target.style.top);
            target.setAttribute('data-originalWidth', target.style.width);
            target.setAttribute('data-originalZIndex', target.style.zIndex);

            var computedStyle = window.getComputedStyle(target);
            target.style.height = computedStyle.getPropertyValue('height');
            target.style.width = computedStyle.getPropertyValue('width');

            var xPosition = target.offsetLeft;
            var yPosition = target.offsetTop;
            target.style.position = 'absolute';
            target.style.zIndex = 1000;
            target.style.left = xPosition + 'px';
            target.style.top = yPosition + 'px';

            target.setAttribute('data-x', xPosition);
            target.setAttribute('data-y', yPosition);

            if (options && options.onstart) {
                options.onstart(ev);
            }
        },
        onmove: function (ev) {
            var target = ev.target;
            var xPosition = parseFloat(target.getAttribute('data-x')) + ev.dx;
            var yPosition = parseFloat(target.getAttribute('data-y')) + ev.dy;
            target.style.left = xPosition + 'px';
            target.style.top = yPosition + 'px';
            target.setAttribute('data-x', xPosition);
            target.setAttribute('data-y', yPosition);

            if (options && options.onmove) {
                options.onmove(ev);
            }
        },
        onend: function (ev) {
            var target = ev.target;
            target.style.height = target.getAttribute('data-originalHeight');
            target.style.left = target.getAttribute('data-originalLeft');
            target.style.position = target.getAttribute('data-originalPosition');
            target.style.top = target.getAttribute('data-originalTop');
            target.style.width = target.getAttribute('data-originalWidth');
            target.style.zIndex = target.getAttribute('data-originalZIndex');
            target.classList.remove('o_currently_dragged');

            if (options && options.onend) {
                options.onend(ev);
            }
        }
    };

    if (options.restrict) {
        interactOptions.restrict = options.restrict;
    }

    return interact(el).draggable(interactOptions);
};

var _getPlaceholder = function (el) {
    return el.querySelector('.o_sortable_placeholder');
};

var _insertPlaceholder = function (node, parent, before, connectWith) {
    var placeholder = _getPlaceholder(node);
    if (!placeholder) {
        var computedStyle = window.getComputedStyle(node);
        placeholder = document.createElement(node.tagName);
        placeholder.classList.add('o_sortable_placeholder');
        placeholder.style.width = computedStyle.getPropertyValue('width');
        placeholder.style.height = computedStyle.getPropertyValue('height');
        placeholder.style.backgroundColor = 'lightgray';
    }

    if (connectWith) {
        _cleanConnectedPlaceholders(event.target, connectWith);
    }

    parent.insertBefore(placeholder, before);
};

var _cleanPlaceholder = function (el) {
    var placeholder = _getPlaceholder(el);
    if (placeholder) {
        placeholder.remove();
        placeholder = undefined;
    }
};

var _cleanConnectedPlaceholders = function (originalSortable, connectWith) {
    var connectedSortables = document.querySelectorAll(connectWith)
    connectedSortables.forEach(function (currentSortable) {
        if (currentSortable !== originalSortable) {
            var connectedPlaceholders = currentSortable.querySelectorAll('.o_sortable_placeholder');
            connectedPlaceholders.forEach(function (placeholder) {
                placeholder.remove();
            });
        }
    });
};

var _sortable = function (el, options) {
    var itemsSelector = options.items;
    // TODO: comment why I have useless parameters
    var _connectedChecker = function (dragEvent, event, dropped, dropzone, dropElement, draggable, draggableElement) {
        var isFromThisSortable = el.contains(draggableElement);
        var isFromConnectedSortable = options && options.connectWith && draggableElement.closest(options.connectWith);
        return dropped && (isFromThisSortable || isFromConnectedSortable);
    }
    var interactable = interact(el).dropzone({
        accept: itemsSelector,
        checker: _connectedChecker,
        ondropactivate: function (ev) {
            var draggable = ev.relatedTarget;
            var droppable = ev.target;
            if (droppable.contains(draggable)) {
                _insertPlaceholder(draggable, droppable, draggable.nextSibling, options.connectWith);
            }
            if (!el.getAttribute('data-sortable-activated')) {
                el.setAttribute('data-sortable-activated', true);
                el.querySelectorAll(itemsSelector).forEach(function (element) {
                    if (!element.classList.contains('o_sortable_placeholder')) {
                        interact(element).dropzone({
                            accept: itemsSelector,
                            checker: _connectedChecker,
                            ondragenter: function (ev) {
                                var beforeTarget = ev.dragEvent.dy > 0 ? ev.target.nextSibling : ev.target;
                                var parentTarget = beforeTarget ? beforeTarget.parentNode : ev.target.parentNode;
                                _insertPlaceholder(ev.target, parentTarget, beforeTarget, options.connectWith);
                            },
                        });
                    }
                })
            }

            if (options.ondropactivate) {
                options.ondropactivate(ev);
            }
        },
        ondragenter: function (ev) {
            if (!_getPlaceholder(el)) {
                _insertPlaceholder(ev.relatedTarget, ev.target, null, options.connectWith);
            }

            if (options.ondragenter) {
                options.ondragenter(ev);
            }
        },
        ondrop: function (ev) {
            var placeholder = _getPlaceholder(ev.target);
            placeholder.parentNode.insertBefore(ev.relatedTarget, placeholder);
            _cleanPlaceholder(el);

            if (options.ondrop) {
                options.ondrop(ev);
            }
        },
        ondragleave: function (ev) {
            _cleanPlaceholder(el);

            if (options.ondragleave) {
                options.ondragleave(ev);
            }
        },
        ondropdeactivate: function (ev) {
            _cleanPlaceholder(el);

            if (options.ondropdeactivate) {
                options.ondropdeactivate(ev);
            }
        }
    })
    interact.dynamicDrop(true);
    el.addEventListener('pointerdown', function (ev) {
        var itemClicked = ev.target.closest(itemsSelector);
        if (itemClicked && !itemClicked.classList.contains('o_sortable_handle')) {
            itemClicked.classList.add('o_sortable_handle');
            var itemsOptions = {};
            if (options.containment) {
                itemsOptions.restrict = {
                    restriction: options.containment,
                    elementRect: { left: 0, right: 1, top: 0, bottom: 1 }
                };
            }
            _draggable(itemClicked, itemsOptions);
        }
    });
    return interactable;
};

return {
    draggable: _draggable,
    sortable: _sortable,
};

});
