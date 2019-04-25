odoo.define('web.interact', function (require) {
"use strict";

var placeholderClass = 'o_sortable_placeholder';

/**
 * Make an element draggable.
 * TODO: better doc
 *
 * @param {DOMElement} el
 * @param {Object} [options]
 * @param {string} [options.onstart]
 *      Bla bla bla better doc
 * @returns {Interactable}
 */
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
    return el.querySelector('.' + placeholderClass);
};

var _setPlaceholder = function (node, parent, before, connectWith) {
    var placeholder = _getPlaceholder(node);
    if (!placeholder) {
        var computedStyle = window.getComputedStyle(node);
        placeholder = document.createElement(node.tagName);
        placeholder.classList.add(placeholderClass);
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

/**
 * Clean the placeholders of every sortable connected with originalSortable.
 *
 * @param {DOMElement} originalSortable element ordering the cleaning
 * @param {string} connectWith css selector identifying connected sortables
 */
var _cleanConnectedPlaceholders = function (originalSortable, connectWith) {
    var sortables = document.querySelectorAll(connectWith)
    sortables.forEach(function (currentSortable) {
        if (currentSortable !== originalSortable) {
            var placeholder = currentSortable.querySelector('.' + placeholderClass);
            if (placeholder) {
                placeholder.remove();
            }
        }
    });
};

/**
 * Make an element sortable.
 * TODO: better doc
 *
 * @returns {Interactable}
 */
var _sortable = function (el, options) {
    var connectWith = options && options.connectWith;
    var itemsSelector = options && options.items;
    // We only need a few of the arguments of interactjs checker function for now
    var _connectedChecker = function (dragEvent, event, dropped, dropzone, dropElement, draggable, draggableElement) {
        var isFromThisSortable = el.contains(draggableElement);
        var isFromConnectedSortable = connectWith && draggableElement.closest(connectWith);
        return dropped && (isFromThisSortable || isFromConnectedSortable);
    }
    var interactable = interact(el).dropzone({
        accept: itemsSelector,
        checker: _connectedChecker,
        ondropactivate: function (ev) {
            // Create the very first placeholder in place of the draggable item
            var draggable = ev.relatedTarget;
            var droppable = ev.target;
            if (droppable.contains(draggable)) {
                _setPlaceholder(draggable, droppable, draggable.nextSibling, connectWith);
            }

            // Set droppable on all items in this sortable
            if (!el.getAttribute('data-sortable-activated')) {
                el.setAttribute('data-sortable-activated', true);
                el.querySelectorAll(itemsSelector).forEach(function (element) {
                    if (!element.classList.contains(placeholderClass)) {
                        interact(element).dropzone({
                            accept: itemsSelector,
                            checker: _connectedChecker,
                            ondragenter: function (ev) {
                                var beforeTarget = ev.dragEvent.dy > 0 ? ev.target.nextSibling : ev.target;
                                var parentTarget = beforeTarget ? beforeTarget.parentNode : ev.target.parentNode;
                                _setPlaceholder(ev.target, parentTarget, beforeTarget, connectWith);
                            },
                        });
                    }
                })
            }

            if (options && options.ondropactivate) {
                options.ondropactivate(ev);
            }
        },
        ondragenter: function (ev) {
            // If there is no placeholder yet then create one as the last item
            if (!_getPlaceholder(el)) {
                _setPlaceholder(ev.relatedTarget, ev.target, null, connectWith);
            }

            if (options && options.ondragenter) {
                options.ondragenter(ev);
            }
        },
        ondrop: function (ev) {
            // We use the placeholder as an anchor for the item then delete it
            var placeholder = _getPlaceholder(ev.target);
            placeholder.parentNode.insertBefore(ev.relatedTarget, placeholder);
            _cleanPlaceholder(el);

            if (options && options.ondrop) {
                options.ondrop(ev);
            }
        },
        ondragleave: function (ev) {
            _cleanPlaceholder(el);

            if (options && options.ondragleave) {
                options.ondragleave(ev);
            }
        },
        ondropdeactivate: function (ev) {
            _cleanPlaceholder(el);

            if (options && options.ondropdeactivate) {
                options.ondropdeactivate(ev);
            }
        }
    })

    // Enable recomputation of distances while dragging
    interact.dynamicDrop(true);

    // Set draggable on items on first pointerdown
    el.addEventListener('pointerdown', function (ev) {
        var item = ev.target.closest(itemsSelector);
        if (item && !item.classList.contains('o_sortable_handle')) {
            item.classList.add('o_sortable_handle');
            var itemsOptions = {};
            if (options && options.containment) {
                // Restrict the items to stay in the area of the sortable
                itemsOptions.restrict = {
                    restriction: options.containment,
                    elementRect: { left: 0, right: 1, top: 0, bottom: 1 }
                };
            }
            _draggable(item, itemsOptions);
        }
    });
    return interactable;
};

return {
    draggable: _draggable,
    sortable: _sortable,
};

});
