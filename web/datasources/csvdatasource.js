import utils from "../utils.js";

class CSVDataSource {
    constructor(settings) {
        utils.Evented.apply(this);

        this.settings = settings;
        this.load();
        this.data = undefined;
    }

    assertReady() {
        if (!this.isReady()) {
            throw "Datasource not yet ready";
        }
    }

    isReady() {
        return this.data !== undefined;
    }

    load() {
        const self = this;
        $.ajax(this.settings.url)
            .done(function (data) {
                var lines = data.split(/[\n\r]+/);
                self.data = lines.filter(function (line) {
                    return line.length > 0;
                }).map(function (line, lineIdx) {
                    var idx = 0, record = [];
                    while (idx < line.length) {
                        if (line.charAt(idx) == '"') {
                            var end = idx;
                            while (end < line.length) {
                                end = line.indexOf('"', end + 1);
                                if (end == -1) {
                                    throw Error("Unexpected end of line");
                                }
                                if (end + 1 == line.length || line.charAt(end + 1) == ",") {
                                    record.push(line.substring(idx + 1, end));
                                    idx = end + 2;
                                    break;
                                }
                            }
                        } else {
                            var end = line.indexOf(',', idx);
                            if (end == -1) {
                                end = line.length;
                            }
                            var content = line.substring(idx, end);
                            if (content.match(/^[0-9]+\.[0-9]+$/)) {
                                content = parseFloat(content);
                            } else if (content.match(/^[0-9]*$/)) {
                                content = parseInt(content);
                            }
                            record.push(content);
                            idx = end + 1;
                        }
                    }
                    if (!('id' in record)) {
                        record['id'] = lineIdx;
                    }
                    return record;
                });
                self.trigger("dataloaded");
            });
    }

    recordCount() {
        this.assertReady();
        return this.data.length;
    }

    getData(start, end) {
        this.assertReady();
        if (!start && !end) {
            return this.data;
        } else {
            return this.data.slice(start, end);
        }
    }

    getRecordById(rowId) {
        this.assertReady();
        return this.data.filter(e => e.id == rowId)[0];
    }

    setValue(rowId, key, value) {
        this.assertReady();
        this.getRecordById(rowId)[key] = value;
    }
}

export default CSVDataSource;
