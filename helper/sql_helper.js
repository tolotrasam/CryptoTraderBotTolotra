/**
 * Created by Tolotra Samuel on 01/01/2018.
 */

var fs = require('fs')
var sqlite3 = require('sqlite3').verbose();


var db;
var filename = 'from_1480550400to_1514660413_1mquote'
var filename = 'from_1480550400to_1514053361_15mquote'
var filename = 'from_1480550400to_1514053361_5mquote'
var bitfinex_raw ;
var step_size_is_seconds;
var range = '5m';
var dateFormat = require('dateformat');


function createDb(path, tableName, cb) {
    console.log("createDb");
    var db = new sqlite3.Database(path, function () {
        console.log("createDb chain");
        createTable(db, tableName, function () {
            cb(db)
        })
    });
    // db = new sqlite3.Database('chain.sqlite3', createTable);
}


function create_dir(dir, cb) {
    if (!fs.existsSync(dir)) {
        fs.mkdir(dir, function (err) {
            cb()
            console.log('Dir created')
        });
    } else {
        cb()
    }
}
function save_quote(array_scrapped_big_data, range) {

    if (!range) {
        range = ""
    }
    var dir = 'quote/bitfinex/';
    create_dir(dir, function (err) {
        if (err) {
            console.log('failed to create directory', err);
        } else {
            console.log('Directory created')
            var fullfilename = dir + filename + "_cleaned.json"
            fs.writeFile(fullfilename, JSON.stringify(array_scrapped_big_data, null, 2));
            console.log('Quote saved! to', fullfilename)
        }
    })
}

function createTable(db, tableName, cb) {
    console.log("createTable lorem" + tableName);
    var table1 = "CREATE TABLE " + tableName + " (         `id`	INTEGER PRIMARY KEY AUTOINCREMENT,         `start`	INTEGER UNIQUE,         `open`	REAL NOT NULL,         `high`	REAL NOT NULL,         `low`	REAL NOT NULL,         `close`	REAL NOT NULL,         `vwp`	REAL NOT NULL,         `volume`	REAL NOT NULL,         `trades`	INTEGER NOT NULL );"

    db.run(table1, function () {
        cb(db)
    });
}
function createTable2() {
    console.log("createTable lorem");

    var table1 = "CREATE TABLE sqlite_sequence(name,seq)"

    db.run(table1, insertRows);
}


function saveasJsonFile(array_chunk) {
    for (var n = 0; n < array_chunk.length; n++) {
        array_chunk[n][0] = array_chunk[n][0] * 1000
        // console.log( array_chunk[n][0])
    }
    save_quote(array_chunk)
}
function insertRows() {
    console.log("insertRows ");

    var array_chunk = []
    for (var i = 0; i < bitfinex_raw.length; i++) {
        // console.log(+i);

        bitfinex_raw[i][0] = bitfinex_raw[i][0] / 1000
        bitfinex_raw[i].push(bitfinex_raw[i][2])
        bitfinex_raw[i].push(5)


        if (bitfinex_raw[i - 1] && bitfinex_raw[i][0] !== bitfinex_raw[i - 1][0]) { //this means there is no duplicate
            var time_diff = bitfinex_raw[i][0] - bitfinex_raw[i - 1][0]

            if (time_diff !== step_size_is_seconds) { //this means there are missing data
                var rows_to_fill = time_diff / step_size_is_seconds - 1
                // console.log(rows_to_fill)
                console.log(rows_to_fill + ' Missing rows  between ' + bitfinex_raw[i - 1][0], bitfinex_raw[i][0])
                for (var n = 0; n < rows_to_fill; n++) {
                    var new_raw = JSON.parse(JSON.stringify(bitfinex_raw[i]))
                    new_raw[0] = bitfinex_raw[i - 1][0] + step_size_is_seconds * (n + 1) //edit the timestamp
                    array_chunk.push(new_raw)
                    console.log('Missing row added at ' + i, new_raw[0])
                }
            } else {

            }
            array_chunk.push(bitfinex_raw[i])
        } else {
            console.log('Duplicate at ' + i, bitfinex_raw[i][0])
        }

        if (i && i % 10000 === 0) {

        }
    }

    //return
    saveSqlLiteDB(array_chunk)
    // saveasJsonFile(array_chunk)


}
function createJSONToDb(bitfinexFormatCleanArray, path, asset, currency, exchange, cb) {
    console.log(path)
    var tableName = "candles_" + currency + "_" + asset
    createDb(path, tableName, function (db) {
        insertJSONintoDB(db, tableName, bitfinexFormatCleanArray, cb)
    })
}

function insertJSONintoDB(db, tableName, bitfinexFormatCleanArray, cb) {
    var placeholders = bitfinexFormatCleanArray.map((language) => "(" + language + ")").join(',');

    console.log("inserting to table " + tableName);

    var stmt = db.prepare("INSERT OR IGNORE INTO " + tableName + "( start,open,close,high,low,volume,vwp,trades) VALUES " + placeholders);
    stmt.run(bitfinexFormatCleanArray, (err) => {
        if (err) {
            console.error(err, 'DB insert error')
            return
        }
        stmt.finalize();
        closeDb(db);
        cb()

        // bitfinexFormatCleanArray = []
        //
        // var stmt2 = db.prepare("INSERT INTO sqlite_sequence( name, seq) VALUES ('candles_USD_BTC'," + bitfinex_raw.length + ")");
        //
        // stmt2.run();
        //
        // // stmt.finalize(readAllRows);
        // cb()
    });
}
function appendJSONToDb(bitfinexFormatCleanArray, path, asset, currency, exchange, cb) {
    console.log(path)
    console.log(bitfinexFormatCleanArray.length, 'Cleaned array to add')
    if (bitfinexFormatCleanArray.length === 0) {
        cb()
        return
    }

    var db = new sqlite3.Database(path, function (err) {
        if (err) {
            throw err;
        }
        var tableName = "candles_" + currency + "_" + asset

        insertJSONintoDB(db, tableName, bitfinexFormatCleanArray, cb)
    })
}

function readAllRows(path, asset, currency, candle_size, from_date, to_date, cb) {
    console.log(path, 'Preparing to read All rows')
    var db = new sqlite3.Database(path, function (err) {
        if (err) {
            throw err;
        }

        var tableName = "candles_" + currency + "_" + asset
        console.log("readAllRows " + tableName);
        db.all("SELECT * from " + tableName + " WHERE start>=" + from_date + " AND start <=" + to_date + " ORDER BY start ASC", function (err, rows) {
            // rows.forEach(function (row) {
            //     console.log(row.id + ": " + row.info);
            // });

            closeDb(db);
            cb(rows)
        });
    });
}

function closeDb(db) {
    console.log("closing Db");
    db.close();
    console.log("closed Db");
}

function runChainExample() {

    switch (range) {
        case '1m':
            step_size_is_seconds = 60;
            break;
        case '5m':
            step_size_is_seconds = 60 * 5;
            break;
        case '15m':
            step_size_is_seconds = 60 * 15;
            break;
        case '1h':
            step_size_is_seconds = 3600;
            break;
        case '3h':
            step_size_is_seconds = 3600 * 3;
            break;
    }
    createDb();
}

// runChainExample();
// getRangesLimitsFromDbPath('./quote/bitfinex/USD_BTC_5m.db','USD_BTC',function (res) {
//     console.log(res)
// })
function getRangesLimitsFromDbPath(path, pair, cb) {

    var db = new sqlite3.Database(path, function (err) {
        if (err) {
            throw err;
        }
        var sql = "SELECT max(start) as available_until, min(start) as available_since FROM candles_" + pair
        console.log(sql)
        db.all(sql, function (err, rows) {
            if (err) {
                throw err;
            }
            rows.forEach(function (row) {
                console.log(row.available_since + ": " + row.available_until);
                for (var key in row) {
                    // row[key] = dateFormat(new Date(row[key]*1000), "yyyy-mm-dd h:MM:ss");
                }
                cb(null, row)
            });
            closeDb(db);
        });
    });

}

module.exports = {
    appendJSONToDb: function (JSON, pathDB, asset, currency, exchange, cb) {
        appendJSONToDb(JSON, pathDB, asset, currency, exchange, cb)
    },
    createJSONToDb: function (JSON, pathDB, asset, currency, exchange, cb) {
        createJSONToDb(JSON, pathDB, asset, currency, exchange, cb)
    },

    getRangesLimitsFromDbPath: function (path, pair, cb) {
        getRangesLimitsFromDbPath(path, pair, cb)
    },
    readAllToJson(path, asset, currency, candle_size, from_date, to_date, cb){
        readAllRows(path, asset, currency, candle_size, from_date, to_date, cb)
    },


}