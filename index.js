const request = require('request')
const BitX = require('bitx')
const fs = require('fs')
var dateFormat = require('dateformat');
var bitx = new BitX()
// const express =
const plotter = require('./helper/plotter.js')

//Shared vars
var zar_balance = 0;
var btc_balance = 0;
var now;
var dateStr;
var isSimulation =false;
var isOnline =false;

//Real time trader
var tickers = []

//Scrapper download luno
var from_date = 1480550400; //1st december 2016
// var to_date = 1512100800; //1st december 2017
var to_date = 1514053361; //23rd december 2017
var local_stat = []
// var to_date = 1485907200; //1st febrary 2017

//Offline simulation
var cleaned_obj_current_market_data = {}
var raw_array_offline_array_data = []
var raw_array_online_array_data = []
var array_scrapped_big_data = [];
var cleaned_array_offline_array_data = []
var strategy = ""
var graph_data = {
    ticker: {
        x: [],
        y: [],
        type: 'scatter',
        name: 'ticker'
    },
    close: {
        x: [],
        y: [],
        type: 'scatter',
        name: 'close'
    },
    change_bal: {
        x: [],
        y: [],
        type: 'bar',
        name: 'change_bal',

    },

    ma24h: {
        x: [],
        y: [],
        type: 'scatter',
        name: 'ma24h'
    }, ma1h: {
        x: [],
        y: [],
        type: 'scatter',
        name: 'ma1h'
    },
    profit: {
        x: [],
        y: [],
        type: 'scatter',
        name: 'profit'
    },

    sell: {
        x: [],
        y: [],
        type: 'scatter',
        mode: "markers",
        name: 'sell'

    },
    buy: {
        x: [],
        y: [],
        type: 'scatter',
        mode: "markers",
        name: 'buy'

    }
};
var dataset_path = "";
var total_counter_Trade = 0;

var test_log = require("./analysis/test_log.json") || []

var initial_balance = 730.61;
var fee = 0.2;
var trade_risk = 0.12;
var lower_trade_risk = 0.05
var last_buy_price, last_sell_price;
var profit_after_sell = 0;

var mode = 'waiting_for_sell';
var step_before_sell = -1; //random number, just for set in sudden growth min_step strategy


/*
 luno trade_risk = 0.001 , 1.4807824, fee = 0.2, trade 591
 luno  trade_risk = 0.005 risk , 1.307, fee = 0.2, trade 373

 bitfinex trade_risk = 0.001,  fee = 0.2; 0.898728516, trade 672
 bitfinex trade_risk = 0.005,  fee = 0.2; 1.1501926111680123, trade: 400
 */

function http_request(headers_params, cb, params) {
    console.log(headers_params)
    request(headers_params
        , function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body)
                cb(JSON.parse(body), params)
                return null
            } else {

                console.error("WTF HTTP REQUEST ERROR");
                console.error(error, response.statusCode)
                cb(error, params)
            }
        })
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

function save_quote(subfolder, range) {
    if (!range) {
        range = ""
    }
    var dir = './quote/' + subfolder + "/";
    create_dir(dir, function (err) {
        if (err) {
            console.log('failed to create directory', err);
        } else {
            console.log('Directory created')
            var filename = dir + 'from_' + from_date + 'to_' + to_date + "_" + range + 'quote.json'
            fs.writeFile(filename, JSON.stringify(array_scrapped_big_data, null, 2));
            console.log('Quote saved! to', filename)
        }
    })
}

function save_live_quote(subfolder, range) {
    if (!range) {
        range = ""
    }
    var dir = './quote/live/' + subfolder + "/";
    create_dir(dir, function (err) {
        if (err) {
            console.log('failed to create directory', err);
        } else {
            console.log('Directory created')
            var filename = dir + 'from_' + from_date + 'to_' + to_date + "_" + range + 'quote.json'
            var filename_indicators = dir + 'last_indicators' + range + 'quote.json'
            var filename_tickers = dir + 'last_tickers' + range + 'quote.json'
            fs.writeFile(filename_indicators, JSON.stringify(cleaned_array_offline_array_data, null, 2));
            fs.writeFile(filename_tickers, JSON.stringify(raw_array_online_array_data, null, 2));
            console.log('Quote saved! to', filename)
        }
    })
}


function object_to_url_param(obj) {
    var str = "";
    for (var key in obj) {
        if (str != "") {
            str += "&";
        }
        str += key + "=" + encodeURIComponent(obj[key]);
    }
    return str;
}

function test_api() {
    var params = {}
    var url = "https://api.mybitx.com/api/1/trades?pair=XBTZAR"

    http_request({url: url, method: 'GET'}, function (data, params) {

        for (var n = 0; n < data.trades.length - 1; n++) {
            var change = data.trades[n + 1].price - data.trades[n].price;
            var growth = change / data.trades[n].price * 100
            console.log(growth)
        }
        // console.log(data.trades[0], params)
    }, params)

}

function scrap_quote_luno(from) {
    var params = {pair: "XBTZAR", since: from, duration: 1800}
    var str_params = object_to_url_param(params)
    var url = "https://www.luno.com/ajax/1/candles?" + str_params

    http_request({url: url, method: 'GET'}, function (data, params) {

        // console.log(data.candles.length)
        array_scrapped_big_data = array_scrapped_big_data.concat(data.candles);
        var next_date = data.candles[(data.candles.length) - 1].timestamp;
        if (next_date < to_date) {
            scrap_quote_luno(next_date)
        } else {
            save_quote("luno")
        }
        // console.log(data.trades[0], params)
    }, params)

}
function scrap_quote_bitfinex(to_date, from_date, range) {
    // https://api.bitfinex.com/v2/candles/trade:30m:tBTCUSD/hist?start=1509828547000&end=1512028800000&limit=1000
    //1D
    //15m
    var params = {limit: 1000, end: to_date, duration: 1800}
    var str_params = object_to_url_param(params)
    var url = "https://api.bitfinex.com/v2/candles/trade:" + range + ":tBTCUSD/hist?" + str_params

    http_request({url: url, method: 'GET'}, function (data, params) {

        if (!data) {
            var next_date = array_scrapped_big_data[array_scrapped_big_data.length - 1][0];
            scrap_quote_bitfinex(next_date, from_date, range)

        } else {

            // console.log(data.candles.length)
            array_scrapped_big_data = array_scrapped_big_data.concat(data);
            var next_date = data[data.length - 1][0];
            if (next_date > from_date) {
                setTimeout(function () {
                    scrap_quote_bitfinex(next_date, from_date, range)
                }, 1250)
            } else {
                array_scrapped_big_data.reverse()
                save_quote("bitfinex", range)
            }
        }
        // console.log(data.trades[0], params)
    }, params)

}
// scrap_quote_bitfinex(to_date * 1000, from_date*1000,"5m")

function recordTicker(ticker) {
    tickers.push(ticker)
}
function setup() {

    initial_balance = initial_balance;
    console.log("SET: " + dateStr + " - ", "Initial balance set to " + initial_balance + " ZAR")
}
function start() {

    now = new Date();
    dateStr = dateFormat(now, "dd/mm/yy-hh:MM:ss");
    setup();

    var currentTimeStamp = new Date().getTime();
    var startTimeout = 60 * 1000 - currentTimeStamp % (1000 * 60)

    console.log("SET: " + dateStr + " - ", "Will start looper in " + startTimeout + " millis")
    setTimeout(mainLoop_real_time_api, startTimeout)
}

function checkTransaction() {

}
function getTicker() {
    bitx.getTicker(function (err, ticker) {
        if (err) {
            throw err
        }
        if (typeof (ticker) != 'undefined') {

            now = new Date();
            dateStr = dateFormat(now, "dd/mm/yy-hh:MM:ss");

            console.log("TIC: " + dateStr + " - ",
                "Ask: " + ticker.ask + ", "
                + "Bid: " + ticker.bid
                + ", " + "Last Trade: " + ticker.last_trade);

            recordTicker(ticker)
            checkTransaction()
        } else {
            console.log("ERR: " + dateStr + " - ", "Error getting Ticker");
        }
    });
}
function mainLoop_real_time_api() {
    setInterval(getTicker, 60 * 1000);
}


function AddZero(num) {
    return (num >= 0 && num < 10) ? "0" + num : num + "";
}
function date_time_formatter(d) {

    return [d.getFullYear(),
            AddZero(d.getMonth() + 1),
            AddZero(d.getDate())].join('-') + ' ' +
        [AddZero(d.getHours()),
            AddZero(d.getMinutes()), AddZero(d.getSeconds())].join(':');
}

function graph_insert() {
    graph_data.ticker.x.push(date_time_formatter(new Date(cleaned_obj_current_market_data.timestamp)))
    graph_data.ticker.y.push(cleaned_obj_current_market_data.average_price)

    graph_data.close.x.push(date_time_formatter(new Date(cleaned_obj_current_market_data.timestamp)))
    graph_data.close.y.push(cleaned_obj_current_market_data.close_price)

    graph_data.ma24h.x.push(date_time_formatter(new Date(cleaned_obj_current_market_data.timestamp)))
    graph_data.ma24h.y.push(cleaned_obj_current_market_data.ma24h)

    graph_data.ma1h.x.push(date_time_formatter(new Date(cleaned_obj_current_market_data.timestamp)))
    graph_data.ma1h.y.push(cleaned_obj_current_market_data.ma1h)
}
function create_cleaned_obj_current_market_data_luno(rawArrayOfflineArrayDatum) {
    try {

        cleaned_obj_current_market_data.average_price =
            (Number(rawArrayOfflineArrayDatum.open) +
            Number(rawArrayOfflineArrayDatum.close) +
            Number(rawArrayOfflineArrayDatum.high) +
            Number(rawArrayOfflineArrayDatum.low))
            / 4;

        cleaned_obj_current_market_data.timestamp = rawArrayOfflineArrayDatum.timestamp * 1000

    } catch (e) {
        console.log("Cannot clean dataset")
        console.error(e)
        process.exit();

    }
}

function create_cleaned_obj_current_market_data_bitfinex(rawArrayOfflineArrayDatum) {
    try {

        cleaned_obj_current_market_data.average_price =
            ((rawArrayOfflineArrayDatum[1]) +
            (rawArrayOfflineArrayDatum[2]) +
            (rawArrayOfflineArrayDatum[3]) +
            (rawArrayOfflineArrayDatum[4]))
            / 4;
        cleaned_obj_current_market_data.close_price = rawArrayOfflineArrayDatum[2]
        //Remove the below line later
        cleaned_obj_current_market_data.average_price = cleaned_obj_current_market_data.close_price
        //End remove
        cleaned_obj_current_market_data.timestamp = rawArrayOfflineArrayDatum[0]

    } catch (e) {
        console.log("Cannot clean dataset")
        console.error(e)
        process.exit();
    }
}


function offline_data_mainlooper_bitfinex() {
    var hours_step_size = 1 * 2 * 2 * 3;
    var daily_step_size = 24 * 2 * 2 * 3;
    // var hours_step_size = 1 ;
    // var daily_step_size = 24/3;
    // dataset_path = './quote/bitfinex/from_1480550400to_1512100800_1hquote.json';
    // dataset_path =  ('./quote/bitfinex/from_1480550400to_1512100800quote.json') //thats's 30 min
    // dataset_path = ('./quote/bitfinex/from_1480550400to_1512100800_15mquote.json')
    // dataset_path = ('./quote/bitfinex/from_1480550400to_1514053361_15mquote.json')
    dataset_path = ('./quote/bitfinex/from_1480550400to_1514053361_5mquote.json')
    // dataset_path = ('./quote/bitfinex/from_1480550400to_1512100800_3hquote.json')
    raw_array_offline_array_data = require(dataset_path)
    for (var n = 0; n < raw_array_offline_array_data.length; n++) {
        create_cleaned_obj_current_market_data_bitfinex(raw_array_offline_array_data[n])

        if (n > 0) {
            cleaned_obj_current_market_data.min_step_change = (cleaned_obj_current_market_data.close_price - cleaned_array_offline_array_data[n - 1].close_price) / cleaned_array_offline_array_data[n - 1].close_price
        }
        if (n >= hours_step_size) {
            cleaned_obj_current_market_data.hourly_growth = (cleaned_obj_current_market_data.average_price - cleaned_array_offline_array_data[n - hours_step_size].average_price) / cleaned_array_offline_array_data[n - hours_step_size].average_price

//calculating the moving average
            var sum = 0;
            for (var i = 1; i <= hours_step_size; i++) {
                sum = sum + cleaned_array_offline_array_data[n - i].average_price
            }
            // console.log(sum)
            cleaned_obj_current_market_data.ma1h = sum / hours_step_size;
            // console.log(cleaned_data.hourly_growth, cleaned_data.average_price +" "+cleaned_offline_data[n - 2].average_price)
        }
        if (n >= daily_step_size) {
            cleaned_obj_current_market_data.daily_growth = (cleaned_obj_current_market_data.average_price - cleaned_array_offline_array_data[n - daily_step_size].average_price) / cleaned_array_offline_array_data[n - daily_step_size].average_price

            //calculating the moving average
            var sum = 0;
            for (var i = 1; i <= daily_step_size; i++) {
                sum = sum + cleaned_array_offline_array_data[n - i].average_price
            }
            // console.log(sum)
            cleaned_obj_current_market_data.ma24h = sum / daily_step_size;
        }

        if (n >= daily_step_size * 2) {
            cleaned_obj_current_market_data.daily_ma24h_growth = (cleaned_obj_current_market_data.ma24h - cleaned_array_offline_array_data[n - daily_step_size].ma24h) / cleaned_array_offline_array_data[n - daily_step_size].ma24h
            // console.log( cleaned_obj_current_market_data.daily_ma24h_growth)
        }
        if (n >= hours_step_size * 2) {
            cleaned_obj_current_market_data.daily_ma1h_growth = (cleaned_obj_current_market_data.ma1h - cleaned_array_offline_array_data[n - hours_step_size].ma1h) / cleaned_array_offline_array_data[n - hours_step_size].ma1h
            // console.log( cleaned_obj_current_market_data.daily_ma1h_growth)
        }

        cleaned_array_offline_array_data.push(JSON.parse(JSON.stringify(cleaned_obj_current_market_data)));

        graph_insert()
        if (n == 0) {
            buy_btc(initial_balance)
            // print_balances()
        }

        offline_trade_sudden_growth_difference_from_moving_average()
        // offline_trade_sudden_growth_min_step()
        // offline_trade_sudden_growth_daily()
        // offline_trade_moving_average()
        // offline_trade_moving_average_with_anti_loss()
        // offline_trade_moving_average_comparaison()
    }
}

function offline_data_mainlooper_luno() {
    dataset_path = './quote/luno/from_1480550400to_1512100800quote.json';
    raw_array_offline_array_data = require(dataset_path)
    for (var n = 0; n < raw_array_offline_array_data.length; n++) {
        create_cleaned_obj_current_market_data_luno(raw_array_offline_array_data[n])

        if (n >= 2) {
            cleaned_obj_current_market_data.hourly_growth = (cleaned_obj_current_market_data.average_price - cleaned_array_offline_array_data[n - 2].average_price) / cleaned_array_offline_array_data[n - 2].average_price

            // console.log(cleaned_data.hourly_growth, cleaned_data.average_price +" "+cleaned_offline_data[n - 2].average_price)
        }
        if (n >= 48) {
            cleaned_obj_current_market_data.daily_growth = (cleaned_obj_current_market_data.average_price - cleaned_array_offline_array_data[n - 48].average_price) / cleaned_array_offline_array_data[n - 48].average_price
        }

        cleaned_array_offline_array_data.push(JSON.parse(JSON.stringify(cleaned_obj_current_market_data)));
        graph_insert()

        if (n == 0) {
            buy_btc(initial_balance)
            // print_balances()
        }
        offline_trade_sudden_growth_min_step()
    }
}

var last_zar_balance;
var cummulative_profit = 0;
var startTickerLoggingTimestamp = -1;
var lastStepTimestamp = -1;

function print_profit() {

    console.log( dateStr + " - PROF: ", "Profit: " + profit_after_sell + ", Cummulative Profit: " + cummulative_profit)

    graph_data.change_bal.x.push(date_time_formatter(new Date(cleaned_obj_current_market_data.timestamp)))
    graph_data.change_bal.y.push(profit_after_sell)

    graph_data.profit.x.push(date_time_formatter(new Date(cleaned_obj_current_market_data.timestamp)))
    graph_data.profit.y.push(cummulative_profit)
}
function sell_btc(crypto_cash) {

    now = cleaned_obj_current_market_data.timestamp;
    dateStr = dateFormat(now, "dd/mm/yy-hh:MM:ss");

    if (crypto_cash > 0) {
        last_sell_price = cleaned_obj_current_market_data.average_price

        total_counter_Trade++;
        graph_data.sell.x.push(date_time_formatter(new Date(cleaned_obj_current_market_data.timestamp)))
        graph_data.sell.y.push(cleaned_obj_current_market_data.average_price)

        zar_balance = zar_balance + (crypto_cash - crypto_cash * fee / 100) * cleaned_obj_current_market_data.average_price;
        btc_balance = btc_balance - crypto_cash;

        console.log("SELL: " + dateStr + " - ", "Has Sold BTC " + crypto_cash + " at " + cleaned_obj_current_market_data.average_price + " with all BTC of: " + crypto_cash)
        print_balances()

        profit_after_sell = (zar_balance - last_zar_balance )
        cummulative_profit = cummulative_profit + profit_after_sell
        print_profit()
    } else {
        // console.log("cannot sell")
    }
}

function sell_btc_at_close(crypto_cash) {

    now = cleaned_obj_current_market_data.timestamp;
    dateStr = dateFormat(now, "dd/mm/yy-hh:MM:ss");

    if (crypto_cash > 0) {
        last_sell_price = cleaned_obj_current_market_data.close_price

        total_counter_Trade++;
        graph_data.sell.x.push(date_time_formatter(new Date(cleaned_obj_current_market_data.timestamp)))
        graph_data.sell.y.push(cleaned_obj_current_market_data.close_price)

        zar_balance = zar_balance + (crypto_cash - crypto_cash * fee / 100) * cleaned_obj_current_market_data.close_price;
        btc_balance = btc_balance - crypto_cash;

        console.log("SELL: " + dateStr + " - ", "Has Sold BTC " + crypto_cash + " at " + cleaned_obj_current_market_data.close_price + " with all BTC of: " + crypto_cash)
        print_balances()
        profit_after_sell = (zar_balance - last_zar_balance )
        cummulative_profit = cummulative_profit + profit_after_sell
        print_profit()
    } else {
        // console.log("cannot sell")
    }
}
function buy_btc(fiat_cash) {

    now = cleaned_obj_current_market_data.timestamp;
    dateStr = dateFormat(now, "dd/mm/yy-hh:MM:ss");
    if (fiat_cash > 0) {
        last_buy_price = cleaned_obj_current_market_data.average_price

        total_counter_Trade++;
        graph_data.buy.x.push(date_time_formatter(new Date(cleaned_obj_current_market_data.timestamp)))
        graph_data.buy.y.push(cleaned_obj_current_market_data.average_price)


        last_zar_balance = zar_balance
        btc_balance = btc_balance + (fiat_cash - fiat_cash * fee / 100) / cleaned_obj_current_market_data.average_price;
        zar_balance = zar_balance - fiat_cash;

        console.log("BUY: " + dateStr + " - ", "Has Bough BTC " + btc_balance + " at " + cleaned_obj_current_market_data.average_price + " with all ZAR of: " + fiat_cash)
        print_balances()
    } else {
        // console.log("cannot buy")
    }
}
function buy_btc_at_close(fiat_cash) {

    now = cleaned_obj_current_market_data.timestamp;
    dateStr = dateFormat(now, "dd/mm/yy-hh:MM:ss");
    if (fiat_cash > 0) {
        last_buy_price = cleaned_obj_current_market_data.close_price

        total_counter_Trade++;
        graph_data.buy.x.push(date_time_formatter(new Date(cleaned_obj_current_market_data.timestamp)))
        graph_data.buy.y.push(cleaned_obj_current_market_data.close_price)


        last_zar_balance = zar_balance
        btc_balance = btc_balance + (fiat_cash - fiat_cash * fee / 100) / cleaned_obj_current_market_data.close_price;
        zar_balance = zar_balance - fiat_cash;

        console.log("BUY: " + dateStr + " - ", "Has Bough BTC " + btc_balance + " at " + cleaned_obj_current_market_data.close_price + " with all ZAR of: " + fiat_cash)
        print_balances()
    } else {
        // console.log("cannot buy")
    }
}
function print_balances() {
    if(isOnline){
        now = new Date().getTime()
    }else{
        now = cleaned_obj_current_market_data.timestamp;
    }
    dateStr = dateFormat(now, "dd/mm/yy-hh:MM:ss");
    console.log( dateStr + " - BALANCE:  ", "BTC: " + btc_balance + " ZAR: " + zar_balance)
}

function offline_trade_sudden_growth_difference_from_moving_average() {
    strategy = "sudden growth distance percentage peak of ticker close vs 24h moving average"
    if (typeof (cleaned_obj_current_market_data.ma24h) !== "undefined") {
        var distance_close_sma = cleaned_obj_current_market_data.close_price - cleaned_obj_current_market_data.ma24h
        var distance_close_sma_change = distance_close_sma / cleaned_obj_current_market_data.ma24h;
        local_stat.push(distance_close_sma_change)

        if (mode === 'waiting_for_buy') {
            if (distance_close_sma_change > -lower_trade_risk && distance_close_sma_change < lower_trade_risk) {
                mode = 'waiting_for_sell'
                buy_btc(zar_balance)
            }

        } else {

            if (distance_close_sma_change > trade_risk) {
                console.log('sell!!!!!', distance_close_sma_change)
                mode = 'waiting_for_buy';
                sell_btc(btc_balance)
            }
        }

    }
}
function offline_trade_sudden_growth_min_step() {
    strategy = "simple step candle sudden growth"
    if (typeof (cleaned_obj_current_market_data.min_step_change) !== "undefined") {
        if (mode === 'waiting_for_buy') {
            step_before_sell--;
            if (step_before_sell === 0) {
                mode = 'waiting_for_sell'
                buy_btc(zar_balance)
            }

        } else {
            if (cleaned_obj_current_market_data.min_step_change < -trade_risk) {
                console.log('sell!!!!!', cleaned_obj_current_market_data.min_step_change)
                mode = 'waiting_for_buy';
                step_before_sell = 24 * 4 * 2 * 3
                sell_btc(btc_balance)
            }
        }


    }
}
function offline_trade_sudden_growth_daily() {
    strategy = "simple daily candle sudden growth"
    if (typeof (cleaned_obj_current_market_data.daily_growth) !== "undefined") {
        if (cleaned_obj_current_market_data.daily_growth > trade_risk) {
            buy_btc(zar_balance)
        }
        if (cleaned_obj_current_market_data.daily_growth < -trade_risk) {
            sell_btc(btc_balance)
        }
    }
}
function offline_trade_moving_average() {
    strategy = "moving average candle sudden growth 24h"
    if (typeof (cleaned_obj_current_market_data.daily_ma24h_growth) !== "undefined") {
        if (cleaned_obj_current_market_data.daily_ma24h_growth > trade_risk) {

            // buy_btc_at_close(zar_balance)
            buy_btc(zar_balance)

        }
        if (cleaned_obj_current_market_data.daily_ma24h_growth < -trade_risk) {

            // sell_btc_at_close(btc_balance)
            sell_btc(btc_balance)

        }
    }
}
function offline_trade_moving_average_sudden_growth() {
    strategy = "moving average candle sudden growth 1h"
    if (typeof (cleaned_obj_current_market_data.daily_ma1h_growth) !== "undefined") {
        if (cleaned_obj_current_market_data.daily_ma1h_growth > trade_risk) {

            buy_btc(zar_balance)

        }
        if (cleaned_obj_current_market_data.daily_ma1h_growth < -trade_risk) {

            sell_btc(btc_balance)

        }
    }
}
function offline_trade_moving_average_with_anti_loss() {
    strategy = "moving average candle sudden growth with anti loss"
    if (typeof (cleaned_obj_current_market_data.daily_ma24h_growth) !== "undefined") {
        if (cleaned_obj_current_market_data.daily_ma24h_growth > trade_risk) {
            if (cleaned_obj_current_market_data.average_price < last_sell_price) {
                console.log(last_sell_price, cleaned_obj_current_market_data.average_price)
                buy_btc(zar_balance)
            }
        }
        if (cleaned_obj_current_market_data.daily_ma24h_growth < -trade_risk) {
            if (cleaned_obj_current_market_data.average_price > last_buy_price) {
                console.log(last_buy_price, cleaned_obj_current_market_data.average_price)
                sell_btc(btc_balance)
            }
        }
    }
}
function offline_trade_moving_average_comparaison() {
    trade_risk = 20
    strategy = "moving average candle comparaison"
    if (typeof (cleaned_obj_current_market_data.ma24h) !== "undefined") {
        if (typeof (cleaned_obj_current_market_data.ma1h) !== "undefined") {
            // var diff = cleaned_obj_current_market_data.ma24h - cleaned_obj_current_market_data.ma1h
            var diff = cleaned_obj_current_market_data.ma24h - cleaned_obj_current_market_data.average_price
            // console.log(diff)
            if (diff > trade_risk) {
                sell_btc(btc_balance)
                // sell_btc_at_close(btc_balance)
            }
            if (diff < -trade_risk) {
                buy_btc(zar_balance)
                // buy_btc_at_close(zar_balance)
            }
        }
    }
}

function graphOnline() {

    plotter.plot(function () {
        console.log("END SIMULATION")
    }, graph_data)
}
function saveBilan() {

    var filename = './analysis/test_log.json';
    var filename_local_stat = './analysis/local_stat_log.json';
    fs.writeFile(filename_local_stat, JSON.stringify(local_stat, null, 2));
    fs.writeFile(filename, JSON.stringify(test_log, null, 2));
    console.log(dateStr+ ' - Quote saved! to' + dataset_path, filename)
}
function print_bilan() {
    var netWorth = zar_balance + btc_balance * cleaned_obj_current_market_data.average_price
    var growth = 100 * (netWorth - initial_balance) / initial_balance
    var natural_growth = 100 * (cleaned_obj_current_market_data.average_price - cleaned_array_offline_array_data[0].average_price) / cleaned_array_offline_array_data[0].average_price
    var efficiency = growth / natural_growth
    console.log(dateStr+ " -  BILAN ", "Networth: " + netWorth + ", Artificial Growth: " + growth + ", Natural Growth " + natural_growth + ", Fitness: " + efficiency + ", Trade count: " + total_counter_Trade)

    test_log.push({
        "Fee": fee,
        "Comment": "",
        "Risk": trade_risk,
        "Lower_risk": lower_trade_risk,
        "initial_balance": initial_balance,
        "Dataset": dataset_path,
        "Strategy": strategy,
        "Networth": netWorth,
        "Artificial_Growth": growth,
        "Natural_Growth": natural_growth,
        "Fitness": efficiency,
        "Trade_count": total_counter_Trade,
    })
 // saveBilan()
}
function simulation_offline() {
    // initial_balance = 2735.60;
    // initial_balance = 675;
    zar_balance = initial_balance
    console.log("SET: " + dateStr + " - ", "Initial balance set to " + initial_balance + " ZAR")

    // offline_data_mainlooper_luno()
    offline_data_mainlooper_bitfinex()

    graphOnline()
    print_bilan()
    saveBilan()
}
function create_indicators(n) {

    if (typeof n === typeof undefined) {
        n = cleaned_array_offline_array_data.length //this is used after fill past data gap resolved
    }
    var hours_step_size = 1 * 2 * 2 * 3;
    var daily_step_size = 24 * 2 * 2 * 3;
    if (n > 0) {
        cleaned_obj_current_market_data.min_step_change = (cleaned_obj_current_market_data.close_price - cleaned_array_offline_array_data[n - 1].close_price) / cleaned_array_offline_array_data[n - 1].close_price
    }
    if (n >= hours_step_size) {
        cleaned_obj_current_market_data.hourly_growth = (cleaned_obj_current_market_data.average_price - cleaned_array_offline_array_data[n - hours_step_size].average_price) / cleaned_array_offline_array_data[n - hours_step_size].average_price

//calculating the moving average
        var sum = 0;
        for (var i = 1; i <= hours_step_size; i++) {
            sum = sum + cleaned_array_offline_array_data[n - i].average_price
        }
        // console.log(sum)
        cleaned_obj_current_market_data.ma1h = sum / hours_step_size;
        // console.log(cleaned_data.hourly_growth, cleaned_data.average_price +" "+cleaned_offline_data[n - 2].average_price)
    }
    if (n >= daily_step_size) {
        cleaned_obj_current_market_data.daily_growth = (cleaned_obj_current_market_data.average_price - cleaned_array_offline_array_data[n - daily_step_size].average_price) / cleaned_array_offline_array_data[n - daily_step_size].average_price

        //calculating the moving average
        var sum = 0;
        for (var i = 1; i <= daily_step_size; i++) {
            sum = sum + cleaned_array_offline_array_data[n - i].average_price
        }
        // console.log(sum)
        cleaned_obj_current_market_data.ma24h = sum / daily_step_size;
    }

    if (n >= daily_step_size * 2) {
        cleaned_obj_current_market_data.daily_ma24h_growth = (cleaned_obj_current_market_data.ma24h - cleaned_array_offline_array_data[n - daily_step_size].ma24h) / cleaned_array_offline_array_data[n - daily_step_size].ma24h
        // console.log( cleaned_obj_current_market_data.daily_ma24h_growth)
    }
    if (n >= hours_step_size * 2) {
        cleaned_obj_current_market_data.daily_ma1h_growth = (cleaned_obj_current_market_data.ma1h - cleaned_array_offline_array_data[n - hours_step_size].ma1h) / cleaned_array_offline_array_data[n - hours_step_size].ma1h
        // console.log( cleaned_obj_current_market_data.daily_ma1h_growth)
    }

    cleaned_array_offline_array_data.push(JSON.parse(JSON.stringify(cleaned_obj_current_market_data)));

    graph_insert()
    if (n === 0) {
        buy_btc(initial_balance)
        // print_balances()
    }
}
function get_data_ticker_online(range) {
    console.log(dateStr + " - REQUESTING TICKER ")

    var last_date = raw_array_online_array_data[raw_array_online_array_data.length - 1][0];
    var lastDateRecorded = raw_array_online_array_data[raw_array_online_array_data.length - 1][0];
    var next_date = last_date + 1000 * 60 * 5;
    var params = {limit: 10}
    var str_params = object_to_url_param(params)
    var url = "https://api.bitfinex.com/v2/candles/trade:" + range + ":tBTCUSD/hist?" + str_params

    http_request({url: url, method: 'GET'}, function (data, params) {

        if (!data) {
            get_data_ticker_online(range)
            console.log('FATAL ERROR, DATA not retrieved')

        } else {

            var new_scrapped_array_data = []
            // getLastStepTimestamp()
            for (var n = 0; n < data.length; n++) {
                if (data[n][0] > lastDateRecorded) {
                    if ((data[n][0] + 1000 * 60 * 5) < now) {
                        new_scrapped_array_data.push(data[n])
                    }
                } else {
                    break;
                }
            }
            new_scrapped_array_data.reverse()
            raw_array_online_array_data = raw_array_online_array_data.concat(new_scrapped_array_data);

            if (new_scrapped_array_data.length === 0) {
                console.log(dateStr + " - NO NEW TICKER ")

                online_data_mainlooper_bitfinex() //go back to loop
            } else {
                if (new_scrapped_array_data.length > 1) {
                    for (var m = 0; m < new_scrapped_array_data.length - 2; m++) {
                        create_cleaned_obj_current_market_data_bitfinex(new_scrapped_array_data[m])
                        create_indicators()
                    }
                }
                if (new_scrapped_array_data.length === 1) {

                }
                create_cleaned_obj_current_market_data_bitfinex(raw_array_online_array_data[raw_array_online_array_data.length - 1])
                create_indicators()
                save_live_quote('bitfinex', range)

                offline_trade_sudden_growth_difference_from_moving_average()
                // offline_trade_sudden_growth_min_step()
                // offline_trade_sudden_growth_daily()
                // offline_trade_moving_average()
                // offline_trade_moving_average_with_anti_loss()
                // offline_trade_moving_average_comparaison()

                online_data_mainlooper_bitfinex() //go back to loop
            }
        }
        // console.log(data.trades[0], params)
    }, params)
}
function online_data_mainlooper_bitfinex() {
    getLastStepTimestamp()

    console.log(dateStr + " *************************************NEXT FRAME**********************")
    print_balances()
    print_bilan()
    print_profit()


    var nextRequestDataDate = lastStepTimestamp + (1000 * 60 * 5) //adding 5 minutes to the last 5m step timestamp
    var timeout_before_request = nextRequestDataDate - now //future minus now equal time left in millis

    //******* REMOVE THIS TEST
    var offset_delay = 5000; //do not run the requester exactely on the minute change, rather add a small delay
    timeout_before_request = ((now - now % (1000 * 60)) + (1000 * 60 * 1))  - now + offset_delay
    //******
    console.log(dateStr + " - NEXT TICKER: ", "Will request ticker in  " + timeout_before_request + ' millis')

    setTimeout(function () {
        get_data_ticker_online('5m')
    }, timeout_before_request)
}

function getLastStepTimestamp() {
    now = new Date();
    dateStr = dateFormat(now, "dd/mm/yy-hh:MM:ss");
    lastStepTimestamp = now - now % (1000 * 60 * 5) //the last 5 minute timestamp
}
function simulation_online() {
    // initial_balance = 2735.60;
    // initial_balance = 675;
    isOnline = true;
    zar_balance = initial_balance
    getLastStepTimestamp()
    startTickerLoggingTimestamp = lastStepTimestamp - (1000 * 60 * 60 * 24 * 2 ) //the timestamp two days until the laststeptimestamp

    dateStr = dateFormat(now, "dd/mm/yy-hh:MM:ss");

    console.log( dateStr + " - SET: ", "Initial balance set to " + initial_balance + " ZAR")

    fill_past_data_for_indicators(lastStepTimestamp, startTickerLoggingTimestamp, '5m')

    // graphOnline()
    // print_bilan()
}
function fill_past_data_for_indicators(to_date, from_date, range) {
    // https://api.bitfinex.com/v2/candles/trade:30m:tBTCUSD/hist?start=1509828547000&end=1512028800000&limit=1000

    var params = {limit: 1000, end: to_date}
    var str_params = object_to_url_param(params)
    var url = "https://api.bitfinex.com/v2/candles/trade:" + range + ":tBTCUSD/hist?" + str_params

    http_request({url: url, method: 'GET'}, function (data, params) {

        if (!data) {
            var next_date = raw_array_online_array_data[raw_array_online_array_data.length - 1][0];
            fill_past_data_for_indicators(next_date, from_date, range)
        } else {

            // console.log(data.candles.length)
            raw_array_online_array_data = raw_array_online_array_data.concat(data);
            var next_date = data[data.length - 1][0];
            if (next_date > from_date) {
                setTimeout(function () {
                    fill_past_data_for_indicators(next_date, from_date, range)
                }, 1250)
            } else {
                raw_array_online_array_data.reverse()
                raw_array_online_array_data.pop()

                for (var n = 0; n < raw_array_online_array_data.length; n++) {
                    create_cleaned_obj_current_market_data_bitfinex(raw_array_online_array_data[n])
                    create_indicators(n)
                }
                save_live_quote('bitfinex', range)
                online_data_mainlooper_bitfinex()
            }
        }
        // console.log(data.trades[0], params)
    }, params)

}


//FEATURES
// simulation_offline() //simulate the  offline downloaded data from  './quote/from_1480550400to_1512100800quote.json'
//
simulation_online()
// start(); //perform ticker tracking in real time and apply buy or sell strategy using API and keys
// scrap_quote_luno(from_date) //from https://www.luno.com/ajax/1/candles?pair=XBTZAR&since=1500867510&duration=1800