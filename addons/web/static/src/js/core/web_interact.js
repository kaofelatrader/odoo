odoo.define('web.interact', function (require) {
"use strict";

var placeholderClass = 'o_sortable_placeholder';

/**
 * Store current values of CSS properties that will change while dragging
 *
 * @param {DOMElement} el
*/
var _storeDraggableProperties = function(el) {
    el.dataset.draggableOriginalHeight = el.style.height;
    el.dataset.draggableOriginalLeft = el.style.left;
    el.dataset.draggableOriginalPosition = el.style.position;
    el.dataset.draggableOriginalTop = el.style.top;
    el.dataset.draggableOriginalWidth = el.style.width;
    el.dataset.draggableOriginalZIndex = el.style.zIndex;
};

/**
 * Reset CSS properties to what they were before dragging
 *
 * @param {DOMElement} el
 * @param {integer} [delay] in ms for the reset animation
*/
var _resetDraggableProperties = function (el, delay) {
    if (delay && false) {
        // TODO: revert option animation
    } else {
        el.style.height = el.dataset.draggableOriginalHeight;
        el.style.left = el.dataset.draggableOriginalLeft;
        el.style.position = el.dataset.draggableOriginalPosition;
        el.style.top = el.dataset.draggableOriginalTop;
        el.style.width = el.dataset.draggableOriginalWidth;
        el.style.zIndex = el.dataset.draggableOriginalZIndex;
    }
}

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
    var options = options || {};
    var interactOptions = {
        // On drag start, we prepare the element to be dragged around.
        onstart: function (ev) {
            var target = ev.target;
            target.classList.add('o_currently_dragged');
            _storeDraggableProperties(target);

            // Freeze the dimensions of the element as it appears now, since
            // it may have a size that is dependent on his parent, in which
            // case absolute positioning would result in different dimensions.
            var computedStyle = window.getComputedStyle(target);
            target.style.height = computedStyle.height;
            target.style.width = computedStyle.width;

            // Absolute positioning in itself
            // We use the same zIndex as jQuery-ui sortable
            var xPosition = target.offsetLeft;
            var yPosition = target.offsetTop;
            target.style.position = 'absolute';
            target.style.zIndex = 1000;
            target.style.left = xPosition + 'px';
            target.style.top = yPosition + 'px';

            // Store current left and top positions for later update
            target.dataset.draggableX = xPosition;
            target.dataset.draggableY = yPosition;

            if (options.onstart) {
                options.onstart(ev);
            }
        },

        // On drag move, we update the element position with the move delta
        onmove: function (ev) {
            var target = ev.target;
            // Unfortunately, target.style.left/top returns the values including
            // units (e.g. "100px") which makes it complicated to use in
            // computations. Hence our choice to store these properly.
            var xPosition = parseFloat(target.dataset.draggableX) + ev.dx;
            var yPosition = parseFloat(target.dataset.draggableY) + ev.dy;
            target.style.left = xPosition + 'px';
            target.style.top = yPosition + 'px';
            target.dataset.draggableX = xPosition;
            target.dataset.draggableY = yPosition;

            if (options.onmove) {
                options.onmove(ev);
            }
        },

        // On drag end, we remove the currently dragged class.
        // We don't reset the properties of the element as this would result in
        // the same state as before dragging. These properties can be accessed
        // by the user in its own onend function if needed.
        onend: function (ev) {
            ev.target.classList.remove('o_currently_dragged');

            if (options.onend) {
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

/**
 * Set a placeholder for a given item before a given anchor in a given sortable.
 * This function also removes previously existing placeholders if any.
 *
 * @param {DOMElement} sortable
 * @param {DOMElement} item
 * @param {DOMElement} anchor
 * @param {string} axis
 * @param {string} connectWith
 * @returns {DOMElement|null}
 */
var _setPlaceholder = function (sortable, item, anchor, axis, connectWith) {
    // Only update the placeholder if it would move it somewhere else
    if (!anchor || !anchor.classList.contains(placeholderClass)) {
        var placeholder = _getPlaceholder(item);
        if (!placeholder) {
            // Generate a brand new placeholder
            var computedStyle = window.getComputedStyle(item);
            placeholder = document.createElement(item.tagName);
            placeholder.classList.add(placeholderClass);

            // Placeholder must have content to have a size in some CSS situations
            var placeholderContent = document.createElement('div');
            if (axis === 'x') {
                placeholderContent.style.width = computedStyle.width;
            } else if (axis === 'y') {
                placeholderContent.style.height = computedStyle.height;
            } else if (axis === 'both') {
                placeholderContent.style.width = computedStyle.width;
                placeholderContent.style.height = computedStyle.height;
                placeholderContent.style.backgroundColor = 'lightgray';
            }
            placeholder.appendChild(placeholderContent);
        }

        // Clean previous placeholders
        if (connectWith) {
            var sortables = document.querySelectorAll(connectWith)
            sortables.forEach(function (currentSortable) {
                _cleanPlaceholder(currentSortable);
            });
        } else {
            _cleanPlaceholder(sortable);
        }

        // Placeholder insertion per se
        var parent = anchor ? anchor.parentNode: sortable;
        parent.insertBefore(placeholder, anchor);
    }
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
    }
};

/**
 * Make an element sortable.
 * For more details on the parameters, see the doc of interactjs.
 *
 * @param {DOMElement} el
 * @param {Object} [options]
 * @param {string} [options.itemsSelector] selector identifying acceptable items
 * @param {Function} [options.ondropactivate] called on drag start of valid item
 * @param {Function} [options.ondragenter] called on drag enter of valid item
 * @param {Function} [options.onsort] called on sorting items while dragging
 * @param {Function} [options.ondrop] called on drop of valid item
 * @param {Function} [options.ondragleave] called on drag leave of valid item
 * @param {Function} [options.ondropdectivate] called on drag stop of valid item
 * @param {string} [options.axis] sortable axis (default: 'y')
 * @param {string} [options.containment] selector for restricted items drag area
 * @param {string} [options.connectWith] selector for other connected sortables
 * @param {string} [options.handle] restrict dragging to this selector
 * @param {string} [options.tolerance] overlaps are computed with respect to the
 *        element being dragged. Set this parameter to 'pointer' to compute the
 *        overlaps relative to the pointer itself rather than the element.
 * @returns {Interactable}
 */
var _sortable = function (el, options) {
    var options = options || {};
    var axis = options.axis || 'y';
    var handle = options.handle;
    var connectWith = options.connectWith;
    var containment = options.containment;
    var itemsSelector = options.items;
    var tolerance = options.tolerance;

    /**
     * Checks whether an element is a valid item for this droppable. It needs to
     * either be a children of this sortable (already computed by the drop
     * argument of interactjs checker function) or, if we are in connectWith
     * mode, be a children of a connected sortable.
     * Note: We only need a few of the arguments of interactjs checker function.
     *
     * @param {InteractEvent} dragEv related dragmove or dragend event
     * @param {Event} ev the original event related to the dragEvent
     * @param {boolean} drop value from interactjs default drop checker
     * @param {Interactable} dropObj interactjs object of droppable element
     * @param {DOMElement} dropEl droppable element
     * @param {Interactable} dragObj interactjs object of draggable element
     * @param {DOMElement} dragEl draggable element
     * @returns {boolean} whether the draggable item is valid for this droppable
     *
     */
    var check = function (dragEv, ev, drop, dropObj, dropEl, dragObj, dragEl) {
        var tolerated = true;
        if (tolerance === 'pointer') {
            // Interactjs does not implement tolerance pointer from jQuery-ui.
            // We want to check if the pointer is inside the droppable.
            var dropElRight = dropEl.offsetLeft + dropEl.offsetWidth;
            var dropElBottom = dropEl.offsetTop + dropEl.offsetHeight;
            tolerated = dropEl.offsetLeft < ev.clientX < dropElRight &&
                dropEl.offsetTop < ev.clientY < dropElBottom;
        }
        var fromThisSortable = el.contains(dragEl);
        var fromConnectedSortable = connectWith && dragEl.closest(connectWith);
        var isValidItem = fromThisSortable || fromConnectedSortable;
        return drop && tolerated && isValidItem;
    }

    // When dragging starts, we need to create a first placeholder and make all
    // items in this sortable droppable so they can react to the dragged item.
    var ondropactivate = function (ev) {
        // Create the very first placeholder in the spot of the draggable item
        var sortable = ev.target;
        var draggable = ev.relatedTarget;
        var anchor = draggable.nextSibling;
        if (sortable.contains(draggable)) {
            _setPlaceholder(sortable, draggable, anchor, axis, connectWith);
        }

        // Set droppable on all items in this sortable
        if (itemsSelector && !el.dataset.sortableItemsActivated) {
            el.dataset.sortableItemsActivated = true;
            // It is very important that we call interact on the itemsSelector
            // directly rather than each of the nodes matching this selector
            // separately. Calling interact with a selector matching a single
            // node or calling it with the node itself would yield two different
            // interactable objects. This is absolutely critical to the way we
            // are using sortable in Odoo as each kanban column is, at the same
            // time, a sortable for records AND one of the items of the sortable
            // view itself, since columns themselves are sortable. In other
            // words, columns need to be a dropzone because we can drop records
            // in it, but it also needs to be a dropzone to react to other
            // columns being dragged over it. However, that you can't setup two
            // different dropzones on the same interactable object, so we set
            // the dropzone of the sortable parent on the node itself while we
            // set the dropzones of the items on the selector.
            var itemsInteractable = interact(itemsSelector).dropzone({
                accept: itemsSelector,
                checker: check,
                overlap: tolerance || 'center',
                ondropactivate: options.onitemdropactivate,
                ondropmove: function (ev) {
                    var dropEl = ev.target;
                    var dragEl = ev.relatedTarget;

                    var shouldMakeWay = true;
                    // We trust interactjs for overlap pointer and center, but
                    // for the case of items, we want to make way only if the
                    // center of the dragged element has crossed the center of
                    // of the dropzone element, while interactjs center only
                    // tests if the center of the dragged element is currently
                    // inside the dropzone area, which is not enough for this.
                    if (axis === 'y' && tolerance !== 'pointer') {
                        var dropY = dropEl.offsetTop + dropEl.offsetHeight / 2;
                        var dragY = dragEl.offsetTop + dragEl.offsetHeight / 2;
                        shouldMakeWay = ev.dragEvent.dy > 0 === dragY > dropY;
                    } else if (axis === 'x' && tolerance !== 'pointer') {
                        var dropX = dropEl.offsetLeft + dropEl.offsetWidth / 2;
                        var dragX = dragEl.offsetLeft + dragEl.offsetWidth / 2;
                        shouldMakeWay = ev.dragEvent.dx > 0 === dragX > dropX;
                    }

                    if (shouldMakeWay) {
                        var anchor = ev.target;
                        if (axis === 'y' && ev.dragEvent.dy > 0) {
                            // If dragging downward in y axis mode, then anchor
                            // after this item, so before the next item.
                            anchor = anchor.nextSibling;
                        } else if (axis === 'x' && ev.dragEvent.dx > 0) {
                            // If dragging rightward in x axis mode, then anchor
                            // after this item, so before the next item.
                            anchor = anchor.nextSibling;
                        } else if (axis === 'both') {
                            // TODO: look for dx and dy for direction
                            anchor = anchor.nextSibling;
                        }

                        _setPlaceholder(el, dragEl, anchor, axis, connectWith);

                        if (options.onsort) {
                            options.onsort(ev);
                        }
                    }
                },
                ondropdeactivate: options.onitemdropdeactivate,
            });
            // When we enter here for the first time, ondropactivate
            // has already been fired, but it was not fired on the
            // children since they were not droppable yet, so we
            // need to fire it manually.
            el.querySelectorAll(itemsSelector).forEach(function (item) {
                if (item !== draggable) {
                    var ondropactivateEvent = Object.assign({}, ev);
                    ondropactivateEvent.dropzone = itemsInteractable;
                    ondropactivateEvent.target = item;
                    itemsInteractable.fire(ondropactivateEvent);
                }
            });
        }

        if (options.ondropactivate) {
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
            _setPlaceholder(el, ev.relatedTarget, null, axis, connectWith);
        }

        if (options.ondragenter) {
            options.ondragenter(ev);
        }
    };

    // When a dragged item is dropped in this sortable, we use the placeholder
    // as an anchor for correctly placing the item then delete the placeholder.
    var ondrop = function (ev) {
        var placeholder = _getPlaceholder(ev.target);
        placeholder.parentNode.insertBefore(ev.relatedTarget, placeholder);
        _cleanPlaceholder(el);

        if (options.ondrop) {
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

        if (options.ondropdeactivate) {
            options.ondropdeactivate(ev);
        }
    };

    // Make el interactjs droppable
    var interactable = interact(el).dropzone({
        accept: itemsSelector,
        checker: check,
        overlap: tolerance || 'center',
        ondropactivate: ondropactivate,
        ondragenter: ondragenter,
        ondrop: ondrop,
        ondragleave: options.ondragleave,
        ondropdeactivate: ondropdeactivate
    });

    // Enable recomputation of distances while dragging
    interact.dynamicDrop(true);

    // Set draggable on items on first pointerdown
    el.addEventListener('pointerdown', function (ev) {
        var item;
        // Only allow to drag from the handle if it is defined
        // Any part of any item is valid for dragging otherwise
        if (!handle || ev.target.closest(handle)) {
            item = ev.target.closest(itemsSelector);
        }
        if (item && !item.classList.contains('o_sortable_handle')) {
            var itemsDraggableOptions = {
                onend: function(ev) {
                    // Sortable items reset their CSS style if they are dropped.
                    // Their position in the DOM will be updated by the handlers
                    // of the droppable so we can undo absolute positioning etc.
                    _resetDraggableProperties(ev.target, options.revert);
                }
            };
            if (handle) {
                itemsDraggableOptions.allowFrom = handle;
            }
            if (containment) {
                // Restrict the items to stay in the designated area
                itemsDraggableOptions.restrict = {
                    restriction: containment,
                    elementRect: { left: 0, right: 1, top: 0, bottom: 1 }
                };
            }
            _draggable(item, itemsDraggableOptions);
            item.classList.add('o_sortable_handle');
        }
    });

    el.classList.add('o_sortable');
    return interactable;
};

/**
 * Check whether an element has interactions bound to it
 *
 * @param {DOMElement} el
 * @returns {boolean} true if any interact listeners bound to it false otherwise
 */
var _isSet = function (el) {
    return interact.isSet(el);
};

/**
 * Unbind the interactions bound to an element by interactjs
 *
 * @param {DOMElement} el
 */
var _unset = function (el) {
    var interactable = interact(el);
    if (interactable.options.drop.enabled) {
        // Unset draggable items of sortable
        var itemsSelector = interactable.options.drop.accept;
        if (itemsSelector && el.dataset.sortableItemsActivated) {
            delete el.dataset.sortableItemsActivated;
            interact(itemsSelector).unset();
        }
    }
    interactable.unset();
};

return {
    draggable: _draggable,
    sortable: _sortable,
    isSet: _isSet,
    unset: _unset,
};

});
