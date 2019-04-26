odoo.define('web.interact', function (require) {
"use strict";

var placeholderClass = 'o_sortable_placeholder';

/**
 * Make an element draggable.
 * For more details on the parameters, see the doc of interactjs.
 *
 * @param {DOMElement} el
 * @param {Object} [options]
 * @param {Function} [options.onstart] function called when dragging starts
 * @param {Function} [options.onmove] function called when dragging moves
 * @param {Function} [options.onend] function called when dragging ends
 * @param {Object} [options.restrict] dragging area restriction data
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

/**
 * Returns the placeholder from a given sortable or null if none can be found.
 *
 * @param {DOMElement} sortable
 * @returns {DOMElement|null}
 */
var _getPlaceholder = function (sortable) {
    return sortable.querySelector('.' + placeholderClass);
};

var _setPlaceholder = function (sortable, node, parent, before, connectWith) {
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
        var sortables = document.querySelectorAll(connectWith)
        sortables.forEach(function (currentSortable) {
            _cleanPlaceholder(currentSortable);
        });
    } else {
        _cleanPlaceholder(sortable);
    }

    parent.insertBefore(placeholder, before);
};

/**
 * Clean the placeholder from a given sortable.
 *
 * @param {DOMElement} sortable
 */
var _cleanPlaceholder = function (sortable) {
    var placeholder = _getPlaceholder(sortable);
    if (placeholder) {
        placeholder.remove();
        placeholder = undefined;
    }
};

/**
 * Make an element sortable.
 * For more details on the parameters, see the doc of interactjs.
 *
 * @param {DOMElement} el
 * @param {Object} [options]
 * @param {string} [options.itemsSelector] selector identifying acceptable items
 * @param {Function} [options.ondropactivate] function called when an accepted item starts dragging
 * @param {Function} [options.ondragenter] function called when a dragging accepted item enters el
 * @param {Function} [options.ondrop] function called when a dragging accepted item is dropped in
 * @param {Function} [options.ondragleave] function called when a dragging accepted item leaves el
 * @param {Function} [options.ondropdectivate] function called when an accepted item stops dragging
 * @param {string} [options.containment] selector identifying the draggable items restriction area
 * @param {string} [options.connectWith] selector identifying other sortables connected to this one
 * @returns {Interactable}
 */
var _sortable = function (el, options) {
    var connectWith = options && options.connectWith;
    var itemsSelector = options && options.items;

    // Checks whether an element is a valid item for this sortable. It needs to
    // either be a children of this sortable or a children of a connected one.
    // Note: We only need a few of the arguments of interactjs checker function.
    var _connectedChecker = function (dragEvent, event, dropped, dropzone, dropElement, draggable, draggableElement) {
        var isFromThisSortable = el.contains(draggableElement);
        var isFromConnectedSortable = connectWith && draggableElement.closest(connectWith);
        return dropped && (isFromThisSortable || isFromConnectedSortable);
    }

    // When dragging starts, we need to create a first placeholder and make all
    // items in this sortable droppable so they can react to the dragged item.
    var ondropactivate = function (ev) {
        // Create the very first placeholder in place of the draggable item
        var draggable = ev.relatedTarget;
        var droppable = ev.target;
        if (droppable.contains(draggable)) {
            var nextSibling = draggable.nextSibling;
            if (nextSibling && nextSibling.classList.contains(placeholderClass)) {
                nextSibling = nextSibling.nextSibling;
            }
            _setPlaceholder(el, draggable, droppable, nextSibling, connectWith);
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
                            if (beforeTarget && beforeTarget.classList.contains(placeholderClass)) {
                                beforeTarget = beforeTarget.nextSibling;
                            }
                            var parentTarget = beforeTarget ? beforeTarget.parentNode : ev.target.parentNode;
                            _setPlaceholder(el, ev.target, parentTarget, beforeTarget, connectWith);
                        },
                    });
                }
            })
        }

        if (options && options.ondropactivate) {
            options.ondropactivate(ev);
        }
    };

    // When a dragged item enters the sortable, we create a placeholder at the
    // end of the sortable, no matter where the dragged item is entering the
    // sortable from. This is similar to jQuery-ui behavior.
    var ondragenter = function (ev) {
        if (!_getPlaceholder(el)) {
            // We need to check for existing placeholders as hovering the
            // placeholder itselfs is considered as hovering the sortable since
            // the placeholder is not considered as an item on its own.
            _setPlaceholder(el, ev.relatedTarget, ev.target, null, connectWith);
        }

        if (options && options.ondragenter) {
            options.ondragenter(ev);
        }
    };

    // When a dragged item is dropped in this sortable, we use the placeholder
    // as an anchor for correctly placing the item then delete the placeholder.
    var ondrop = function (ev) {
        var placeholder = _getPlaceholder(ev.target);
        placeholder.parentNode.insertBefore(ev.relatedTarget, placeholder);
        _cleanPlaceholder(el);

        if (options && options.ondrop) {
            options.ondrop(ev);
        }
    };

    // When dragging stops, if there is still a placeholder at this point, this
    // means that we dropped the record outside of any droppable zone, otherwise
    // the placeholder would have been removed by ondrop. In this case, we
    // mimmick jQuery-ui behavior and drop it at the last known valid spot.
    var ondropdeactivate = function (ev) {
        if (_getPlaceholder(el)) {
            ondrop(ev);
        }

        if (options && options.ondropdeactivate) {
            options.ondropdeactivate(ev);
        }
    };

    // Make el interactjs droppable
    var interactable = interact(el).dropzone({
        accept: itemsSelector,
        checker: _connectedChecker,
        ondropactivate: ondropactivate,
        ondragenter: ondragenter,
        ondrop: ondrop,
        ondragleave: options && options.ondragleave,
        ondropdeactivate: ondropdeactivate
    });

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
