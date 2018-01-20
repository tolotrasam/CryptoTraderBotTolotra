const request = require('request')
const fs = require('fs')
var dateFormat = require('dateformat');
const plotter = require('./helper/plotter.js')
const sql_helper = require('./helper/sql_helper.js')
const bitfinex_rest = require('./helper/api/bitfinex_rest')

var http = require('http');
var path = require('path');
var utils = require('./helper/utils.js')

var async = require('async');
var express = require('express');

var DataMiner = require('./helper/data_miner.js')
var Indicators = require('./indicators.js')
//
class Tradebot {

    constructor(settings) {

//**************************************** Contructor variables

        if (settings.candle_size === undefined) {
            settings.candle_size = '5m'
        }
        if (settings.asset === undefined) {
            settings.asset = 'BTC'
        }
        if (settings.currency === undefined) {
            settings.currency = 'USD'
        }
        if (settings.exchanges === undefined) {
            settings.exchanges = 'bitfinex'
        }
        if (settings.available_since === undefined) {
            settings.available_since = 1480550400
        }
        if (settings.available_until === undefined) {
            settings.available_until = new Date().getTime() / 1000
        }
        this.settings = settings
        this.candle_size = settings.candle_size
        this.asset = settings.asset
        this.currency = settings.currency
        this.exchange = settings.exchanges
        this.type = 'backtest'
        this.from_date = settings.available_since;
        this.to_date = settings.available_until;
        //STRATEGY
        this.parameters = settings.strategy.parameters
        if (settings.strategy === undefined) {
            console.error('NO PARAMETERS SENT TO BOT')
        }
        //USER SETTINGS
        this.strategy = settings.strategy.name
        this.paper = {}
        this.paper.initial_balance = settings.paper_trader.initial_currency_balance; //3653.05
        this.paper.fee = settings.paper_trader.fee; //already in percent (which means you have to divide by 100 if you want to use it in calculation)


        //****************************************************


//Shared vars
        this.hasPreviouslyReachedAllTimeHigh = false
        this.zar_balance = 0;
        this.btc_balance = 0;
        this.now;
        this.dateStr;
        this.isSimulation = false;
        this.isOnline = false;

//Real time trader

        //Bot's interfaces
        this.dataminer;

        //Interface listeners ***********************************************************

        this.onNewCandles = function () {
            //nothing
        };
        this.onNewCandlesLive = function () {
            //nothing
        };
        this.onInit = function () {
            //nothing
        }
        this.onInitLive = function () {
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

        //****************************************************************************
        //UI and logs
        this.natural_growth
        this.efficiency
        this.artificial_growth
        this.netWorth
        this.lastbotstatus

        this.requiresIndicatorsLoaded = false

        //ARRAYS
        this.cleaned_obj_current_market_data = {test: 'asdf'}
        this.local_stat = [] //contains strategy custom stats
        this.raw_array_data_db_format = [] //contains raw data from database
        this.cleaned_array_offline_array_data = [] //contains calculated data and indicators
        this.trade_history = [] //contains all trades
        this.last_trade_obj = {}
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
            sell: {
                id: 'sell',
                type: 'flags',
                onSeries: 'close_serie',
                shape: 'squarepin',
                width: 16,
                data: [],
                mode: "markers",
                name: 'sell',
            },
            buy: {
                id: 'buy',
                type: 'flags',
                onSeries: 'close_serie',
                shape: 'circlepin',
                width: 16,
                data: [],
                mode: "markers",
                name: 'buy',
            }
        }; //contains chart data,  trade, indicators, ticker
        //END ARRAYS
        this.graph_data_bak = {
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
            }
        }

        this.lastTradeStatus = "";


        this.dataset_path = "";
        this.total_counter_trade = 0;

        this.test_log = require("./analysis/test_log.json") || []

        this.expiry_buy_wait = 1 * 60 * 60 * 1000;

        //END USER SETTINGS
        this.last_buy_price, this.last_sell_price;
        this.profit_after_sell = 0;
        this.mode = 'waiting_for_sell';
        this.IsWAITINGFORSELL = 'waiting_for_sell';
        this.IsWAITINGFORBUY = 'waiting_for_buy';
        this.step_before_sell = -1; //random number, just for set in sudden growth min_step this.strategy
        this.allTimeHighCounter = 0
        this.newAllTimeHighCounter = 0;
        this.continue = true
        this.timeout_before_request

        this.allTimeHigh = -1;
        this.max_step_size_indicator = -1;
        this.isAllTimeHigh = 0;

        this.last_zar_balance;
        this.cummulative_profit = 0;
        this.startTickerLoggingTimestamp = -1;
        this.lastStepTimestamp = -1;
        this.rangeInMinute = this.getThisRangeinMinute()
        this.indicator = new Indicators(this.cleaned_array_offline_array_data, this.cleaned_obj_current_market_data, this.candle_size, this.graph_data)
        this.nickname = this.getNickName()

    }

    getBotSummary() {
        var summary = this.settings
        var start_price = null
        if (typeof this.raw_array_data_db_format[this.raw_array_data_db_format.length - 1] !== typeof undefined) {
            start_price = this.raw_array_data_db_format[this.raw_array_data_db_format.length - 1].close;
        }

        summary.trades = this.trade_history //trade roundtrip table
        summary.status = this.lastbotstatus
        summary.from_date = this.from_date
        summary.current_data_timestamp = this.cleaned_obj_current_market_data.timestamp / 1000
        summary.start_price = start_price;
        summary.nickname = this.nickname

        summary.roundtrips = this.getRoundTrips()
        summary.total_counter_trade = this.total_counter_trade

        var candle_summary = this.getLastCandleUpdate()
        Object.assign(summary, candle_summary)
        return summary
    }

    getInitSummary() {
        var start_price = null
        if (typeof this.raw_array_data_db_format[this.raw_array_data_db_format.length - 1] !== typeof undefined) {
            start_price = this.raw_array_data_db_format[this.raw_array_data_db_format.length - 1].close;
        }
        this.lastbotstatus = {state: 'Trading', msg: 'hello'}
        return {
            status: this.lastbotstatus,
            from_date: this.from_date, //because the
            start_price: start_price,
            initial_asset_balance: this.btc_balance,
            initial_currency_balance: this.zar_balance,
            candle_size: this.candle_size,
            currency: this.currency,
            asset: this.asset
        }
    }

    getNickName() {
        return utils.getRandomName(6, 1)
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
                fs.writeFile(filename_tickers, JSON.stringify(this.raw_array_data_db_format, null, 2));
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

    recordTicker(ticker) {
        this.tickers.push(ticker)
    }

    setup() {

        this.paper.initial_balance = this.paper.initial_balance;
        console.log("SET: " + this.dateStr + " - ", "Initial balance set to " + this.paper.initial_balance + " ZAR")
    }

    start() {
        this.type = 'tradebot'

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

        this.indicator.insertChartData()

        // this.graph_data.ma24h.data.push([this.cleaned_obj_current_market_data.timestamp, this.cleaned_obj_current_market_data.ma24h])

        // this.graph_data.ma1h.data.push([this.cleaned_obj_current_market_data.timestamp, this.cleaned_obj_current_market_data.ma1h])

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

    offline_data_mainlooper() {

        for (var n = 0; n < this.raw_array_data_db_format.length; n++) {

            this.processNewCandle(this.raw_array_data_db_format[n])

            // ## USED this.strategy##
            if (n >= this.max_step_size_indicator) {
                this.onCheckTrade()
            }
            this.setGrowth()
            this.setEfficiency()
            this.onNewCandles(this.getLastCandleUpdate())
        }
    }

    getTimeSpan() {
        return this.cleaned_obj_current_market_data.timestamp - this.from_date
    }

    print_profit() {

        console.log(this.dateStr + " - PROF: ", "Profit: " + this.profit_after_sell + ", Cummulative Profit: " + this.cummulative_profit)

        this.graph_data_bak.change_bal.x.push(this.date_time_formatter(new Date(this.cleaned_obj_current_market_data.timestamp)))
        this.graph_data_bak.change_bal.y.push(this.profit_after_sell)

        this.graph_data_bak.profit.x.push(this.date_time_formatter(new Date(this.cleaned_obj_current_market_data.timestamp)))
        this.graph_data_bak.profit.y.push(this.cummulative_profit)
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
        this.trade_history[this.trade_history.length - 1] = (JSON.parse(JSON.stringify(this.last_trade_obj)))

        console.log("==========================*********===================== end trade", this.total_counter_trade)
    }

    setGrowth() {
        this.netWorth = this.zar_balance + this.btc_balance * this.cleaned_obj_current_market_data.average_price
        this.artificial_growth = 100 * (this.netWorth - this.paper.initial_balance) / this.paper.initial_balance

        var initial_buy_price
        if (typeof this.trade_history[0] === typeof undefined) {
            initial_buy_price = this.last_buy_price
        } else {
            initial_buy_price = this.trade_history[0].buy.price
        }
        this.natural_growth = 100 * (this.cleaned_obj_current_market_data.average_price - initial_buy_price ) / initial_buy_price

    }

    setEfficiency() {
        var signOfnaturalGrowth = this.natural_growth / (Math.abs(this.natural_growth))
        // this.efficiency = 1 + ( this.artificial_growth - this.natural_growth) * signOfnaturalGrowth / this.natural_growth

        var currentAssetWorth = this.zar_balance / this.cleaned_obj_current_market_data.average_price + this.btc_balance
        var initial_asset_worth
        if (typeof this.trade_history[0] === typeof undefined) {
            initial_asset_worth = this.btc_balance //because this statement is only true if the bot bought for the first time. For asset balance is considered as initial_asset_worth.
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
                x: this.cleaned_obj_current_market_data.timestamp,
                text: 'Sell @' + this.cleaned_obj_current_market_data.average_price,
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
        this.trade_history.push(JSON.parse(JSON.stringify(this.last_trade_obj)))
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

    onCheckTrade() {
        //override this method please. don't put your  code here, just extends this class
        console.log('Overide this bruh nothing', this.cleaned_obj_current_market_data.average_price)
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
            "strategy": this.strategy,
            "netWorth": this.netWorth,
            "artificial_growth": this.artificial_growth,
            "natural_growth": this.natural_growth,
            "Fitness": this.efficiency,
            "Trade_count": this.total_counter_trade,
        })
        // saveBilan()
    }

    getAllPastChartData(cb) {
        var res = []
        for (var indicator_serie_id in this.graph_data) {
            res.push(this.graph_data[indicator_serie_id])
        }
        cb(res)
    }

    on(event, cb) {
        switch (event) {
            case 'init':
                this.onInit = cb
                break;

            case 'init_live':
                this.onInitLive = cb
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

    create_indicators(currentCandle) {
        this.indicator.calculateAllIndicators(currentCandle)
        return
    }


    getLastStepTimestamp() {
        //the a timestamp of the past that fall in the step range
        this.now = new Date();
        this.dateStr = dateFormat(this.now, "dd/mm/yy-hh:MM:ss");
        var when_candle_ended = this.now - this.now % (1000 * 60 * this.rangeInMinute) //the last 5 minute timestamp
        var when_candle_started = when_candle_ended - (1000 * 60 * this.rangeInMinute)
        this.lastStepTimestamp = when_candle_started
        return this.lastStepTimestamp
    }

    getLastStepTimestampOffline() {
        //the a timestamp of the past that fall in the step range
        this.now = this.from_date * 1000;
        this.dateStr = dateFormat(this.now, "dd/mm/yy-hh:MM:ss");
        var when_candle_ended = this.now - this.now % (1000 * 60 * this.rangeInMinute) //the last 5 minute timestamp
        var when_candle_started = when_candle_ended - (1000 * 60 * this.rangeInMinute)
        this.lastStepTimestamp = when_candle_started
        return this.lastStepTimestamp
    }

    online_data_mainlooper_bitfinex() {
        this.getLastStepTimestamp()

        console.log(this.dateStr + " *************************************NEXT FRAME LIVE**********************")
        this.print_balances()
        this.print_bilan()
        this.print_profit()

        //********************HEART BEAT RATE: Every minute + (offset_delay) *********************************//
        var offset_delay = 5000; //do not run the requester exactely on the minute change, rather add a small delay(5seconds here)
        this.timeout_before_request = ((this.now - this.now % (1000 * 60)) + (1000 * 60 * 1)) - this.now + offset_delay
        //******
        console.log(this.dateStr + " - NEXT TICKER: ", "Will request ticker in  " + this.timeout_before_request + ' millis')
        this.lastbotstatus = {
            state: 'is watching market',
            msg: "Will request ticker in  " + this.timeout_before_request + ' millis'
        }
        this.EmitStatus(this.lastbotstatus)

        setTimeout(() => {
            if (this.continue) {
                this.getLastStepTimestamp()
                var to_date = this.lastStepTimestamp / 1000
                var last_candleTimestamp = this.cleaned_array_offline_array_data[this.cleaned_array_offline_array_data.length - 1].timestamp / 1000
                var from_date = last_candleTimestamp + this.rangeInMinute * 60 //Because we don't want to include the last candle anymore

                //save to sql before processing the new candle
                this.dataminer.createSqlByTimeRangeAndMarket(this.exchange, this.asset, this.currency, this.candle_size, from_date, to_date, (raw) => {

                    var candles = raw
                    if (raw.length !== 0) {
                        for (var n = 0; n < raw.length; n++) {
                            this.processNewCandle(raw[n]) //this is inside the live heartbeat
                            this.setGrowth() // growths always changes depending on the market price

                            console.log('NEW CANDLE !');

                            // ## USED this.strategy##
                            if (n === raw.length - 1) {
                                this.onCheckTrade()
                                this.setEfficiency()
                            } else {
                                console.log('Lagging candle, cannot trade anymore for this trade ' + this.cleaned_obj_current_market_data.timestamp);
                            }
                            this.onNewCandlesLive({
                                candleUpdate: this.getLastCandleUpdate(),
                                chartUpdate: this.indicator.getIndicatorChartTicker()
                            })
                        }
                    } else {
                        console.log('No new candle')
                    }
                    this.online_data_mainlooper_bitfinex()
                }, 120)
            } else {

                console.log('BOT has stopped')
                this.onStop(this.getLastCandleUpdate())
                this.lastbotstatus = {state: 'has stopped', msg: 'Bye :)'}
                this.EmitStatus(this.lastbotstatus)
            }

            // this.get_data_ticker_online(this.candle_size)
        }, this.timeout_before_request)
    }

    simulation_online() {
        // this.paper.initial_balance = 2735.60;
        // this.paper.initial_balance = 675;
        this.type = 'paper_trader'

        this.isOnline = true;
        this.zar_balance = this.paper.initial_balance
        this.getLastStepTimestamp()
        this.startTickerLoggingTimestamp = this.lastStepTimestamp - (1000 * 60 * 60 * 24 * 2 ) //the timestamp two days until the this.lastStepTimestamp
        this.dateStr = dateFormat(this.now, "dd/mm/yy-hh:MM:ss");

        console.log(this.dateStr + " - SET: ", "Initial balance set to " + this.paper.initial_balance + " ZAR")

        this.max_step_size_indicator = this.indicator.getMaxStepSize()
        this.from_date = this.getLastStepTimestamp() / 1000
        this.to_date = this.from_date
        var data_fetch_from = this.getLastStepTimestamp() / 1000 - this.rangeInMinute * 60 * this.max_step_size_indicator
        this.dataminer.createSqlByTimeRangeAndMarket(this.exchange, this.asset, this.currency, this.candle_size, data_fetch_from, this.to_date, (raw) => {
            console.log('Let\'s go !')
            this.raw_array_data_db_format = raw
            this.save_live_quote('bitfinex', this.candle_size)
            //OFFLINE SIMULATION MAINLOOPER
            this.onInit(this.getInitSummary())
            this.offline_data_mainlooper() //just to load the indicators
            this.onInitLive(this.getLastCandleUpdate())
            this.online_data_mainlooper_bitfinex()

        })
    }

    Simulation_offline() {
        this.lastbotstatus = {state: 'downloading data', msg: 'hello'}
        this.EmitStatus(this.lastbotstatus)
        console.log('Simulation offline started')
        // this.paper.initial_balance = 2735.60;
        // this.paper.initial_balance = 675;
        this.zar_balance = this.paper.initial_balance
        this.getLastStepTimestampOffline()
        console.log("SET: " + this.dateStr + " - ", "Initial balance set to " + this.paper.initial_balance + " ZAR")

        // making sure that the data are available and downloaded()
        this.max_step_size_indicator = this.indicator.getMaxStepSize()
        var data_fetch_from = this.lastStepTimestamp / 1000 - this.rangeInMinute * 60 * this.max_step_size_indicator

        this.dataminer.createSqlByTimeRangeAndMarket(this.exchange, this.asset, this.currency, this.candle_size, data_fetch_from, this.to_date, (raw) => {

            this.raw_array_data_db_format = raw
            this.max_step_size_indicator = this.indicator.getMaxStepSize()
            //OFFLINE SIMULATION MAINLOOPER
            this.lastbotstatus = {state: 'Trading', msg: 'hello'}
            this.onInit({
                status: this.lastbotstatus,
                start_time: this.from_date, //because the
                start_price: this.raw_array_data_db_format[this.raw_array_data_db_format.length - 1].close,
                start_asset_balance: this.btc_balance,
                start_currency_balance: this.zar_balance,
            })

            this.offline_data_mainlooper() //launch init before
            // this.graphOnline()
            this.print_bilan()
            this.saveBilan()
            this.onStop(this.getLastCandleUpdate())
            this.lastbotstatus = {state: 'is Done Backtesting', msg: 'hello'}
            this.EmitStatus(this.lastbotstatus)
        })
    }

    getRoundTrips() {
        return Math.floor(this.total_counter_trade / 2)
    }

    getExposure() {
        return this.cleaned_obj_current_market_data.timestamp - this.last_trade_obj.buy.timestamp
    }

    stopBot() {
        this.continue = false;
        this.lastbotstatus = {state: 'is Stoping soon...', msg: this.timeout_before_request}
        this.EmitStatus(this.lastbotstatus)
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

    processNewCandle(rawArrayDataDbFormat) {
        var n = this.cleaned_array_offline_array_data.length
        for (var k in  rawArrayDataDbFormat) {
            this.cleaned_obj_current_market_data[k] = rawArrayDataDbFormat[k]
        }

        this.cleaned_obj_current_market_data.average_price = this.cleaned_obj_current_market_data.close
        this.cleaned_obj_current_market_data.close_price = this.cleaned_obj_current_market_data.close
        this.cleaned_obj_current_market_data.timestamp = this.cleaned_obj_current_market_data.start * 1000

        delete this.cleaned_obj_current_market_data.close;
        delete this.cleaned_obj_current_market_data.start;

        this.create_indicators(this.cleaned_obj_current_market_data)

        this.cleaned_array_offline_array_data.push(JSON.parse(JSON.stringify(this.cleaned_obj_current_market_data)));

        // this.setAllTimeHigh()
        this.graph_insert()

        if (n === this.max_step_size_indicator) {
            this.allTimeHigh = this.cleaned_obj_current_market_data.close_price;
            this.mode = this.IsWAITINGFORSELL
            this.buy_btc(this.paper.initial_balance)
            // this.print_balances()
        }


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


