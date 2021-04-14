/**
 * Datasource for client-side grouping of an in-memory datasource.
 */
import utils from "../utils.js";

class GroupingDataSource {
    constructor(delegate, options) {
        utils.Evented.apply(this);

        this.delegate = delegate;
        this.options = options;

        for (var x in this.delegate) {
            if (!this[x] && (typeof this.delegate[x] === "function")) {
                this[x] = this.delegate[x].bind(this.delegate);
            }
        }

        this.passthroughFrom(delegate, "datachanged");

        delegate.on("dataloaded", this.load.bind(this));
        this.groups = [];

        utils.passthrough(this, delegate, ['commitRow', 'startEdit', 'rollbackRow', 'replace']);
    }

    load() {
        this.updateView();
    }

    getRecordCount() {
        return this.delegate.recordCount();
    }

    getRootNodes(start, end) {
        return this.view.slice(start || 0, end);
    }

    children(row, start, end) {
        switch (arguments.length) {
            case 1:
                return row.children;
            case 2:
                return row.children.slice(start);
            case 3:
                return row.children.slice(start, end);
        }
    }

    countRootNodes() {
        return this.view.length;
    }

    countChildren(row) {
        return row.recordCount;
    }

    filter(settings, predicate) {
        this.filterPredicate = predicate;
        this.updateView();
    }

    _applySorting(nodes) {
        nodes.sort(this.sortComparator);
        if (nodes.length && nodes[0].groupRow === true) {
            for (var x = 0, l = nodes.length; x < l; x++) {
                this._applySorting(nodes[x].children);
            }
        }
    }

    sort(comparator, settings) {
        var self = this;
        this.sortComparator = comparator;

        if (this.view) {
            this._applySorting(this.view);
            this.trigger('dataloaded');
        }
    }

    updateView() {
        var ds = this;
        var groupRows = this.groupRows = {};
        var rowToGroupMap = {};
        var DISCARD_GROUP = {};

        this.parentByIdMap = {};

        function group(nodes, groupings, parentGroupId, level) {
            if (groupings && groupings.length) {
                var groupMap = {},
                    groups = [],
                    col = groupings[0],
                    groupProjection = col.groupProjection && col.groupProjection(nodes),
                    nextGroupings = groupings.slice(1);

                for (var x = 0, l = nodes.length; x < l; x++) {
                    var baseValue = utils.getValue(nodes[x], col.key);
                    var g = groupProjection ? groupProjection(baseValue) : baseValue;
                    var r = groupMap[g];

                    if (r === DISCARD_GROUP) {
                        continue;
                    }

                    if (ds.filterPredicate) {
                        var filterResult = ds.filterPredicate(nodes[x]);
                        if (filterResult < 0) {
                            if (r) {
                                groups.splice(groups.indexOf(r), 1);
                            }
                            groupMap[g] = DISCARD_GROUP;
                            continue;
                        } else if (filterResult == 0) {
                            continue;
                        }
                    }

                    if (!r) {
                        groups.push(groupMap[g] = r = {
                            groupRow: true,
                            id: parentGroupId + g + ":",
                            description: g,
                            children: [],
                            _groupColumn: col,
                            _groupLevel: level,
                            parent: level > 0 ? parentGroupId : null
                        });

                        r[col.key] = baseValue;
                    }
                    r.children.push(nodes[x]);
                    ds.parentByIdMap[nodes[x].id] = r;
                    groupRows[r.id] = r;
                }

                groups = groups.filter(function (g) {
                    return g !== DISCARD_GROUP;
                });

                for (var x = 0, l = groups.length; x < l; x++) {
                    groups[x].recordCount = ds.groupRecordCount(groups[x]);
                    groups[x].children = group(groups[x].children, nextGroupings, groups[x].id, level + 1);
                    ds.processGroup(groups[x]);
                }

                groups.sort(ds.comparator);

                return groups;
            } else {
                for (var x = 0, l = nodes.length; x < l; x++) {
                    rowToGroupMap[nodes[x].id] = parentGroupId;
                }

                if (ds.filterPredicate) {
                    nodes = nodes.filter(ds.filterPredicate);
                }

                return nodes;
            }
        }

        if (this.groups && this.groups.length) {
            this.view = group(this.delegate.getData(), this.groups, "group:", 0);
        } else {
            this.view = this.delegate.getData().filter(function (row) {
                return !ds.filterPredicate || ds.filterPredicate(row) > 0;
            });
        }

        if (this.sortComparator) {
            this._applySorting(this.view);
        }

        this.trigger("dataloaded");
    }

    groupRecordCount(group) {
        return group.children.length;
    }

    group(groupings) {
        this.groups = groupings;
        if (this.isReady()) {
            this.updateView();
        }
    }

    getRecordById(id) {
        return this.groupRows[id] || this.delegate.getRecordById(id);
    }

    recordCount() {
        this.assertReady();
        return this.view.length;
    }

    isReady() {
        return this.view !== undefined;
    }

    assertReady() {
        if (!this.isReady()) {
            throw "Datasource not ready yet";
        }
    }

    parent(row) {
        var parentRow = this.parentByIdMap[row.id];
        if (parentRow) {
            return parentRow.id;
        }
    }

    hasChildren(row) {
        var groupRow = this.groupRows[row.id];
        if (groupRow) {
            return groupRow.children && groupRow.children.length > 0;
        } else {
            return false;
        }
    }

    /**
     * Invoked after a group is created, for optional postprocessing in a subclass.
     * @param group the group that was created
     */
    processGroup(group) {

    }

    hasSubView(record) {
        if (record.groupRow) {
            return false;
        } else if (typeof this.delegate.hasSubView === 'function') {
            return this.delegate.hasSubView(record);
        }
    }

    /**
     * Returns the whole data set, ordered and filtered, but without regard for grouping.
     * @returns {*}
     */
    queryForExport() {
        var data = this.delegate.getData();
        if (this.filterPredicate) {
            data = data.filter(this.filterPredicate);
        } else {
            data = ([]).concat(data);
        }

        if (this.sortComparator) {
            data.sort(this.sortComparator);
        }

        return data;
    }
}

export default GroupingDataSource;
