odoo.define('web_editor.wysiwyg.plugin.table', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Manager = require('web_editor.wysiwyg.plugin.manager');

var $ = require('web_editor.jquery');
var _ = require('web_editor._');

var TablePicker = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_table.xml'],
    dependencies: [],

    buttons: {
        template: 'wysiwyg.buttons.tablepicker',
        events: {
            'click': '_updatePicker',
            'mouseover row button': '_updatePicker',
        },
    },

    tableClassName: 'table table-bordered',

    _MIN_ROWS: 3,
    _MIN_COLS: 3,
    _CELL_SIZE_EM: 1,
    _ROW_MARGIN_EM: 0.45,
    _COL_MARGIN_EM: 0.24,

    init: function () {
        this._super.apply(this, arguments);
        this._MAX_ROWS = this.options.insertTableMaxSize.row;
        this._MAX_COLS = this.options.insertTableMaxSize.col;
        this._tableMatrix = this._getTableMatrix(this._MAX_ROWS, this._MAX_COLS);
        // contentEditable fail for image and font in table
        // user must use right arrow the number of space but without feedback
        var tds = this.editable.getElementsByTagName('td');
        for (var k = 0; k < tds.length; k++) {
            var td = tds[k];
            if (tds[k].querySelector('img, span.fa')) {
                if (td.firstChild && !td.firstChild.tagName) {
                    var startSpace = this.utils.getRegex('startSpace');
                    td.firstChild.textContent = td.firstChild.textContent.replace(startSpace, ' ');
                }
                if (td.lastChild && !td.lastChild.tagName) {
                    var endSpace = this.utils.getRegex('endSpace');
                    td.lastChild.textContent = td.lastChild.textContent.replace(endSpace, ' ');
                }
            }
        }
        // self.context.invoke('HistoryPlugin.clear'); TODO: put back
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Create empty table element.
     *
     * @param {Number} rowCount
     * @param {Number} colCount
     * @returns {Node} table
     */
    createTable: function (rowCount, colCount) {
        var table = document.createElement('table');
        table.className = this.tableClassName;
        var tbody = document.createElement('tbody');
        table.appendChild(tbody);
        for (var i = 0; i < rowCount; i++) {
            var tr = document.createElement('tr');
            tbody.appendChild(tr);
            for (var j = 0; j < colCount; j++) {
                var td = document.createElement('td');
                var p = document.createElement('p');
                var br = document.createElement('br');
                p.appendChild(br);
                td.appendChild(p);
                tr.appendChild(td);
            }
        }
        return table;
    },
    /**
     * Insert a table.
     * Note: adds <p><br></p> before/after the table if the table
     * has nothing brefore/after it, so as to allow the carret to move there.
     *
     * @param {String} dim dimension of table (ex : "5x5")
     */
    insertTable: function (dim, range) {
        var dimension = dim.split('x');
        var table = this.createTable(dimension[0], dimension[1], this.options);
        if (range.getStartPoint().isRightEdge() && !range.getStartPoint().isLeftEdge()) {
            var parentBlock = this.utils.firstBlockAncestor(range.sc);
            range.replace({
                sc: parentBlock,
                so: this.utils.nodeLength(parentBlock),
            });
        }
        this.dom.insertBlockNode(table, range);
        var p;
        if (!table.previousElementSibling) {
            p = document.createElement('p');
            p.appendChild(document.createElement('br'));
            table.parentNode.insertBefore(p, table);
        }
        if (!table.nextElementSibling) {
            p = document.createElement('p');
            p.appendChild(document.createElement('br'));
            if (p.nextSibling) {
                table.parentNode.appendChild(p);
            } else {
                table.parentNode.insertBefore(p, table.nextSibling);
            }
        }
        var range = range.replace({
            sc: table.querySelector('td'),
            so: 0,
        });
        this.dependencies.Arch.setRange(range);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Get the number of columns or rows to show in the picker in function of the
     * currently selected column/row.
     *
     * @param {String ('col' | 'row')} colOrRow
     * @returns {Number}
     */
    _cellsToShow: function (colOrRow) {
        var CELLS_LOOKAHEAD = 1;
        var current = colOrRow === 'col' ? this._col : this._row;
        var min = colOrRow === 'col' ? this._MIN_COLS : this._MIN_ROWS;
        var max = colOrRow === 'col' ? this._MAX_COLS : this._MAX_ROWS;
        var show = current + CELLS_LOOKAHEAD > max ? max : current + CELLS_LOOKAHEAD;
        return show < min ? min : show;
    },
    /**
     * Get the width of a number `n` of columns or the height of a number `n` of rows.
     *
     * @param {Number} n
     * @param {String ('col' | 'row')} colOrRow
     * @returns {Number}
     */
    _cellsSize: function (n, colOrRow) {
        var margin = colOrRow === 'col' ? this._COL_MARGIN_EM : this._ROW_MARGIN_EM;
        return (n * this._CELL_SIZE_EM) + (n * margin);
    },
    /**
     * Return a 3D array representing a table.
     * It contains `nRows` arrays of length `nCols`.
     * Each cell contains its position as 'rowxcol' (1-indexed).
     *
     * Eg.: _getRowsArray(2, 3) returns
     * [['1x1', '1x2', '1x3'],
     *  ['2x1', '2x2', '2x3']]
     *
     * @param {Number} nRows
     * @param {Number} nCols
     * @returns {Number []}
     */
    _getTableMatrix: function (nRows, nCols) {
        var emptyRowsArray = Array.apply(null, Array(nRows));
        var emptyColsArray = Array.apply(null, Array(nCols));

        return emptyRowsArray.map(function (v, i) {
            var rowIndex = i + 1;
            return emptyColsArray.map(function (w, j) {
                var colIndex = j + 1;
                return rowIndex + 'x' + colIndex;
            });
        });
    },
    /**
     * Update the picker highlighter with the current selected columns and rows.
     */
    _highlightPicker: function (group) {
        var self = this;
        var buttons = group.querySelectorAll('.wysiwyg-dimension-picker-mousecatcher button');

        buttons.forEach(function (button) {
            button.classList.remove('wysiwyg-tablepicker-highlighted');

            var data = button.getAttribute('data-value');
            if (!data) {
                return;
            }
            var value = data.split('x');
            var row = parseInt(value[0]);
            var col = parseInt(value[1]);
            if (self._row >= row && self._col >= col) {
                button.classList.add('wysiwyg-tablepicker-highlighted');
            }
        });
    },
    /**
     * Resize the picker to show up to the current selected columns and rows + `CELLS_LOOKAHEAD`,
     * unless that sum goes beyond the binds of `this._[MIN|MAX]_[COLS|ROWS]`.
     */
    _resizePicker: function (group) {
        var picker = group.querySelector('.wysiwyg-dimension-picker');
        var width = this._cellsSize(this._cellsToShow('col'), 'col');
        var height = this._cellsSize(this._cellsToShow('row'), 'row');
        picker.style.width = width + 'em';
        picker.style.height = height + 'em';
    },
    /**
     * Update the dimensions display of the picker with the currently selected row and column.
     */
    _updateDimensionsDisplay: function (group) {
        var display = group.querySelector('.wysiwyg-dimension-display');
        display.innerText = this._row + ' x ' + this._col;
    },
    /**
     * Update the picker and selected rows and columns.
     *
     * @param {MouseEvent} ev 
     */
    _updatePicker: function (ev) {
        if (!ev.target || ev.target.tagName !== "BUTTON" || ev.target.parentNode.tagName === 'DROPDOWN') {
            this._row = this._col = 1;
        } else {
            var values = ev.target.getAttribute('data-value').split('x');
            this._row = parseInt(values[0]);
            this._col = parseInt(values[1]);
        }
        for (var k = 0; k < this.buttons.elements.length; k++) {
            var group = this.buttons.elements[k];
            if (group === ev.target || group.contains(ev.target)) {
                break;
            }
        }
        this._resizePicker(ev.currentTarget);
        this._highlightPicker(ev.currentTarget);
        this._updateDimensionsDisplay(ev.currentTarget);
    },
});

var Table = AbstractPlugin.extend({
    templatesDependencies: ['/web_editor/static/src/xml/wysiwyg_table.xml'],
    dependencies: [],

    buttons: {
        template: 'wysiwyg.popover.table',
    },

    init: function () {
        this._super.apply(this, arguments);
    },
    get: function (range) {
        var target = range.sc[range.so] || range.sc;
        var td = this.utils.ancestor(this.utils.firstLeaf(target), this.utils.isCell);
        return td && range.replace({sc: td, so: 0});
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Add a new col.
     *
     * @param {String('left'|'right')} position
     * @param {Node} cell
     */
    addCol: function (position, range) {
        var self = this;
        var cell = range.sc;
        var cells = this._currentCol(cell);
        cells.forEach(function (cell) {
            var td = self._createCell();
            if (position === 'left') {
                cell.parentNode.insertBefore(td, cell);
            } else {
                cell.parentNode.insertBefore(td, cell.nextSibling);
            }
        });
    },
    /**
     * Add a new row.
     *
     * @param {String('above'|'below')} position
     * @param {Node} cell
     */
    addRow: function (position, range) {
        var cell = range.sc;
        var parentRow = this._currentRow(cell);
        var nCols = parentRow.querySelectorAll('td').length;
        var tr = document.createElement('tr');
        for (var i = 0; i < nCols; i++) {
            tr.append(this._createCell());
        }
        if (position === 'above') {
            parentRow.parentNode.insertBefore(tr, parentRow);
        } else if (parentRow.nextSibling) {
            parentRow.parentNode.insertBefore(tr, parentRow.nextSibling);
        } else {
            parentRow.parentNode.appendChild(tr);
        }
    },
    /**
     * Delete the current column.
     *
     * @param {null} value
     * @param {Node} cell
     */
    deleteCol: function (value, range) {
        var self = this;
        var cell = range.sc;
        // Delete the last remaining column === delete the table
        if (!cell.previousElementSibling && !cell.nextElementSibling) {
            return this.deleteTable(null, cell);
        }
        var cells = this._currentCol(cell);
        var point;
        cells.forEach(function (node) {
            point = self.dom.removeBlockNode(node);
        });

        if (point && point.node) {
            range = range.replace({
                sc: this.utils.firstLeaf(point.node),
                so: 0,
            });
            this.dependencies.Arch.setRange(range);
        }
    },
    /**
     * Delete the current row.
     *
     * @param {null} value
     * @param {Node} cell
     */
    deleteRow: function (value, range) {
        // Delete the last remaining row === delete the table
        var cell = range.sc;
        var row = this._currentRow(cell);
        if (!row) {
            return;
        }
        if (!row.previousElementSibling && !row.nextElementSibling) {
            return this.deleteTable(null, cell);
        }
        var point = this.dom.removeBlockNode(row);
        
        // Put the range back on the previous or next row after deleting
        // to allow chain-removing
        if (point && point.node) {
            range = range.replace({
                sc: this.utils.firstLeaf(point.node),
                so: 0,
            });
            this.dependencies.Arch.setRange(range);
        }
    },
    /**
     * Delete the current table.
     *
     * @param {null} value
     * @param {Node} cell
     */
    deleteTable: function (value, range) {
        var cell = range.sc;
        var point = this.dom.removeBlockNode(this._currentTable(cell));
        if (this.dependencies.Arch.isEditableNode(point.node) && !this.utils.isText(point.node)) {
            point.replace(this.utils.firstLeaf(point.node), 0);
        }
        range = range.replace({
            sc: point.node,
            so: point.offset,
        });
        this.dependencies.Arch.setRange(range);
    },
    next: function (value, range) {
        var cell = this.utils.ancestor(range.ec, this.utils.isCell);
        var nextCell = cell.nextElementSibling;
        if (!nextCell) {
            var row = this.utils.ancestor(range.ec, function (node) {
                return node.tagName === 'TR';
            });
            var nextRow = row.nextElementSibling;
            if (!nextRow) {
                return;
            }
            nextCell = nextRow.firstElementChild;
        }
        return nextCell;
    },
    prev: function (value, range) {
        var cell = this.utils.ancestor(range.sc, this.utils.isCell);
        var nextCell = cell.previousElementSibling;
        if (!nextCell) {
            var row = this.utils.ancestor(range.sc, function (node) {
                return node.tagName === 'TR';
            });
            var nextRow = row.previousElementSibling;
            if (!nextRow) {
                return;
            }
            nextCell = nextRow.lastElementChild;
        }
        return nextCell;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _createCell: function () {
        var td = document.createElement('td');
        var p = document.createElement('p');
        p.appendChild(document.createElement('br'));
        td.appendChild(p);
        return td;
    },
    /**
     * Get the current column (as an array of cells).
     *
     * @param {Node} cell
     * @returns {Node []}
     */
    _currentCol: function (cell) {
        var colIndex = [].indexOf.call(cell.parentNode.children, cell);
        var rows = this._currentTable(cell).querySelectorAll('tr');
        var cells = [];
        rows.forEach(function (row) {
            cells.push(row.children[colIndex]);
        });
        return cells;
    },
    /**
     * Get the current row.
     *
     * @param {Node} cell
     * @returns {Node}
     */
    _currentRow: function (cell) {
        return this.utils.ancestor(this.utils.firstLeaf(cell), function (node) {
            return node.tagName === 'TR';
        });
    },
    /**
     * Get the current table.
     *
     * @param {Node} cell
     * @returns {Node}
     */
    _currentTable: function (cell) {
        return this.utils.ancestor(cell, function (n) {
            return n.tagName === 'TABLE';
        });
    },
});


Manager.addPlugin('TablePicker', TablePicker);
Manager.addPlugin('Table', Table);

return {
    TablePickerPlugin: TablePicker,
    TablePlugin: Table,
};

});
