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

        // On drag start, we prepare the element to be dragged around.
        onstart: function (ev) {
            var target = ev.target;
            target.classList.add('o_currently_dragged');

            // Store current values of CSS properties that are going to change
            target.dataset.draggableOriginalHeight = target.style.height;
            target.dataset.draggableOriginalLeft = target.style.left;
            target.dataset.draggableOriginalPosition = target.style.position;
            target.dataset.draggableOriginalTop = target.style.top;
            target.dataset.draggableOriginalWidth = target.style.width;
            target.dataset.draggableOriginalZIndex = target.style.zIndex;

            // Freeze the dimensions of the element as it appears now, since
            // it may have a size that is dependent on his parent, in which
            // case absolute positioning would result in different dimensions.
            var computedStyle = window.getComputedStyle(target);
            target.style.height = computedStyle.getPropertyValue('height');
            target.style.width = computedStyle.getPropertyValue('width');

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

            if (options && options.onstart) {
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

            if (options && options.onmove) {
                options.onmove(ev);
            }
        },

        // On drag stop, we reset the CSS properties to their original value
        onend: function (ev) {
            var target = ev.target;
            target.style.height = target.dataset.draggableOriginalHeight;
            target.style.left = target.dataset.draggableOriginalLeft;
            target.style.position = target.dataset.draggableOriginalPosition;
            target.style.top = target.dataset.draggableOriginalTop;
            target.style.width = target.dataset.draggableOriginalWidth;
            target.style.zIndex = target.dataset.draggableOriginalZIndex;
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

/**
 * Set a placeholder for a given item before a given anchor in a given sortable.
 * This function also removes previously existing placeholders if any.
 *
 * @param {DOMElement} sortable
 * @param {DOMElement} item
 * @param {DOMElement} anchor
 * @param {string} connectWith
 * @returns {DOMElement|null}
 */
var _setPlaceholder = function (sortable, item, anchor, connectWith) {
    var placeholder = _getPlaceholder(item);
    if (!placeholder) {
        var computedStyle = window.getComputedStyle(item);
        placeholder = document.createElement(item.tagName);
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

    if (anchor && anchor.classList.contains(placeholderClass)) {
        anchor = anchor.nextSibling;
    }

    var parent = anchor ? anchor.parentNode: sortable;
    parent.insertBefore(placeholder, anchor);
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
 * @param {Function} [options.ondropactivate] called on drag start of valid item
 * @param {Function} [options.ondragenter] called on drag enter of valid item
 * @param {Function} [options.ondrop] called on drop of valid item
 * @param {Function} [options.ondragleave] called on drag leave of valid item
 * @param {Function} [options.ondropdectivate] called on drag stop of valid item
 * @param {string} [options.containment] selector for restricted items drag area
 * @param {string} [options.connectWith] selector for other connected sortables
 * @returns {Interactable}
 */
var _sortable = function (el, options) {
    var connectWith = options && options.connectWith;
    var itemsSelector = options && options.items;

    // Checks whether an element is a valid item for this sortable. It needs to
    // either be a children of this sortable (already computed by the check
    // argument of interactjs checker function) or, if we are in connectWith
    // mode, be a children of a connected sortable.
    // Note: We only need a few of the arguments of interactjs checker function.
    var _connectedChecker = function (dragEv, ev, check, dropzone, dropEl, draggable, draggableEl) {
        return check && (!connectWith || draggableEl.closest(connectWith));
    }

    // When dragging starts, we need to create a first placeholder and make all
    // items in this sortable droppable so they can react to the dragged item.
    var ondropactivate = function (ev) {
        // Create the very first placeholder in place of the draggable item
        var droppable = ev.target;
        var draggable = ev.relatedTarget;
        var anchorNode = draggable.nextSibling;
        if (droppable.contains(draggable)) {
            _setPlaceholder(droppable, draggable, anchorNode, connectWith);
        }

        // Set droppable on all items in this sortable
        if (!el.dataset.sortableActivated) {
            el.dataset.sortableActivated = true;
            el.querySelectorAll(itemsSelector).forEach(function (element) {
                if (!element.classList.contains(placeholderClass)) {
                    interact(element).dropzone({
                        accept: itemsSelector,
                        checker: _connectedChecker,
                        ondragenter: function (ev) {
                            var anchor = ev.target;
                            if (ev.dragEvent.dy > 0) {
                                // If dragging downward, then anchor after this
                                // item, so before the next item in the list.
                                anchor = anchor.nextSibling;
                            }
                            _setPlaceholder(el, ev.target, anchor, connectWith);
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
            _setPlaceholder(el, ev.relatedTarget, null, connectWith);
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
                // Restrict the items to stay in the designated area
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
