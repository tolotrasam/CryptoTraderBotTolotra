const request = require('request')
const fs = require('fs')
var dateFormat = require('dateformat');
const sql_helper = require('./helper/sql_helper.js')
var Tradebot = require('./tradebot.js')
var DataMiner = require('./helper/data_miner.js')
var dataminer = new DataMiner()
const bitfinex_rest = require('./helper/api/bitfinex_rest')
var http = require('http');
var path = require('path');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');

var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

var messages = [];
var sockets = [];

function http_request(headers_params, cb, params) {
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
function getLastStepTimestamp() {
    now = new Date();
    dateStr = dateFormat(now, "dd/mm/yy-hh:MM:ss");
    lastStepTimestamp = now - now % (1000 * 60 * 5) //the last 5 minute timestamp
}


function updateRoster() {
    async.map(
        sockets,
        function (socket, callback) {
            socket.get('name', callback);
        },
        function (err, names) {
            broadcast('roster', names);
        }
    );
}
function broadcast(event, data) {
    sockets.forEach(function (socket) {
        socket.emit(event, data);
    });
}
function getAccountBalanceOfPairByExchange(exchange, currency, asset, cb) {
    if (exchange.toLowerCase() === 'bitfinex') {
        bitfinex_rest.getAccountBalanceOfPairByPair(currency, asset, function (err, balances) {
            cb(balances)
        })
    } else {
        cb('No API for this exchange')
    }
}
function getTradingFeesByExchange(exchange, cb) {
    if (exchange.toLowerCase() === 'bitfinex') {
        bitfinex_rest.getTradingFees( function ( fees) {
            cb(fees)
        })
    } else {
        cb('No API for this exchange')
    }
}
function getPairMarketPriceByExchange(exchange, currency, asset, cb) {
    if (exchange.toLowerCase() === 'bitfinex') {
        bitfinex_rest.getPairMarketPrice(currency, asset, function ( price) {
            cb(price)
        })
    } else {
        cb('No API for this exchange')
    }
}
function setupSocket() {
    console.log('Socket server setup')
    io.on('connection', function (socket) {
        messages.forEach(function (data) {
            socket.emit('message', data);
        });

        sockets.push(socket);

        socket.on('disconnect', function () {
            sockets.splice(sockets.indexOf(socket), 1);
            updateRoster();
        });

        var placeholder = {
            exchanges: ['Bitfinex', 'Kraken', 'Bitmex', 'Poloniex'],
            currency: ['USD', 'ETH', 'BTC', 'EUR'],
            asset: ['BTC', 'IOTA', 'ETH', 'XMR'],
            strategy: ['MYSTRATEGY', 'SMR', 'RSI', 'MCAD'],
            candle_size: ['1m', '5m', '15m', '1h', '3h', '1d'],
            available_since: 'None',
            available_until: 'None'
        }
        socket.on('checkAvailableData', function (settings) {

            dataminer.getAvailableDataRanges(settings.exchanges, settings.currency, settings.asset, settings.candle_size, function (err, rangeObj) {
                socket.emit('checkAvailableData', rangeObj)
            })
        })
        socket.on('placeholder', function () {
            dataminer.getAvailableDataRanges(placeholder.exchanges[0], placeholder.currency[0], placeholder.asset[0], placeholder.candle_size[1], function (err, rangeObj) {
                placeholder.available_since = rangeObj.available_since
                placeholder.available_until = rangeObj.available_until

                getAccountBalanceOfPairByExchange(placeholder.exchanges[0], placeholder.currency[0], placeholder.asset[0], function (balance) {
                    placeholder.balance = balance
                    getTradingFeesByExchange(placeholder.exchanges[0], function (fee) {
                        placeholder.fee = fee
                        getPairMarketPriceByExchange(placeholder.exchanges[0], placeholder.currency[0], placeholder.asset[0], function (price) {
                            placeholder.marketPrice = price
                            socket.emit('placeholder', placeholder)
                        })
                    })
                })
            })
        })
        socket.on('start', function (msg) {
            console.log(msg)
            switch (msg.mode) {
                case 'Tradebot':
                    var tradebot = new Tradebot(msg)
                    return
                    tradebot.start()
                    break;
                case 'Paper Trader':
                    simulation_online()
                    break
                case 'Backtest':
                    var tradebot = new Tradebot(msg)
                    var dataminer = new DataMiner()

                    dataminer.on('download', function (data) {
                        socket.emit('status',data)
                    })

                    tradebot.setUpDataMiner(dataminer)

                    tradebot.on('init',function (data) {
                        socket.emit('init',data )
                    })
                    tradebot.on('candle',function (data) {
                        // socket.emit('candle', data)
                    })
                    tradebot.on('trade',function (data) {
                        socket.emit('trade',data)
                    })
                    tradebot.on('stop',function (data) {
                        socket.emit('stop',data)
                        tradebot.getAllPastChartData(function (data) {
                            socket.emit('allChartData', data)
                        })
                    })
                    tradebot.on('status',function (data) {
                        socket.emit('status',data)
                    })
                    tradebot.Simulation_offline();

                    break
            }
        })

        socket.on('message', function (msg) {
            console.log('message received', msg)
            var text = String(msg || '');

            if (!text)
                return;

            socket.get('name', function (err, name) {
                var data = {
                    name: name,
                    text: text
                };

                broadcast('message', data);
                messages.push(data);
            });
        });

        socket.on('identify', function (name) {
            socket.set('name', String(name || 'Anonymous'), function (err) {
                updateRoster();
            });
        });
    });
}
function keepPingingMyself() {
    setInterval(function () {
        console.log('TRYING TO PING MYSELF')
        var url = "https://cryptotraderbottolotra.herokuapp.com/";
        http_request({url: url, method: 'GET'}, function (data, params) {
            console.log('PINGING MYSELF SUCCESSFULLY')
            // console.log(data.trades[0], params)
        }, '')
    }, 300000); // every 5 minutes (300000)
}
function runServer() {
    console.log('Server+ setup')
    router.use(express.static(path.resolve(__dirname, 'client')));

    server.listen(process.env.PORT || 3200, process.env.IP || "localhost", function () {
        var addr = server.address();
        console.log("Chat server listening at", addr.address + ":" + addr.port);
    });
    setupSocket()
    // keepPingingMyself()


}
function simulation_online() {
    runServer()
    // initial_balance = 2735.60;
    // initial_balance = 675;
    isOnline = true;
    zar_balance = initial_balance
    getLastStepTimestamp()
    startTickerLoggingTimestamp = lastStepTimestamp - (1000 * 60 * 60 * 24 * 2 ) //the timestamp two days until the laststeptimestamp

    dateStr = dateFormat(now, "dd/mm/yy-hh:MM:ss");

    console.log(dateStr + " - SET: ", "Initial balance set to " + initial_balance + " ZAR")

    fill_past_data_for_indicators(lastStepTimestamp, startTickerLoggingTimestamp, '5m')

    // graphOnline()
    // print_bilan()
}


//FEATURES
runServer()


