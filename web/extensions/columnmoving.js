import override from "../override.js";

function storeColumnOrder(grid) {
    var result = {};
    grid.options.columns.map(function (current, index) {
        return result[current.key] = index
    });
    grid.saveSetting("columnmoving", result);
}

function loadColumnOrder(grid) {
    var keyIndexMap = grid.loadSetting("columnmoving");
    if (keyIndexMap !== undefined && keyIndexMap !== null && keyIndexMap !== "") {
        grid.options.columns.sort(function (a, b) {
            return (keyIndexMap[a.key] - keyIndexMap[b.key]);
        })
    }
}

function setColumnOrder(keyIndexMap, grid) {
    if (keyIndexMap !== undefined && keyIndexMap !== null && keyIndexMap !== "") {
        grid.options.columns.sort(function (a, b) {
            return (keyIndexMap[a.key] - keyIndexMap[b.key]);
        })
        grid.adjustColumnPositions(false);
    }
}

export default {
    loadFirst: ['filtering'],
    requires: {
        dragging: {}
    },

    init: function (grid) {
        override(grid, function ($super) {
            return {
                columnmoving: {
                    setColumnOrder: function (keyIndexMap) {
                        setColumnOrder(keyIndexMap, grid);
                    }
                },
                init: function () {
                    var start, end, idx, oidx, startconfig, wasOutOfBounds;
                    var columnMoved = false;

                    loadColumnOrder(grid);
                    $super.init();
                    grid.on("columndragstart", function (event) {
                        idx = event.idx;
                        oidx = idx;

                        if (idx < grid.options.frozenColumnsLeft) {
                            start = 0;
                            end = grid.options.frozenColumnsLeft;
                        } else if (idx > grid.options.columns.length - grid.options.frozenColumnsRight) {
                            start = grid.options.columns.length - grid.options.frozenColumnsRight;
                            end = grid.options.columns.length;
                        } else {
                            start = grid.options.frozenColumnsLeft;
                            end = grid.options.columns.length - grid.options.frozenColumnsRight;
                        }

                        startconfig = $.extend([], grid.options.columns);
                        wasOutOfBounds = false;
                        columnMoved = false;
                    }).on("columndragmove", function (event, ui) {
                        if (event.outOfViewPort) {
                            if (!wasOutOfBounds) {
                                wasOutOfBounds = true;
                                grid.options.columns = startconfig;
                                idx = oidx;
                                grid.adjustColumnPositions();
                            }
                        } else {
                            var newPos = event.x;

                            // find the new index for the column
                            for (var newIdx = start, cw = 0; newIdx < end; newIdx++) {
                                if (idx != newIdx) cw += grid.options.columns[newIdx].width;
                                if (cw > newPos) break;
                            }

                            if (newIdx > idx) newIdx--;

                            if (newIdx < start) newIdx = start;

                            if (newIdx != idx) {
                                var c = grid.options.columns.splice(idx, 1);
                                grid.options.columns.splice(newIdx, 0, c[0]);
                                grid.adjustColumnPositions(true);
                                idx = newIdx;
                                columnMoved = true;
                                storeColumnOrder(grid);
                            }
                        }
                    }).on("columndragend", function (event, ui) {
                        startconfig = null;

                        // don't call adjustColumnPositions unless the column was actually moved
                        if (columnMoved) {
                            columnMoved = false;
                            grid.adjustColumnPositions(false);
                        }
                    });
                }
            }
        });
    }
}
