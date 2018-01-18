/**
 * Created by Tolotra Samuel on 01/01/2018.
 */

var fs = require('fs')
var sqlite3 = require('sqlite3').verbose();
var db;
var filename = 'from_1480550400to_1514660413_1mquote'
var filename = 'from_1480550400to_1514053361_15mquote'
var filename = 'from_1480550400to_1514053361_5mquote'
var bitfinex_raw = require('../quote/bitfinex/' + filename + '.json')
var step_size_is_seconds;
var range = '5m';

function createDb() {
    console.log("createDb chain");
    db = new sqlite3.Database('quote/bitfinex/' + filename + '.db', createTable);
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
            var fullfilename = dir+filename+"_cleaned.json"
            fs.writeFile(fullfilename, JSON.stringify(array_scrapped_big_data, null, 2));
            console.log('Quote saved! to', fullfilename)
        }
    })
}

function createTable() {
    console.log("createTable lorem");

    var table1 = "CREATE TABLE candles_USD_BTC (         `id`	INTEGER PRIMARY KEY AUTOINCREMENT,         `start`	INTEGER UNIQUE,         `open`	REAL NOT NULL,         `high`	REAL NOT NULL,         `low`	REAL NOT NULL,         `close`	REAL NOT NULL,         `vwp`	REAL NOT NULL,         `volume`	REAL NOT NULL,         `trades`	INTEGER NOT NULL );"

    db.run(table1, createTable2);
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
                console.log(rows_to_fill+' Missing rows  between ' + bitfinex_raw[i - 1][0], bitfinex_raw[i][0])
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
function saveSqlLiteDB(array_chunk) {
    var placeholders = array_chunk.map((language) => "(" + language + ")"
).
    join(',');

    var stmt = db.prepare("INSERT INTO candles_USD_BTC( start,open,close,high,low,volume,vwp,trades) VALUES " + placeholders);
    stmt.run(JSON.parse(JSON.stringify(array_chunk)));
    array_chunk = []

    var stmt2 = db.prepare("INSERT INTO sqlite_sequence( name, seq) VALUES ('candles_USD_BTC'," + bitfinex_raw.length + ")");

    stmt2.run();
    closeDb();
    // stmt.finalize(readAllRows);
}
function readAllRows() {
    console.log("readAllRows lorem");
    db.all("SELECT rowid AS id, info FROM lorem", function (err, rows) {
        rows.forEach(function (row) {
            console.log(row.id + ": " + row.info);
        });
        closeDb();
    });
}

function closeDb() {
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
            step_size_is_seconds = 60*5;
            break;
        case '15m':
            step_size_is_seconds = 60*15;
            break;
        case '1h':
            step_size_is_seconds = 3600;
            break;
        case '3h':
            step_size_is_seconds = 3600*3;
            break;
    }
    createDb();
}

runChainExample();