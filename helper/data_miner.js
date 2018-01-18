/**
 * Created by Tolotra Samuel on 01/01/2018.
 */
const sql_helper = require('./sql_helper.js')
var fs = require('fs')
var sqlite3 = require('sqlite3').verbose();
var db;
const request = require('request')
var filename = 'from_1480550400to_1514660413_1mquote'
var filename = 'from_1480550400to_1514053361_15mquote'
var filename = 'from_1480550400to_1514053361_5mquote'
var bitfinex_raw;
var range = '5m';


class DataMiner {
    constructor() {
        this.array_scrapped_big_data = []
        this.candle_size;
        this.from_date
        this.limit
        this.to_date
        this.lastStepTimestamp
        this.onDownload = function () {
            //nothing
        }
        var self = this
    }

    on(event, cb) {
        switch (event) {
            case 'download':
                this.onDownload = cb
                break;
        }
    }


    getCandles(exchange, asset, currency, candle_size, from_date, to_date, cb) {
        var dbPath = this.createDbPath(exchange, currency, asset, candle_size)

        sql_helper.readAllToJson(dbPath, asset, currency, candle_size, from_date, to_date, function (candles) {
            cb(candles)
        })
    }

    AppendToAvailableDataCheck(rangeObj, from_date, to_date, exchange, asset, currency, candle_size, cb) {
        console.log('AppendToAvailableDataCheck Started')
        if (rangeObj.available_until < to_date) { //Second check, after the available data
            //if the above is true, its not ok, you need to download the data
            console.log('DownloadAndappendToSql Starting because to_date < available_until ', to_date)

            var download_from_date = rangeObj.available_until + this.getThisRangeinMinute() * 60
            this.DownloadAndappendToSql(exchange, asset, currency, candle_size, download_from_date, to_date, () => {
                this.getCandles(exchange, asset, currency, candle_size, from_date, to_date, function (candles) {
                    cb(candles)
                })
            })
        } else {
            this.getCandles(exchange, asset, currency, candle_size, from_date, to_date, function (candles) {
                cb(candles)
            })
        }
    }

    /**this function  takes the
     from_date: when to make sure the data start included
     to_date:when to make sure the data stops included
     a callback that returns a raw data from the above range
     1) it gets the available range in the database
     2) First Check before the available data if available_since is younger than from_date
     3) First Check after the available data if available_until is younger than to_date

     from_date in unix second
     to_date in unix second
     **/
    createSqlByTimeRangeAndMarket(exchange, asset, currency, candle_size, from_date, to_date, cb, limit) {
        this.from_date = from_date
        this.to_date = to_date
        this.candle_size = candle_size
        this.limit = limit
        var max_to_data = this.getLastStepTimestamp() / 1000

        if (to_date > max_to_data) { // setting maximum limit
            to_date = max_to_data
            this.from_date = from_date
        }


        console.log('createSqlByTimeRangeAndMarket ' + this.from_date, this.to_date)
        this.getAvailableDataRanges(exchange, currency, asset, candle_size, (err, rangeObj) => {
            console.log('getAvailableDataRanges Done')

            if (rangeObj.available_since !== 'None' || rangeObj.available_until !== 'None') {
                if (from_date < rangeObj.available_since) { //First Check before the available data
                    //if the above is true, it means that the trader requested a date earlier than available data, therefore, download missing data
                    var download_to_date = rangeObj.available_since - this.getThisRangeinMinute() * 60 //download until db.available_since but do not include db.available_since
                    console.log('DownloadAndappendToSql Starting because from_date < available_since ', from_date)
                    this.DownloadAndappendToSql(exchange, asset, currency, candle_size, from_date, download_to_date, () => {
                        //then ckeck the future
                        this.AppendToAvailableDataCheck(rangeObj, from_date, to_date, exchange, asset, currency, candle_size, cb)
                    })
                } else {
                    //if past is ok, check future(after the available data )
                    console.log('DownloadAndappendToSql Starting')
                    this.AppendToAvailableDataCheck(rangeObj, from_date, to_date, exchange, asset, currency, candle_size, cb)
                }
            } else {
                //If data not existing at all
                console.log('Data miner Decided to create new DB ', from_date + " to " + to_date)
                this.DownloadAndCreateDbToSql(exchange, asset, currency, candle_size, from_date, to_date, () => {
                    this.AppendToAvailableDataCheck(rangeObj, from_date, to_date, exchange, asset, currency, candle_size, cb)
                })
            }
        })

        // createDb();
    }

    DownloadAndappendToSql(exchange, asset, currency, candle_size, from_date, to_date, cb) {
        //This function is called when data is missing form DB, either before or after available data
        console.log('DownloadAndappendToSql Started')

        this.array_scrapped_big_data = [] //flushing the array first because its used twice
        this.scrap_quote_bitfinex(to_date, from_date, candle_size, asset, currency, exchange, () => {

            this.BitfinexRawCandlesToClean(this.array_scrapped_big_data, candle_size, (cleanedCandles) => {
                var pathDB = this.createDbPath(exchange, currency, asset, candle_size)
                sql_helper.appendJSONToDb(cleanedCandles, pathDB, asset, currency, exchange, function () {
                    cb()
                })
            })
        })
    }

    DownloadAndCreateDbToSql(exchange, asset, currency, candle_size, from_date, to_date, cb) {
        //This function is called when data is missing form DB, either before or after available data
        console.log('DownloadAndappendToSql Started')

        this.array_scrapped_big_data = [] //flushing the array first because its used twice
        this.scrap_quote_bitfinex(to_date, from_date, candle_size, asset, currency, exchange, () => {

            this.BitfinexRawCandlesToClean(this.array_scrapped_big_data, candle_size, (cleanedCandles) => {
                var pathDB = this.createDbPath(exchange, currency, asset, candle_size)

                sql_helper.createJSONToDb(cleanedCandles, pathDB, asset, currency, exchange, function () {
                    cb()
                })

            })
        })
    }

    BitfinexRawCandlesToClean(bitfinex_raw, candle_size, cb) {
        var step_size_is_seconds;

        switch (candle_size) {
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
        console.log("Cleaning rows ");

        var cleanedCandles = []
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
                        cleanedCandles.push(new_raw)
                        console.log('Missing row added at ' + i, new_raw[0])
                    }
                } else {

                }
                cleanedCandles.push(bitfinex_raw[i])
            } else {
                if (i === 0) {
                    cleanedCandles.push(bitfinex_raw[i])
                } else {
                    console.log('Duplicate at ' + i, bitfinex_raw[i][0])
                }
            }

            if (i && i % 10000 === 0) {

            }
        }

        //return
        cb(cleanedCandles)
        // saveasJsonFile(array_chunk)
    }

    get_data_ticker_online(range) {
        console.log(this.dateStr + " - REQUESTING TICKER ")

        var last_date = this.raw_array_data_db_format[this.raw_array_data_db_format.length - 1][0];
        var lastDateRecorded = this.raw_array_data_db_format[this.raw_array_data_db_format.length - 1][0];
        var next_date = last_date + 1000 * 60 * 5;
        var params = {limit: 10}
        var str_params = this.object_to_url_param(params)
        var url = "https://api.bitfinex.com/v2/candles/trade:" + range + ":tBTCUSD/hist?" + str_params

        this.http_request({url: url, method: 'GET'}, (data, params) => {

            if (!data) {
                this.get_data_ticker_online(range)
                console.log('FATAL ERROR, DATA not retrieved')

            } else {

                var new_scrapped_array_data = []
                // getLastStepTimestamp()
                for (var n = 0; n < data.length; n++) {
                    if (data[n][0] > lastDateRecorded) {
                        if ((data[n][0] + 1000 * 60 * 5) < this.now) {
                            new_scrapped_array_data.push(data[n])
                        }
                    } else {
                        break;
                    }
                }
                new_scrapped_array_data.reverse()
                this.raw_array_data_db_format = this.raw_array_data_db_format.concat(new_scrapped_array_data);

                if (new_scrapped_array_data.length === 0) {
                    console.log(this.dateStr + " - NO NEW TICKER ")

                    this.online_data_mainlooper_bitfinex() //go back to loop
                } else {
                    if (new_scrapped_array_data.length > 1) {
                        for (var m = 0; m < new_scrapped_array_data.length - 2; m++) {
                            this.create_cleaned_obj_current_market_data(new_scrapped_array_data[m])
                            this.create_indicators()
                        }
                    }
                    if (new_scrapped_array_data.length === 1) {

                    }


                    this.create_cleaned_obj_current_market_data(this.raw_array_data_db_format[this.raw_array_data_db_format.length - 1])
                    this.create_indicators()
                    this.save_live_quote('bitfinex', range)

                    this.offline_trade_sudden_growth_difference_from_moving_average()
                    // offline_trade_sudden_growth_min_step()
                    // offline_trade_sudden_growth_daily()
                    // offline_trade_moving_average()
                    // offline_trade_moving_average_with_anti_loss()
                    // offline_trade_moving_average_comparaison()

                    this.online_data_mainlooper_bitfinex() //go back to loop
                }
            }
            // console.log(data.trades[0], params)
        }, params)
    }

    object_to_url_param(obj) {
        var str = "";
        for (var key in obj) {
            if (str != "") {
                str += "&";
            }
            str += key + "=" + encodeURIComponent(obj[key]);
        }
        return str;
    }

    http_request(headers_params, cb, params) {
        headers_params.timeout = 50000;
        console.log(headers_params)
        request(headers_params
            , (error, response, body) => {
                console.log('Response of request:')
                if (!error && response.statusCode == 200) {
                    // console.log(body)
                    var parsedData = '';
                    try {
                        parsedData = JSON.parse(body);
                        cb(parsedData, params)

                    } catch (e) {
                        console.log(e); // error in the above string (in this case, yes)!
                        cb((body), params)
                    }
                } else {

                    console.error("WTF HTTP REQUEST ERROR");

                    console.error(error)
                    if (response) {
                        console.error(response.statusCode)
                        params.StatusCode = response.statusCode;
                    }
                    if (error) {
                        console.log('Error code code ', error.code)
                        if (error.code === 'ESOCKETTIMEDOUT') {
                            console.log('error timeout. retrying now')
                            this.http_request(headers_params, cb, params)
                        } else {
                            cb(error, params)
                        }
                    }
                    // this.http_request(headers_params, cb, params)
                }
            })
    }

    getLastStepTimestamp() {
        //the a timestamp of the past that fall in the step range
        this.now = new Date();
        var when_candle_ended = this.now - this.now % (1000 * 60 * this.getThisRangeinMinute()) //the last 5 minute timestamp
        var when_candle_started = when_candle_ended - (1000 * 60 * this.getThisRangeinMinute())
        this.lastStepTimestamp = when_candle_started
        return this.lastStepTimestamp
    }

    getThisRangeinMinute() {

        var rangeInMinute;
        var range = this.candle_size;
        switch (range) {
            case '1m':
                rangeInMinute = 1;
                break;
            case '5m':
                rangeInMinute = 5;
                break;
            case '15m':
                rangeInMinute = 15;
                break;
            case '1h':
                rangeInMinute = 60;
                break;
            case '3h':
                rangeInMinute = 180;
                break;
        }
        return rangeInMinute
    }

    scrap_quote_bitfinex(to_date, from_date, range, asset, currency, exchange, cb) {

        /*
         this program will return a json array, including the from_date and the to_date in second timestamp,
         in ascending order by timestamp

         Scrape quote will take this.to_date and this.from_date, timestamps in seconds
         Will start downloading 1000 rows starting from the end_date(future), moving backward in time
         If the end_date does not close a candle, the result end_date will automatically be moved back in time(to the past) to the closest end of the candle size chosen
         The program will get the last row from the 1000 results, which is the oldest from the query, get the timestamp, the will remove that last row,  and call again the api from that time to return the candles,
         */
        // https://api.bitfinex.com/v2/candles/trade:30m:tBTCUSD/hist?start=1509828547000&end=1512028800000&limit=1000
        //1D
        //15m


        var pair = asset + currency
        var params = {limit: this.limit || 1000, end: to_date * 1000, duration: 1800}
        var str_params = this.object_to_url_param(params)
        var url = "https://api.bitfinex.com/v2/candles/trade:" + range + ":t" + pair + "/hist?" + str_params
        var delay_api_limit;
        this.http_request({url: url, method: 'GET'}, (data, params) => {
            if (params.StatusCode === 429 || typeof (params.StatusCode) !== typeof undefined) {
                //take rest, too much request
                delay_api_limit = 15000;
                console.log('Error Limit with code ' + params.StatusCode, 'Taking nap for 15 seconds')
            } else {
                console.log('Data length:  ' + data.length)
                delay_api_limit = 2500;
            }
            if (!data || typeof data === typeof undefined || typeof data.length === typeof undefined || data.length === 0 || typeof data[data.length - 1] === typeof undefined) {
                // var next_date = this.array_scrapped_big_data[this.array_scrapped_big_data.length - 1][0] / 1000;
                setTimeout(() => {
                    this.scrap_quote_bitfinex(to_date, from_date, range, asset, currency, exchange, cb)
                }, delay_api_limit)
            } else {

                // console.log(data.candles.length)
                var next_date = data[data.length - 1][0] / 1000;
                data.pop() //removing the last row after getting the new timestamp, which is the oldest on
                this.array_scrapped_big_data = this.array_scrapped_big_data.concat(data);

                if (next_date >= from_date) {
                    //not over yet
                    this.percentage = 100 - 100 * (next_date - from_date) / (this.to_date - from_date)
                    var msg = 'oldest date downloaded ' + next_date + ' / requested since: ' + from_date
                    this.onDownload({state: 'is Downloading data... ' + this.percentage.toFixed(2) + '%', msg: msg})
                    console.log(msg)
                    setTimeout(() => {
                        this.scrap_quote_bitfinex(next_date, from_date, range, asset, currency, exchange, cb)
                    }, delay_api_limit)
                } else {
                    //it's over
                    this.array_scrapped_big_data.reverse()
                    //removing excess from the top to from_date
                    var n;
                    for (n = 0; n < this.array_scrapped_big_data.length; n++) {
                        if (this.array_scrapped_big_data[n][0] >= from_date * 1000) {
                            break;
                        } else {
                        }
                    }
                    this.array_scrapped_big_data.splice(0, n)
                    // this.array_scrapped_big_data.pop() //removing the last row(youngest, because it is already in db)
                    console.log(this.array_scrapped_big_data.length, 'New Array to add')
                    cb()
                }
            }
            // console.log(data.trades[0], params)
        }, params)

    }

    createDbPath(exchange, currency, asset, candle_size) {
        var exchangeFolderPath = './quote/' + exchange
        var pair = currency + '_' + asset
        var dbPath = exchangeFolderPath + '/' + pair + '_' + candle_size + '.db'
        return dbPath
    }

    getAvailableDataRanges(exchange, currency, asset, candle_size, cb) {
        var exchangeFolderPath = './quote/' + exchange
        var err = null
        var pair = currency + '_' + asset
        var rangeObj = {available_since: 'None', available_until: 'None'}
        if (!fs.existsSync(exchangeFolderPath)) {
            cb('Error: No data from exchange', rangeObj)
        } else {
            var dbPath = exchangeFolderPath + '/' + pair + '_' + candle_size + '.db'
            if (!fs.existsSync(dbPath)) {
                cb('Error: No data from candle_size or pair', rangeObj)
            } else {
                sql_helper.getRangesLimitsFromDbPath(dbPath, pair, function (err, rangeObj) {
                    cb(null, rangeObj)
                })
            }
        }
    }
}

module.exports = DataMiner;


