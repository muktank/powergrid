import utils from "../utils.js";

// given an array, finds the index of the first element that is equal to or greater than the given value
function findIndex(arr, value) {
    for (var x = 0, l = arr.length; x < l; x++) {
        if (value <= arr[x]) return x;
    }
    return arr.length;
}

// in an array, increment all elements by the given increment starting at the given index
function incArray(arr, startIndex, increment) {
    for (var x = startIndex, l = arr.length; x < l; x++) {
        arr[x] += increment;
    }
}

// check if both arrays contain the same rows
function arrayEqual(a, b) {
    if (a.length != b.length) {
        return false;
    }
    for (var i = 0, l = a.length; i < l; i++) {
        if (a[i].id != b[i].id) return false;
    }
    return true;
}

class FilteringDataSource {
    constructor(delegate) {
        utils.Evented.apply(this);

        var self = this;
        this.delegate = delegate;
        this.view = null;

        delegate.on("dataloaded", function () {
            self.reload();
            self.trigger("dataloaded");
        });

        delegate.on("datachanged", function (data) {
            self.reload();
            self.trigger("datachanged", data);
        });

        delegate.on("rowsadded", function (data) {
            self._handleRowsAdded(data.start, data.end);
        });
        delegate.on("rowsremoved", function (data) {
            self._handleRowsRemoved(data.start, data.end);
        });

        if (delegate.isReady()) {
            this.reload();
        }

        utils.passthrough(this, delegate, ['sort', 'commitRow', 'startEdit', 'rollbackRow', 'replace']);
    }

    isReady() {
        return this.view != null;
    }

    reload() {
        this.delegate.assertReady();
        var data = this.delegate.getData();
        this.updateView();
    }

    recordCount() {
        this.assertReady();
        return this.view.length;
    }

    getData(start, end) {
        this.assertReady();
        if (start === undefined && end === undefined) return this.view;
        if (start === undefined) start = 0;
        if (end === undefined) end = this.recordCount();
        return this.view.slice(start, end);
    }

    setValue(rowId, key, value) {
        this.delegate.setValue(rowId, key, value);
    }

    assertReady() {
        if (!this.isReady()) throw Error("Datasource not ready yet");
    }

    buildStatistics() {
        return {
            actualRecordCount: this.delegate && this.delegate.recordCount()
        };
    }

    updateView() {
        var sourceData = this.delegate.getData();

        if (this.filter) {
            var view = new Array(sourceData.length),
                indexMap = new Array(sourceData.length),
                c = 0;
            for (var x = 0, l = sourceData.length; x < l; x++) {
                var row = sourceData[x];
                if (this.filter(row)) {
                    indexMap[c] = x;
                    view[c++] = row;
                }
            }

            this.view = view.slice(0, c);
            this.indexMap = indexMap.slice(0, c);
        } else {
            this.view = sourceData.concat([]);
            this.indexMap = null;
        }
        return this.view;
    }

    applyFilter(settings, filter) {
        var oldView = this.view;
        this.filter = filter;
        this.settings = settings;

        var newView = this.updateView();

        if (!arrayEqual(oldView, newView)) {
            utils.incrementalUpdate(this, oldView, newView);
        }
    }

    getRecordById(id) {
        return this.delegate.getRecordById(id);
    }

    _handleRowsAdded(start, end) {
        var newData = this.delegate.getData(start, end);
        if (this.filter) {
            var targetStart = findIndex(this.indexMap, start);
            var targetEnd = targetStart;
            for (var x = 0; x < end - start; x++) {
                if (this.filter(newData[x])) {
                    this.indexMap.splice(targetEnd, 0, start + x);
                    this.view.splice(targetEnd++, 0, newData[x]);
                }
            }
            incArray(this.indexMap, targetEnd, end - start);
            this.trigger('rowsadded', {start: targetStart, end: targetEnd});
        } else {
            this.view.splice.apply(this.view, [start, 0].concat(newData));
            this.trigger('rowsadded', {start: start, end: end});
        }
    }

    _handleRowsRemoved(start, end) {
        if (this.filter) {
            var targetStart = findIndex(this.indexMap, start),
                targetEnd = findIndex(this.indexMap, end);
            incArray(this.indexMap, targetStart, start - end);
            if (targetEnd > targetStart) {
                this.view.splice(targetStart, targetEnd - targetStart);
                this.indexMap.splice(targetStart, targetEnd - targetStart);
                this.trigger('rowsremoved', {start: targetStart, end: targetEnd});
            }
        } else {
            this.view.splice(start, end - start);
            this.trigger('rowsremoved', {start: start, end: end});
        }
    }
}

export default FilteringDataSource;
