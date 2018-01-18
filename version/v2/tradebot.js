const request = require('request')
const BitX = require('bitx')
const fs = require('fs')
var dateFormat = require('dateformat');
var bitx = new BitX()
const plotter = require('./helper/plotter.js')
const sql_helper = require('./helper/sql_helper.js')
const bitfinex_rest = require('./helper/api/bitfinex_rest')

var http = require('http');
var path = require('path');

var async = require('async');
var express = require('express');

var DataMiner = require('./helper/data_miner.js')

class Tradebot {

    constructor(settings) {


        if (settings.candle_size === undefined) {
            settings.candle_size = '5m'
        }
        if (settings.asset === undefined) {
            settings.asset = 'BTC'
        }
        if (settings.currency === undefined) {
            settings.currency = 'USD'
        }
        if (settings.exchange === undefined) {
            settings.exchange = 'Bitfinex'
        }
        if (settings.available_since === undefined) {
            settings.available_since = 1480550400
        }
        if (settings.available_until === undefined) {
            settings.available_until = new Date().getTime() / 1000
        }

        this.candle_size = settings.candle_size
        this.asset = settings.asset
        this.currency = settings.currency
        this.exchange = settings.exchange

        this.from_date = settings.available_since;
        this.to_date = settings.available_until;

        this.hasPreviouslyReachedAllTimeHigh = false
//Shared vars
        this.zar_balance = 0;
        this.btc_balance = 0;
        this.now;
        this.dateStr;
        this.isSimulation = false;
        this.isOnline = false;
        this.trade_history = []
        this.last_trade_obj = {}
//Real time trader
        this.tickers = []
        //Bot's interfaces
        this.dataminer;

        this.onNewCandles = function () {
            //nothing
        };
        this.onNewCandlesLive = function () {
            //nothing
        };
        this.onInit = function () {
            //nothing
        }
        this.onStop = function () {
            //nothing
        }
        this.EmitStatus = function () {
            //nothing
        }
        this.onTrade = function () {
            //nothing
        }
        //UI and logs
        this.natural_growth
        this.efficiency
        this.artificial_growth
        this.netWorth


        this.local_stat = []
// this.to_date = 1485907200; //1st febrary 2017

//Offline simulation
        this.cleaned_obj_current_market_data = {}
        this.raw_array_offline_array_data = []
        this.raw_array_online_array_data = []
        this.array_scrapped_big_data = [];
        this.cleaned_array_offline_array_data = []
        this.strategy = ""
        this.lastTradeStatus = "";


        this.graph_data = {

            close: {
                id: 'close_serie',
                tooltip: {
                    valueDecimals: 4
                },
                data: [],
                type: 'line',
                name: 'close'
            },

            ma24h: {
                data: [],
                type: 'line',
                name: 'ma24h'
            },
            ma1h: {
                data: [],
                type: 'line',
                name: 'ma1h'
            },


            sell: {
                type: 'flags',
                onSeries: 'close_serie',
                shape: 'squarepin',
                width: 16,
                data: [],
                mode: "markers",
                name: 'sell',
            },
            buy: {
                type: 'flags',
                onSeries: 'close_serie',
                shape: 'circlepin',
                width: 16,
                data: [],
                mode: "markers",
                name: 'buy',
            },
            allTimeHigh: {
                x: [],
                y: [],
                type: 'scatter',
                mode: "markers",
                name: 'this.allTimeHigh',
                marker: {
                    size: 12,
                }

            },


            change_bal: {
                x: [],
                y: [],
                type: 'bar',
                name: 'change_bal',

            },

            profit: {
                x: [],
                y: [],
                type: 'scatter',
                name: 'profit'
            },
        };
        this.dataset_path = "";
        this.total_counter_trade = 0;

        this.test_log = require("./analysis/test_log.json") || []

//USER SETTINGS
        this.paper = {}
        this.paper.initial_balance = 730.61 * 5; //3653.05
        this.paper.fee = 0.2; //already in percent (which means you have to divide by 100 if you want to use it in calculation)

        this.parameters = {}
        if (settings.parameters === undefined) {
            settings.available_until = new Date().getTime() / 1000
            this.parameters.trade_risk = 0.09;
            this.parameters.upper_trade_risk = 0.01//Used to define when to sell after this.paper.fees are cleared
            this.parameters.lower_trade_risk = 0.002//Used to define when to buy after this.paper.fees are cleared
            this.parameters.trade_risk_negative = -0.01; //Same as this.parameters.trade_risk, used to define when to buy
        } else {
            this.parameters = settings.parameters
        }

        this.expiry_buy_wait = 1 * 60 * 60 * 1000;
//END USER SETTINGS
        this.last_buy_price, this.last_sell_price;
        this.profit_after_sell = 0;
        this.mode = 'waiting_for_sell';
        this.step_before_sell = -1; //random number, just for set in sudden growth min_step this.strategy
        this.allTimeHighCounter, this.newAllTimeHighCounter = 0;


        this.allTimeHigh = -1;
        this.isAllTimeHigh = 0;

        this.last_zar_balance;
        this.cummulative_profit = 0;
        this.startTickerLoggingTimestamp = -1;
        this.lastStepTimestamp = -1;
    }

    http_request(headers_params, cb, params) {
        console.log(headers_params)
        request(headers_params
            , function (error, response, body) {
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
                    cb(error, params)
                }
            })
    }

    create_dir(dir, cb) {
        if (!fs.existsSync(dir)) {
            fs.mkdir(dir, function (err) {
                cb()
                console.log('Dir created')
            });
        } else {
            cb()
        }
    }

    save_quote(subfolder, range) {
        if (!range) {
            range = ""
        }
        var dir = './quote/' + subfolder + "/";
        this.create_dir(dir, function (err) {
            if (err) {
                console.log('failed to create directory', err);
            } else {
                console.log('Directory created')
                var filename = dir + 'from_' + this.from_date + 'to_' + this.to_date + "_" + range + 'quote.json'
                fs.writeFile(filename, JSON.stringify(this.array_scrapped_big_data, null, 2));
                console.log('Quote saved! to', filename)
            }
        })
    }

    save_live_quote(subfolder, range) {
        return
        if (!range) {
            range = ""
        }
        var dir = './quote/live/' + subfolder + "/";
        this.create_dir(dir, function (err) {
            if (err) {
                console.log('failed to create directory', err);
            } else {
                console.log('Directory created')
                var filename = dir + 'from_' + this.from_date + 'to_' + this.to_date + "_" + range + 'quote.json'
                var filename_indicators = dir + 'last_indicators' + range + 'quote.json'
                var filename_tickers = dir + 'last_this.tickers' + range + 'quote.json'
                fs.writeFile(filename_indicators, JSON.stringify(this.cleaned_array_offline_array_data, null, 2));
                fs.writeFile(filename_tickers, JSON.stringify(this.raw_array_online_array_data, null, 2));
                console.log('Quote saved! to', filename)
            }
        })
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

    test_api() {
        var params = {}
        var url = "https://api.mybitx.com/api/1/trades?pair=XBTZAR"

        this.http_request({url: url, method: 'GET'}, function (data, params) {

            for (var n = 0; n < data.trades.length - 1; n++) {
                var change = data.trades[n + 1].price - data.trades[n].price;
                var growth = change / data.trades[n].price * 100
                console.log(growth)
            }
            // console.log(data.trades[0], params)
        }, params)

    }

    scrap_quote_luno(from) {
        var params = {pair: "XBTZAR", since: from, duration: 1800}
        var str_params = this.object_to_url_param(params)
        var url = "https://www.luno.com/ajax/1/candles?" + str_params

        this.http_request({url: url, method: 'GET'}, function (data, params) {

            // console.log(data.candles.length)
            this.array_scrapped_big_data = this.array_scrapped_big_data.concat(data.candles);
            var next_date = data.candles[(data.candles.length) - 1].timestamp;
            if (next_date < this.to_date) {
                this.scrap_quote_luno(next_date)
            } else {
                this.save_quote("luno")
            }
            // console.log(data.trades[0], params)
        }, params)

    }

    recordTicker(ticker) {
        this.tickers.push(ticker)
    }

    setup() {

        this.paper.initial_balance = this.paper.initial_balance;
        console.log("SET: " + this.dateStr + " - ", "Initial balance set to " + this.paper.initial_balance + " ZAR")
    }

    start() {

        this.now = new Date();
        this.dateStr = dateFormat(this.now, "dd/mm/yy-hh:MM:ss");
        this.setup();

        var currentTimeStamp = new Date().getTime();
        var startTimeout = 60 * 1000 - currentTimeStamp % (1000 * 60)

        console.log("SET: " + this.dateStr + " - ", "Will start looper in " + startTimeout + " millis")
        setTimeout(this.mainLoop_real_time_api, startTimeout)
    }

    checkTransaction() {

    }

    getTicker() {
        bitx.getTicker(function (err, ticker) {
            if (err) {
                throw err
            }
            if (typeof (ticker) != 'undefined') {

                this.now = new Date();
                this.dateStr = dateFormat(this.now, "dd/mm/yy-hh:MM:ss");

                console.log("TIC: " + this.dateStr + " - ",
                    "Ask: " + ticker.ask + ", "
                    + "Bid: " + ticker.bid
                    + ", " + "Last Trade: " + ticker.last_trade);

                this.recordTicker(ticker)
                this.checkTransaction()
            } else {
                console.log("ERR: " + this.dateStr + " - ", "Error getting Ticker");
            }
        });
    }

    mainLoop_real_time_api() {
        setInterval(this.getTicker, 60 * 1000);
    }

    AddZero(num) {
        return (num >= 0 && num < 10) ? "0" + num : num + "";
    }

    date_time_formatter(d) {

        return [d.getFullYear(),
                this.AddZero(d.getMonth() + 1),
                this.AddZero(d.getDate())].join('-') + ' ' +
            [this.AddZero(d.getHours()),
                this.AddZero(d.getMinutes()), this.AddZero(d.getSeconds())].join(':');
    }

    graph_insert() {

        this.graph_data.close.data.push([this.cleaned_obj_current_market_data.timestamp, this.cleaned_obj_current_market_data.close_price])

        this.graph_data.ma24h.data.push([this.cleaned_obj_current_market_data.timestamp, this.cleaned_obj_current_market_data.ma24h])

        this.graph_data.ma1h.data.push([this.cleaned_obj_current_market_data.timestamp, this.cleaned_obj_current_market_data.ma1h])

    }

    create_cleaned_obj_current_market_data_luno(rawArrayOfflineArrayDatum) {
        try {

            this.cleaned_obj_current_market_data.average_price =
                (Number(rawArrayOfflineArrayDatum.open) +
                Number(rawArrayOfflineArrayDatum.close) +
                Number(rawArrayOfflineArrayDatum.high) +
                Number(rawArrayOfflineArrayDatum.low))
                / 4;

            this.cleaned_obj_current_market_data.timestamp = rawArrayOfflineArrayDatum.timestamp * 1000

        } catch (e) {
            console.log("Cannot clean dataset")
            console.error(e)
            process.exit();

        }
    }

    create_cleaned_obj_current_market_data_bitfinex(rawArrayOfflineArrayDatum) {

        /*
         MTS,
         OPEN,
         CLOSE,
         HIGH,
         LOW,
         VOLUME
         */
        try {

            this.cleaned_obj_current_market_data.average_price =
                ((rawArrayOfflineArrayDatum[1]) +
                (rawArrayOfflineArrayDatum[2]) +
                (rawArrayOfflineArrayDatum[3]) +
                (rawArrayOfflineArrayDatum[4]))
                / 4;
            this.cleaned_obj_current_market_data.close_price = rawArrayOfflineArrayDatum[2]
            //Remove the below line later
            this.cleaned_obj_current_market_data.average_price = this.cleaned_obj_current_market_data.close_price
            //End remove
            this.cleaned_obj_current_market_data.timestamp = rawArrayOfflineArrayDatum[0]
            this.cleaned_obj_current_market_data.volume = rawArrayOfflineArrayDatum[5]

        } catch (e) {
            console.log("Cannot clean dataset")
            console.error(e)
            process.exit();
        }
    }

    setAllTimeHigh() {
        if (this.cleaned_obj_current_market_data.close_price > this.allTimeHigh) {
            this.allTimeHigh = this.cleaned_obj_current_market_data.close_price
            this.isAllTimeHigh = 1
            this.allTimeHighCounter++;
            this.newAllTimeHighCounter++;

            this.graph_data.allTimeHigh.x.push(this.date_time_formatter(new Date(this.cleaned_obj_current_market_data.timestamp)))
            this.graph_data.allTimeHigh.y.push(this.cleaned_obj_current_market_data.close_price)

            // console.log(this.newAllTimeHighCounter, 'New All time high')
        } else {
            if (this.cleaned_obj_current_market_data.close_price === this.allTimeHigh) {
                // console.log('touching the previous all time high again')
                this.allTimeHighCounter++;
                this.isAllTimeHigh = 2
            } else {
                this.isAllTimeHigh = 0
            }
        }
    }

    offline_data_mainlooper_bitfinex() {
        var hours_step_size = 1 * 2 * 2 * 3;
        var daily_step_size = 24 * 2 * 2 * 3;
        var range = this.candle_size;
        switch (range) {
            case '1m':
                hours_step_size = 60;
                break;
            case '5m':
                hours_step_size = 12;
                break;
            case '15m':
                hours_step_size = 4;
                break;
            case '1h':
                hours_step_size = 1;
                break;
            case '3h':
                hours_step_size = 1;
                break;
        }

        daily_step_size = hours_step_size * 24;


        //OFFLINE SIMULATION MAINLOOPER
        this.onInit({
            status: {state: 'Trading', msg: 'hello'},
            start_time: this.raw_array_offline_array_data[0].start,
            start_price: this.raw_array_offline_array_data[0].close,
            start_asset_balance: this.btc_balance,
            start_currency_balance: this.zar_balance,
        })

        for (var n = 0; n < this.raw_array_offline_array_data.length; n++) {

            this.cleaned_obj_current_market_data = this.raw_array_offline_array_data [n]
            this.cleaned_obj_current_market_data.average_price = this.cleaned_obj_current_market_data.close
            this.cleaned_obj_current_market_data.close_price = this.cleaned_obj_current_market_data.close
            this.cleaned_obj_current_market_data.timestamp = this.cleaned_obj_current_market_data.start * 1000
            delete this.cleaned_obj_current_market_data.close;
            delete this.cleaned_obj_current_market_data.start;

            if (n > 0) {
                this.cleaned_obj_current_market_data.min_step_change = (this.cleaned_obj_current_market_data.close_price - this.cleaned_array_offline_array_data[n - 1].close_price) / this.cleaned_array_offline_array_data[n - 1].close_price
            }
            if (n >= hours_step_size) {
                this.cleaned_obj_current_market_data.hourly_growth = (this.cleaned_obj_current_market_data.average_price - this.cleaned_array_offline_array_data[n - hours_step_size].average_price) / this.cleaned_array_offline_array_data[n - hours_step_size].average_price

//calculating the moving average
                var sum = this.cleaned_obj_current_market_data.close_price;
                for (var i = 1; i < hours_step_size; i++) {
                    sum = sum + this.cleaned_array_offline_array_data[n - i].average_price
                }
                // console.log(sum)
                this.cleaned_obj_current_market_data.ma1h = sum / hours_step_size;
                // console.log(cleaned_data.hourly_growth, cleaned_data.average_price +" "+cleaned_offline_data[n - 2].average_price)
            }
            if (n >= daily_step_size) {
                this.cleaned_obj_current_market_data.daily_growth = (this.cleaned_obj_current_market_data.average_price - this.cleaned_array_offline_array_data[n - daily_step_size].average_price) / this.cleaned_array_offline_array_data[n - daily_step_size].average_price

                //calculating the moving average
                var sum = this.cleaned_obj_current_market_data.close_price;
                for (var i = 1; i < daily_step_size; i++) {
                    sum = sum + this.cleaned_array_offline_array_data[n - i].average_price
                }
                // console.log(sum)
                this.cleaned_obj_current_market_data.ma24h = sum / daily_step_size;
            }

            if (n >= daily_step_size * 2) {
                this.cleaned_obj_current_market_data.daily_ma24h_growth = (this.cleaned_obj_current_market_data.ma24h - this.cleaned_array_offline_array_data[n - daily_step_size].ma24h) / this.cleaned_array_offline_array_data[n - daily_step_size].ma24h
                // console.log( this.cleaned_obj_current_market_data.daily_ma24h_growth)
            }
            if (n >= hours_step_size * 2) {
                this.cleaned_obj_current_market_data.daily_ma1h_growth = (this.cleaned_obj_current_market_data.ma1h - this.cleaned_array_offline_array_data[n - hours_step_size].ma1h) / this.cleaned_array_offline_array_data[n - hours_step_size].ma1h
                // console.log( this.cleaned_obj_current_market_data.daily_ma1h_growth)
            }

            this.cleaned_array_offline_array_data.push(JSON.parse(JSON.stringify(this.cleaned_obj_current_market_data)));

            this.setAllTimeHigh()
            this.graph_insert()
            if (n === 0) {
                this.allTimeHigh = this.cleaned_obj_current_market_data.close_price;
                // this.mode = 'waiting_for_buy'
                this.buy_btc(this.paper.initial_balance)
                // this.print_balances()
            }

            // ## USED this.strategy##
            // offline_trade_sudden_growth_buy_sell_difference_from_moving_average();
            // offline_trade_sudden_growth_difference_from_moving_average_no_sell_low()
            // offline_trade_sudden_growth_difference_from_moving_average()
            // offline_trade_sudden_growth_min_step()
            // offline_trade_sudden_growth_daily()
            // offline_trade_moving_average()
            // offline_trade_moving_average_with_anti_loss()
            // offline_trade_moving_average_comparaison()
            // offline_trade_all_time_high_watcher()
            this.offline_trade_micro_trade()
            this.setGrowth()
            this.setEfficiency()
            this.onNewCandles(this.getLastCandleUpdate())
        }
    }

    getTimeSpan() {
        return this.cleaned_obj_current_market_data.timestamp - this.from_date
    }

    offline_data_mainlooper_luno() {
        this.dataset_path = './quote/luno/from_1480550400to_1512100800quote.json';
        this.raw_array_offline_array_data = require(this.dataset_path)
        for (var n = 0; n < this.raw_array_offline_array_data.length; n++) {
            this.create_cleaned_obj_current_market_data_luno(this.raw_array_offline_array_data[n])

            if (n >= 2) {
                this.cleaned_obj_current_market_data.hourly_growth = (this.cleaned_obj_current_market_data.average_price - this.cleaned_array_offline_array_data[n - 2].average_price) / this.cleaned_array_offline_array_data[n - 2].average_price

                // console.log(cleaned_data.hourly_growth, cleaned_data.average_price +" "+cleaned_offline_data[n - 2].average_price)
            }
            if (n >= 48) {
                this.cleaned_obj_current_market_data.daily_growth = (this.cleaned_obj_current_market_data.average_price - this.cleaned_array_offline_array_data[n - 48].average_price) / this.cleaned_array_offline_array_data[n - 48].average_price
            }

            this.cleaned_array_offline_array_data.push(JSON.parse(JSON.stringify(this.cleaned_obj_current_market_data)));
            this.graph_insert()

            if (n == 0) {
                this.buy_btc(this.paper.initial_balance)
                // this.print_balances()
            }
            this.offline_trade_sudden_growth_min_step()
        }
    }

    print_profit() {

        console.log(this.dateStr + " - PROF: ", "Profit: " + this.profit_after_sell + ", Cummulative Profit: " + this.cummulative_profit)

        this.graph_data.change_bal.x.push(this.date_time_formatter(new Date(this.cleaned_obj_current_market_data.timestamp)))
        this.graph_data.change_bal.y.push(this.profit_after_sell)

        this.graph_data.profit.x.push(this.date_time_formatter(new Date(this.cleaned_obj_current_market_data.timestamp)))
        this.graph_data.profit.y.push(this.cummulative_profit)
    }

    afterSell() {
        this.setGrowth()
        this.setEfficiency()

        this.last_trade_obj.sell = {
            time: this.date_time_formatter(new Date(this.cleaned_obj_current_market_data.timestamp)),
            timestamp: (this.cleaned_obj_current_market_data.timestamp),
            price: this.cleaned_obj_current_market_data.average_price,
            status: this.lastTradeStatus,
            profit: -this.paper.fee / 100 + (this.cleaned_obj_current_market_data.close_price - this.last_buy_price) / this.last_buy_price,
            efficiency: this.efficiency,
            type: 'sell',
            exposure: this.getExposure(),//if exit only,
            asset_balance: this.btc_balance,
            currency_balance: this.zar_balance,
        };

        this.afterTrade(this.last_trade_obj.sell)


        this.trade_history.push(JSON.parse(JSON.stringify(this.last_trade_obj)))

        console.log("==========================*********===================== end trade", this.total_counter_trade)
    }

    setGrowth() {
        this.netWorth = this.zar_balance + this.btc_balance * this.cleaned_obj_current_market_data.average_price
        this.artificial_growth = 100 * (this.netWorth - this.paper.initial_balance) / this.paper.initial_balance

        var initial_buy_price
        if (typeof this.trade_history[0] === typeof undefined) {
            initial_buy_price = this.cleaned_obj_current_market_data.average_price
        } else {
            initial_buy_price = this.trade_history[0].buy.price
        }
        this.natural_growth = 100 * (this.cleaned_obj_current_market_data.average_price - initial_buy_price ) / initial_buy_price

    }

    setEfficiency() {
        var signOfnaturalGrowth = this.natural_growth / (Math.abs(this.natural_growth))
        this.efficiency = 1 + ( this.artificial_growth - this.natural_growth) * signOfnaturalGrowth / this.natural_growth
        var currentAssetWorth = this.zar_balance / this.cleaned_obj_current_market_data.average_price + this.btc_balance
        var initial_asset_worth
        if (typeof this.trade_history[0] === typeof undefined) {
            initial_asset_worth = this.zar_balance
        } else {
            initial_asset_worth = this.trade_history[0].buy.asset_balance
        }
        this.efficiency = 1 + (currentAssetWorth - initial_asset_worth) / initial_asset_worth
    }

    afterTrade(trade) {

        this.onTrade({
            total_counter_trade: this.total_counter_trade,
            efficiency: this.efficiency,
            roundtrips: this.getRoundTrips(),
            trade: trade
        })
    }

    sell_btc(crypto_cash) {

        this.now = this.cleaned_obj_current_market_data.timestamp;
        this.dateStr = dateFormat(this.now, "dd/mm/yy-hh:MM:ss");

        if (crypto_cash > 0) {
            this.last_sell_price = this.cleaned_obj_current_market_data.average_price

            this.total_counter_trade++;

            this.graph_data.sell.data.push({
                text: 'Sell @' + this.cleaned_obj_current_market_data.average_price,
                x: this.cleaned_obj_current_market_data.timestamp,
                title: 'S'
            })


            // this.last_trade_obj = {}

            this.zar_balance = this.zar_balance + (crypto_cash - crypto_cash * this.paper.fee / 100) * this.cleaned_obj_current_market_data.average_price;
            this.btc_balance = this.btc_balance - crypto_cash;

            console.log("SELL: " + this.dateStr + " - ", "Has Sold BTC " + crypto_cash + " @ " + this.cleaned_obj_current_market_data.average_price + " with all BTC of: " + crypto_cash + " " + this.cleaned_obj_current_market_data.timestamp)
            this.print_balances()

            this.profit_after_sell = (this.zar_balance - this.last_zar_balance )
            this.cummulative_profit = this.cummulative_profit + this.profit_after_sell
            this.print_profit()
            this.afterSell()

        } else {
            // console.log("cannot sell")
        }
    }


    buy_btc(fiat_cash) {

        this.now = this.cleaned_obj_current_market_data.timestamp;
        this.dateStr = dateFormat(this.now, "dd/mm/yy-hh:MM:ss");
        if (fiat_cash > 0) {
            this.last_buy_price = this.cleaned_obj_current_market_data.average_price

            this.total_counter_trade++;

            this.graph_data.buy.data.push({
                text: 'Buy @' + this.cleaned_obj_current_market_data.average_price,
                x: this.cleaned_obj_current_market_data.timestamp,
                title: 'B'
            })

            this.last_zar_balance = this.zar_balance
            this.btc_balance = this.btc_balance + (fiat_cash - fiat_cash * this.paper.fee / 100) / this.cleaned_obj_current_market_data.average_price;
            this.zar_balance = this.zar_balance - fiat_cash;

            console.log("BUY: " + this.dateStr + " - ", "Has Bough BTC " + this.btc_balance + " @ " + this.cleaned_obj_current_market_data.average_price + " with all ZAR of: " + fiat_cash)
            this.print_balances()
            this.afterBuy()
        } else {
            // console.log("cannot buy")
        }
    }

    afterBuy() {
        this.setGrowth()
        this.setEfficiency()

        this.last_trade_obj.buy = {
            time: this.date_time_formatter(new Date(this.cleaned_obj_current_market_data.timestamp)),
            timestamp: (this.cleaned_obj_current_market_data.timestamp),
            price: this.cleaned_obj_current_market_data.average_price,
            status: this.lastTradeStatus,
            profit: (-this.paper.fee / 100 - (this.cleaned_obj_current_market_data.close_price - this.last_sell_price) / this.last_sell_price),
            efficiency: this.efficiency,
            type: 'buy',
            exposure: null,//if exit only,
            asset_balance: this.btc_balance,
            currency_balance: this.zar_balance,
        };

        this.afterTrade(this.last_trade_obj.buy)


    }

    print_balances() {
        if (this.isOnline) {
            this.now = new Date().getTime()
        } else {
            this.now = this.cleaned_obj_current_market_data.timestamp;
        }
        this.dateStr = dateFormat(this.now, "dd/mm/yy-hh:MM:ss");
        console.log(this.dateStr + " - BALANCE:  ", "BTC: " + this.btc_balance + " ZAR: " + this.zar_balance)
    }

    offline_trade_sudden_growth_buy_sell_difference_from_moving_average() {
        this.strategy = "sudden growth distance percentage peak of ticker close vs 24h moving average"
        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {
            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data.ma24h
            var distance_close_sma_percentage_from_sma = distance_close_sma / this.cleaned_obj_current_market_data.ma24h;
            this.local_stat.push(distance_close_sma_percentage_from_sma)

            if (this.mode === 'waiting_for_buy') {
                if (distance_close_sma_percentage_from_sma < this.parameters.trade_risk_negative) {
                    console.log('buy!!!!!', distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_sma_percentage_from_sma > this.parameters.trade_risk) {
                    console.log('sell!!!!!', distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_buy';
                    this.sell_btc(this.btc_balance)

                }
            }

        }
    }

    offline_trade_sudden_growth_difference_from_moving_average() {
        this.strategy = "sudden growth distance percentage peak of ticker close vs 24h moving average"
        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {
            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data.ma24h
            var distance_close_sma_percentage_from_sma = distance_close_sma / this.cleaned_obj_current_market_data.ma24h;
            this.local_stat.push(distance_close_sma_percentage_from_sma)

            if (this.mode === 'waiting_for_buy') {
                if (distance_close_sma_percentage_from_sma > -this.parameters.lower_trade_risk && distance_close_sma_percentage_from_sma < this.parameters.lower_trade_risk) {
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_sma_percentage_from_sma > this.parameters.trade_risk) {
                    console.log('sell!!!!!', distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_buy';
                    this.sell_btc(this.btc_balance)
                }
            }

        }
    }

    offline_trade_sudden_growth_difference_from_moving_average_no_sell_low() {
        this.strategy = "sudden growth distance percentage peak of ticker close vs 24h moving average and never sell lower than last buy price"
        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {
            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data.ma24h
            var distance_close_sma_percentage_from_sma = distance_close_sma / this.cleaned_obj_current_market_data.ma24h;
            this.local_stat.push(distance_close_sma_percentage_from_sma)

            if (this.mode === 'waiting_for_buy') {
                if (distance_close_sma_percentage_from_sma > -this.parameters.lower_trade_risk && distance_close_sma_percentage_from_sma < this.parameters.lower_trade_risk) {
                    console.log('buy!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_sma_percentage_from_sma > this.parameters.trade_risk) {
                    if (this.cleaned_obj_current_market_data.close_price > this.last_buy_price) { //second condition
                        console.log('sell!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                        this.mode = 'waiting_for_buy';
                        this.sell_btc(this.btc_balance)

                    }
                }
            }

        }
    }

    offline_trade_all_time_high_watcher() {
        this.strategy = " this.strategy all time high watcher "

        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {
            // if(this.isAllTimeHigh===1){
            //
            //     hasPreviouslyReachedAllTimeHigh = true
            //     console.log(this.cleaned_obj_current_market_data.timestamp+" "+this.cleaned_obj_current_market_data.ma24h,this.cleaned_obj_current_market_data.ma1h+" "+this.cleaned_obj_current_market_data.min_step_change+" "+this.cleaned_obj_current_market_data.volume)
            // }else {
            //     if(hasPreviouslyReachedAllTimeHigh){
            //         console.log(this.cleaned_obj_current_market_data.timestamp+" "+this.cleaned_obj_current_market_data.ma24h,this.cleaned_obj_current_market_data.ma1h+" "+this.cleaned_obj_current_market_data.min_step_change+" "+this.cleaned_obj_current_market_data.volume+" #");
            //     }
            //     hasPreviouslyReachedAllTimeHigh = false
            // }
            // return;
            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data.ma24h
            var distance_close_sma_percentage_from_sma = distance_close_sma / this.cleaned_obj_current_market_data.ma24h;
            this.local_stat.push(distance_close_sma_percentage_from_sma)

            if (this.mode === 'waiting_for_buy') {
                if (distance_close_sma_percentage_from_sma > -this.parameters.lower_trade_risk && distance_close_sma_percentage_from_sma < this.parameters.lower_trade_risk) {
                    console.log('buy!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_sma_percentage_from_sma > this.parameters.trade_risk) {
                    if (this.cleaned_obj_current_market_data.close_price > this.last_buy_price && this.isAllTimeHigh) { //second condition
                        console.log('sell!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                        this.mode = 'waiting_for_buy';
                        this.sell_btc(this.btc_balance)

                    }
                }
            }

        }
    }

    offline_trade_micro_trade() {
        this.strategy = " this.strategy micro trader + sudden growth from moving average"

        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {

            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data.ma24h
            var distance_close_sma_percentage_from_sma = distance_close_sma / this.cleaned_obj_current_market_data.ma24h;
            this.local_stat.push(distance_close_sma_percentage_from_sma)

            if (this.mode === 'waiting_for_buy') {
                var hasExpired = (this.cleaned_obj_current_market_data.timestamp - this.last_trade_obj.sell.timestamp) > this.expiry_buy_wait;
                hasExpired = false;
                if ((this.last_sell_price - this.last_sell_price * this.paper.fee / 100 - this.last_sell_price * this.parameters.lower_trade_risk) > (this.cleaned_obj_current_market_data.close_price ) || hasExpired) {
                    // console.log('buy!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_sell'
                    if ((this.cleaned_obj_current_market_data.timestamp - this.last_trade_obj.sell.timestamp) > this.expiry_buy_wait) {
                        this.lastTradeStatus = 'expired buy';
                    }
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_sma_percentage_from_sma > this.parameters.trade_risk) {
                    if ((this.last_buy_price + this.last_buy_price * this.paper.fee / 100 + this.last_buy_price * this.parameters.upper_trade_risk ) < (this.cleaned_obj_current_market_data.close_price)) { //second condition
                        // console.log('sell!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                        this.mode = 'waiting_for_buy';
                        this.lastTradeStatus = '';
                        this.sell_btc(this.btc_balance)
                    }
                }
            }

        }
    }

    offline_trade_sudden_growth_min_step() {
        this.strategy = "simple step candle sudden growth"
        if (typeof (this.cleaned_obj_current_market_data.min_step_change) !== "undefined") {
            if (this.mode === 'waiting_for_buy') {
                step_before_sell--;
                if (this.step_before_sell === 0) {
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {
                if (this.cleaned_obj_current_market_data.min_step_change < -this.parameters.trade_risk) {
                    console.log('sell!!!!!', this.cleaned_obj_current_market_data.min_step_change)
                    this.mode = 'waiting_for_buy';
                    this.step_before_sell = 24 * 4 * 2 * 3
                    this.sell_btc(this.btc_balance)
                }
            }


        }
    }

    offline_trade_sudden_growth_daily() {
        this.strategy = "simple daily candle sudden growth"
        if (typeof (this.cleaned_obj_current_market_data.daily_growth) !== "undefined") {
            if (this.cleaned_obj_current_market_data.daily_growth > this.parameters.trade_risk) {
                this.buy_btc(this.zar_balance)
            }
            if (this.cleaned_obj_current_market_data.daily_growth < -this.parameters.trade_risk) {
                this.sell_btc(this.btc_balance)
            }
        }
    }

    offline_trade_moving_average() {
        this.strategy = "moving average candle sudden growth 24h"
        if (typeof (this.cleaned_obj_current_market_data.daily_ma24h_growth) !== "undefined") {
            if (this.cleaned_obj_current_market_data.daily_ma24h_growth > this.parameters.trade_risk) {

                // buy_btc(this.zar_balance)
                this.buy_btc(this.zar_balance)

            }
            if (this.cleaned_obj_current_market_data.daily_ma24h_growth < -this.parameters.trade_risk) {

                // sell_btc(this.btc_balance)
                this.sell_btc(this.btc_balance)

            }
        }
    }

    offline_trade_moving_average_sudden_growth() {
        this.strategy = "moving average candle sudden growth 1h"
        if (typeof (this.cleaned_obj_current_market_data.daily_ma1h_growth) !== "undefined") {
            if (this.cleaned_obj_current_market_data.daily_ma1h_growth > this.parameters.trade_risk) {

                this.buy_btc(this.zar_balance)

            }
            if (this.cleaned_obj_current_market_data.daily_ma1h_growth < -this.parameters.trade_risk) {

                this.sell_btc(this.btc_balance)

            }
        }
    }

    offline_trade_moving_average_with_anti_loss() {
        this.strategy = "moving average candle sudden growth with anti loss"
        if (typeof (this.cleaned_obj_current_market_data.daily_ma24h_growth) !== "undefined") {
            if (this.cleaned_obj_current_market_data.daily_ma24h_growth > this.parameters.trade_risk) {
                if (this.cleaned_obj_current_market_data.average_price < this.last_sell_price) {
                    console.log(this.last_sell_price, this.cleaned_obj_current_market_data.average_price)
                    this.buy_btc(this.zar_balance)
                }
            }
            if (this.cleaned_obj_current_market_data.daily_ma24h_growth < -this.parameters.trade_risk) {
                if (this.cleaned_obj_current_market_data.average_price > this.last_buy_price) {
                    console.log(this.last_buy_price, this.cleaned_obj_current_market_data.average_price)
                    this.sell_btc(this.btc_balance)
                }
            }
        }
    }

    offline_trade_moving_average_comparaison() {
        this.parameters.trade_risk = 20
        this.strategy = "moving average candle comparaison"
        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {
            if (typeof (this.cleaned_obj_current_market_data.ma1h) !== "undefined") {
                // var diff = this.cleaned_obj_current_market_data.ma24h - this.cleaned_obj_current_market_data.ma1h
                var diff = this.cleaned_obj_current_market_data.ma24h - this.cleaned_obj_current_market_data.average_price
                // console.log(diff)
                if (diff > this.parameters.trade_risk) {
                    this.sell_btc(this.btc_balance)
                    // sell_btc(this.btc_balance)
                }
                if (diff < -this.parameters.trade_risk) {
                    this.buy_btc(this.zar_balance)
                    // buy_btc(this.zar_balance)
                }
            }
        }
    }

    graphOnline() {
        console.log('GRAPHING ONLINE', 'Waiting....')
        plotter.plot(function () {
            console.log("END SIMULATION")
        }, this.graph_data)
    }

    saveBilan() {

        var filename = './analysis/test_log.json';
        var filename_local_stat = './analysis/local_stat_log.json';
        var filename_history_stat = './analysis/local_history_log.json';
        fs.writeFile(filename_local_stat, JSON.stringify(this.local_stat, null, 2));
        fs.writeFile(filename_history_stat, JSON.stringify(this.trade_history, null, 2));
        fs.writeFile(filename, JSON.stringify(this.test_log, null, 2));
        console.log(this.dateStr + ' - Quote saved! to' + this.dataset_path, filename)
    }

    print_bilan() {

        console.log(this.dateStr + " -  BILAN ", "this.netWorth: " + this.netWorth + ", Artificial Growth: " + this.artificial_growth + ", Natural Growth " + this.natural_growth + ", Fitness: " + this.efficiency + ", Trade count: " + this.total_counter_trade)

        this.test_log.push({
            "fee": this.paper.fee,
            "Comment": "",
            "Risk": this.parameters.trade_risk,
            "Upper_risk": this.parameters.upper_trade_risk,
            "Lower_risk": this.parameters.lower_trade_risk,
            "Negative_trade_risk": this.parameters.trade_risk_negative,
            "this.paper.initial_balance": this.paper.initial_balance,
            "Dataset": this.dataset_path,
            "this.strategy": this.strategy,
            "this.netWorth": this.netWorth,
            "this.artificial_growth": this.artificial_growth,
            "natural_growth": this.natural_growth,
            "Fitness": this.efficiency,
            "Trade_count": this.total_counter_trade,
        })
        // saveBilan()
    }

    getAllPastChartData(cb) {
        // cb([this.graph_data.close, this.graph_data.buy, this.graph_data.sell])
        cb([this.graph_data.close, this.graph_data.sell, this.graph_data.buy, this.graph_data.ma24h, this.graph_data.ma1h])
        // cb([this.graph_data.close])

    }

    Simulation_offline() {
        this.EmitStatus({state: 'downloading data', msg: 'hello'})
        console.log('Simulation offline started')
        // this.paper.initial_balance = 2735.60;
        // this.paper.initial_balance = 675;
        this.zar_balance = this.paper.initial_balance
        console.log("SET: " + this.dateStr + " - ", "Initial balance set to " + this.paper.initial_balance + " ZAR")

        // making sure that the data are available and downloaded()


        this.dataminer.createSqlByTimeRangeAndMarket(this.exchange, this.asset, this.currency, this.candle_size, this.from_date, this.to_date, (raw) => {

            this.raw_array_offline_array_data = raw
            this.offline_data_mainlooper_bitfinex()
            // this.graphOnline()
            this.print_bilan()
            this.saveBilan()
            this.onStop(this.getLastCandleUpdate())
            this.EmitStatus({state: 'is Done Backtesting', msg: 'hello'})
        })
    }

    on(event, cb) {
        switch (event) {
            case 'init':
                this.onInit = cb
                break;
            case 'candle':
                this.onNewCandles = cb
                break
            case 'candle_live':
                this.onNewCandlesLive = cb
                break
            case 'stop':
                this.onStop = cb
                break
            case 'trade':
                this.onTrade = cb
                break
            case 'status':
                this.EmitStatus = cb
                break
        }
    }


    create_indicators(n) {

        if (typeof n === typeof undefined) {
            n = this.cleaned_array_offline_array_data.length //this is used after fill past data gap resolved
        }
        var hours_step_size = 1 * 2 * 2 * 3;
        var daily_step_size = 24 * 2 * 2 * 3;
        if (n > 0) {
            this.cleaned_obj_current_market_data.min_step_change = (this.cleaned_obj_current_market_data.close_price - this.cleaned_array_offline_array_data[n - 1].close_price) / this.cleaned_array_offline_array_data[n - 1].close_price
        }
        if (n >= hours_step_size) {
            this.cleaned_obj_current_market_data.hourly_growth = (this.cleaned_obj_current_market_data.average_price - this.cleaned_array_offline_array_data[n - hours_step_size].average_price) / this.cleaned_array_offline_array_data[n - hours_step_size].average_price

//calculating the moving average
            var sum = 0;
            for (var i = 1; i <= hours_step_size; i++) {
                sum = sum + this.cleaned_array_offline_array_data[n - i].average_price
            }
            // console.log(sum)
            this.cleaned_obj_current_market_data.ma1h = sum / hours_step_size;
            // console.log(cleaned_data.hourly_growth, cleaned_data.average_price +" "+cleaned_offline_data[n - 2].average_price)
        }
        if (n >= daily_step_size) {
            this.cleaned_obj_current_market_data.daily_growth = (this.cleaned_obj_current_market_data.average_price - this.cleaned_array_offline_array_data[n - daily_step_size].average_price) / this.cleaned_array_offline_array_data[n - daily_step_size].average_price

            //calculating the moving average
            var sum = 0;
            for (var i = 1; i <= daily_step_size; i++) {
                sum = sum + this.cleaned_array_offline_array_data[n - i].average_price
            }
            // console.log(sum)
            this.cleaned_obj_current_market_data.ma24h = sum / daily_step_size;
        }

        if (n >= daily_step_size * 2) {
            this.cleaned_obj_current_market_data.daily_ma24h_growth = (this.cleaned_obj_current_market_data.ma24h - this.cleaned_array_offline_array_data[n - daily_step_size].ma24h) / this.cleaned_array_offline_array_data[n - daily_step_size].ma24h
            // console.log( this.cleaned_obj_current_market_data.daily_ma24h_growth)
        }
        if (n >= hours_step_size * 2) {
            this.cleaned_obj_current_market_data.daily_ma1h_growth = (this.cleaned_obj_current_market_data.ma1h - this.cleaned_array_offline_array_data[n - hours_step_size].ma1h) / this.cleaned_array_offline_array_data[n - hours_step_size].ma1h
            // console.log( this.cleaned_obj_current_market_data.daily_ma1h_growth)
        }

        this.cleaned_array_offline_array_data.push(JSON.parse(JSON.stringify(this.cleaned_obj_current_market_data)));

        this.graph_insert()
        if (n === 0) {
            this.buy_btc(this.paper.initial_balance)
            // this.print_balances()
        }
    }

    get_data_ticker_online(range) {
        console.log(this.dateStr + " - REQUESTING TICKER ")

        var last_date = this.raw_array_online_array_data[this.raw_array_online_array_data.length - 1][0];
        var lastDateRecorded = this.raw_array_online_array_data[this.raw_array_online_array_data.length - 1][0];
        var next_date = last_date + 1000 * 60 * 5;
        var params = {limit: 10}
        var str_params = this.object_to_url_param(params)
        var url = "https://api.bitfinex.com/v2/candles/trade:" + range + ":tBTCUSD/hist?" + str_params

        this.http_request({url: url, method: 'GET'}, function (data, params) {

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
                this.raw_array_online_array_data = this.raw_array_online_array_data.concat(new_scrapped_array_data);

                if (new_scrapped_array_data.length === 0) {
                    console.log(this.dateStr + " - NO NEW TICKER ")

                    this.online_data_mainlooper_bitfinex() //go back to loop
                } else {
                    if (new_scrapped_array_data.length > 1) {
                        for (var m = 0; m < new_scrapped_array_data.length - 2; m++) {
                            this.create_cleaned_obj_current_market_data_bitfinex(new_scrapped_array_data[m])
                            this.create_indicators()
                        }
                    }
                    if (new_scrapped_array_data.length === 1) {

                    }
                    create_cleaned_obj_current_market_data_bitfinex(this.raw_array_online_array_data[this.raw_array_online_array_data.length - 1])
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

    online_data_mainlooper_bitfinex() {
        this.getLastStepTimestamp()

        console.log(this.dateStr + " *************************************NEXT FRAME**********************")
        this.print_balances()
        this.print_bilan()
        this.print_profit()


        var nextRequestDataDate = this.lastStepTimestamp + (1000 * 60 * 5) //adding 5 minutes to the last 5m step timestamp
        var timeout_before_request = nextRequestDataDate - this.now //future minus this.now equal time left in millis

        //******* REMOVE THIS TEST
        var offset_delay = 5000; //do not run the requester exactely on the minute change, rather add a small delay
        timeout_before_request = ((this.now - this.now % (1000 * 60)) + (1000 * 60 * 1)) - this.now + offset_delay
        //******
        console.log(this.dateStr + " - NEXT TICKER: ", "Will request ticker in  " + timeout_before_request + ' millis')

        setTimeout(function () {
            this.get_data_ticker_online('5m')
        }, timeout_before_request)
    }

    getLastStepTimestamp() {
        this.now = new Date();
        this.dateStr = dateFormat(this.now, "dd/mm/yy-hh:MM:ss");
        this.lastStepTimestamp = this.now - this.now % (1000 * 60 * 5) //the last 5 minute timestamp
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

    getAccountBalanceOfPairByExchange(exchange, currency, asset, cb) {
        if (exchange.toLowerCase() === 'bitfinex') {
            bitfinex_rest.getAccountBalanceOfPairByPair(currency, asset, function (err, balances) {
                cb(balances)
            })
        } else {
            cb('No API for this exchange')
        }
    }

    getTradingfeesByExchange(exchange, cb) {
        if (exchange.toLowerCase() === 'bitfinex') {
            bitfinex_rest.getTradingthis.paper.fees(function (fees) {
                cb(this.paper.fees)
            })
        } else {
            cb('No API for this exchange')
        }
    }

    getPairMarketPriceByExchange(exchange, currency, asset, cb) {
        if (exchange.toLowerCase() === 'bitfinex') {
            bitfinex_rest.getPairMarketPrice(currency, asset, function (price) {
                cb(price)
            })
        } else {
            cb('No API for this exchange')
        }
    }


    simulation_online() {
        // this.paper.initial_balance = 2735.60;
        // this.paper.initial_balance = 675;
        this.isOnline = true;
        this.zar_balance = this.paper.initial_balance
        this.getLastStepTimestamp()
        this.startTickerLoggingTimestamp = this.lastStepTimestamp - (1000 * 60 * 60 * 24 * 2 ) //the timestamp two days until the this.lastStepTimestamp

        this.dateStr = dateFormat(this.now, "dd/mm/yy-hh:MM:ss");

        console.log(this.dateStr + " - SET: ", "Initial balance set to " + this.paper.initial_balance + " ZAR")

        this.fill_past_data_for_indicators(this.lastStepTimestamp, this.startTickerLoggingTimestamp, '5m')

        // graphOnline()
        // print_bilan()
    }

    fill_past_data_for_indicators(to_date, from_date, range) {
        // https://api.bitfinex.com/v2/candles/trade:30m:tBTCUSD/hist?start=1509828547000&end=1512028800000&limit=1000

        var params = {limit: 1000, end: this.to_date}
        var str_params = this.object_to_url_param(params)
        var url = "https://api.bitfinex.com/v2/candles/trade:" + range + ":tBTCUSD/hist?" + str_params

        this.http_request({url: url, method: 'GET'}, function (data, params) {

            if (!data) {
                var next_date = this.raw_array_online_array_data[this.raw_array_online_array_data.length - 1][0];
                this.fill_past_data_for_indicators(next_date, this.from_date, range)
            } else {

                // console.log(data.candles.length)
                this.raw_array_online_array_data = this.raw_array_online_array_data.concat(data);
                var next_date = data[data.length - 1][0];
                if (next_date > this.from_date) {
                    setTimeout(function () {
                        this.fill_past_data_for_indicators(next_date, this.from_date, range)
                    }, 1250)
                } else {
                    this.raw_array_online_array_data.reverse()
                    this.raw_array_online_array_data.pop()

                    for (var n = 0; n < this.raw_array_online_array_data.length; n++) {
                        this.create_cleaned_obj_current_market_data_bitfinex(this.raw_array_online_array_data[n])
                        this.create_indicators(n)
                    }
                    this.save_live_quote('bitfinex', range)
                    this.online_data_mainlooper_bitfinex()
                }
            }
            // console.log(data.trades[0], params)
        }, params)

    }


    getRoundTrips() {
        return Math.floor(this.total_counter_trade / 2)
    }

    getExposure() {
        return this.cleaned_obj_current_market_data.timestamp - this.last_trade_obj.buy.timestamp
    }

    getLastCandleUpdate() {
        var obj = {
            current_data_timestamp: this.cleaned_obj_current_market_data.timestamp / 1000,
            timespan: this.getTimeSpan(),
            current_price: this.cleaned_obj_current_market_data.close_price,
            natural_growth: this.natural_growth,
            artificial_growth: this.artificial_growth,
            netWorth: this.netWorth,
            asset_balance: this.btc_balance,
            currency_balance: this.zar_balance,
            efficiency: this.efficiency
        }
        return obj;
    }

    setUpDataMiner(dataminer) {
        this.dataminer = dataminer
    }
}

module.exports = Tradebot
//FEATURES
// simulation_offline() //simulate the  offline downloaded data from  './quote/from_1480550400to_1512100800quote.json'
//
// scrap_quote_bitfinex(this.to_date * 1000, this.from_date * 1000, "15m")

// simulation_online()
// start(); //perform ticker tracking in real time and apply buy or sell this.strategy using API and keys
// this.scrap_quote_luno(this.from_date) //from https://www.luno.com/ajax/1/candles?pair=XBTZAR&since=1500867510&duration=1800


