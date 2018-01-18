const request = require('request')
const fs = require('fs')
var dateFormat = require('dateformat');
const sql_helper = require('./helper/sql_helper.js')
var Tradebot = require('./tradebot.js')
var DataMiner = require('./helper/data_miner.js')
var dataminer = new DataMiner()
const config = require('./config/config')
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
var liveBots = []
const PORT = process.env.PORT || 3200;
const IP =  process.env.IP || "localhost";

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
        bitfinex_rest.getTradingFees(function (fees) {
            cb(fees)
        })
    } else {
        cb('No API for this exchange')
    }
}
function getPairMarketPriceByExchange(exchange, currency, asset, cb) {
    if (exchange.toLowerCase() === 'bitfinex') {
        bitfinex_rest.getPairMarketPrice(currency, asset, function (price) {
            cb(price)
        })
    } else {
        cb('No API for this exchange')
    }
}

function requireUncached(module) {
    delete require.cache[require.resolve(module)]
    return require(module)
}
function getStartegyListObjPlaceholder(cb) {
    var StartDirPath = './strategies/'
    var strategies = []
    var files = fs.readdirSync(StartDirPath);
    for (var file of files) {
        if (fs.lstatSync(StartDirPath + file).isFile()) {
            var strategy = {name: file.split('.')[0]}
            var startJs = requireUncached(StartDirPath + file)
            strategy.parameters = startJs.parameters
            strategy.info = startJs.info
            if (strategy.name === config.default.strategy) {
                strategy.default = true;
            }
            strategies.push(strategy)
        }
    }
    cb(strategies)
    // console.log('startegies:', strategies)
}

function getDefaultSlug(obj) {
    for (var el of obj) {
        if (el.hasOwnProperty('default')) {
            if (el.default) {
                return el.slug;
                break
            }
        }
    }
    return obj[0].slug
}
function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
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

        var placeholder = config.placeholder
        socket.on('checkAvailableData', function (settings) {

            dataminer.getAvailableDataRanges(settings.exchanges, settings.currency, settings.asset, settings.candle_size, function (err, rangeObj) {
                socket.emit('checkAvailableData', rangeObj)
            })
        })

        socket.on('getLivebots', function () {
            var arrayTradeBots = []
            var arrayPaperBots = []
            for (var element of liveBots) {
                var botDisplay = {
                    Nickname: element.nickname,
                    from_date: element.bot.from_date,
                    current_data_timestamp: element.bot.cleaned_obj_current_market_data.timestamp / 1000,
                    strategy: element.bot.strategy,
                    asset: element.bot.asset,
                    currency: element.bot.currency,
                    candle_size: element.bot.candle_size,
                    efficiency: element.bot.efficiency,
                    total_counter_trade: element.bot.total_counter_trade,
                    id: element.id
                }
                if (element.bot.type === 'paper_trader') {
                    arrayPaperBots.push(botDisplay)
                } else {
                    arrayTradeBots.push(botDisplay)
                }
            }
            socket.emit('getLivebots', [arrayTradeBots, arrayPaperBots])
        })
        socket.on('placeholder', function () {
            dataminer.getAvailableDataRanges(getDefaultSlug(placeholder.exchanges), getDefaultSlug(placeholder.currency), getDefaultSlug(placeholder.asset), getDefaultSlug(placeholder.candle_size), function (err, rangeObj) {
                placeholder.available_since = rangeObj.available_since
                placeholder.available_until = rangeObj.available_until

                getAccountBalanceOfPairByExchange(getDefaultSlug(placeholder.exchanges), getDefaultSlug(placeholder.currency), getDefaultSlug(placeholder.asset), function (balance) {
                    placeholder.balance = balance
                    placeholder.paper_trader.initial_asset_balance = config.initial_asset_balance
                    placeholder.paper_trader.initial_currency_balance = config.initial_currency_balance
                    getTradingFeesByExchange(getDefaultSlug(placeholder.exchanges), function (fee) {
                        placeholder.fee = fee
                        placeholder.paper_trader.fee = fee
                        getPairMarketPriceByExchange(getDefaultSlug(placeholder.exchanges), getDefaultSlug(placeholder.currency), getDefaultSlug(placeholder.asset), function (price) {
                            placeholder.marketPrice = price
                            getStartegyListObjPlaceholder(function (startegies) {
                                placeholder.strategy = startegies
                                socket.emit('placeholder', placeholder)
                            })
                        })
                    })
                })
            })
        })
        socket.on('stop_bot', function (id) {
            console.log('TRYING TO STOP BOT WITH ID: ' + id + 'amongts ' + liveBots.length + ' bots')
            for (var liveBot of liveBots) {
                if (liveBot.id === id) {
                    liveBot.bot.stopBot();
                    break
                }
            }
        })
        socket.on('subscribe_live_bot', function (id) {
            var botElement = getLiveBotByID(id)
            botElement.subscribers.push(socket)
        })
        function getLiveBotByID(id) {
            for (var botElement of liveBots) {
                if (liveBots.id === id) {
                    botElement
                    return
                }
            }
        }

        function broadcastEventToSubscribers(tradebot, event_slug, data) {
            console.log('Broadcast attempt', event_slug)
            for (var n = 0; n < liveBots.length; n++) {

                if (tradebot === liveBots[n].bot) {
                    liveBots[n].subscribers = liveBots[n].subscribers.filter(function( obj ) {
                        return !obj.disconnected ;
                    });
                    for (var i = 0; i < liveBots[n].subscribers.length; i++) {
                        var subSocket = liveBots[n].subscribers[i]
                        if (subSocket &&  !subSocket.disconnected ) {
                            subSocket.emit(event_slug, data)
                            console.log('subscriber ' + (i + 1) + 'out of ', liveBots[n].subscribers.length)
                        }
                    }
                    if(event_slug==='stop'){
                        liveBots.splice(n,1)
                    }
                    break;
                }
            }

        }

        socket.on('start', function (msg) {
            console.log(msg)
            var Tradebot = require('./strategies/' + msg.strategy.name + '.js')
            msg.id = makeid()
            socket.emit('start_id', msg.id)
            var tradebot = new Tradebot(msg)
            var dataminer = new DataMiner()
            tradebot.setUpDataMiner(dataminer)

            dataminer.on('download', function (data) {
                broadcastEventToSubscribers(tradebot, 'status', data)
            })

            tradebot.on('init', function (data) {
                broadcastEventToSubscribers(tradebot, 'init', data)
            })

            tradebot.on('trade', function (data) {
                broadcastEventToSubscribers(tradebot, 'trade', data)
            })
            tradebot.on('stop', function (data) {

                tradebot.getAllPastChartData(function (data) {
                    broadcastEventToSubscribers(tradebot, 'allChartData', data)
                    broadcastEventToSubscribers(tradebot, 'stop', data)
                })
            })
            tradebot.on('init_live', function (data) {
                broadcastEventToSubscribers(tradebot, 'init_live', data)
                tradebot.getAllPastChartData(function (data) {
                    broadcastEventToSubscribers(tradebot, 'allChartData', data)
                })
            })
            tradebot.on('status', function (data) {
                broadcastEventToSubscribers(tradebot, 'status', data)
            })
            liveBots.push({bot: tradebot, id: msg.id, since: new Date().getTime(), subscribers: [socket]})

            switch (msg.mode) {
                case 'tradebot':
                    return
                    tradebot.start()
                    break;
                case 'paper_trade':
                    tradebot.on('candle_live', function (data) {
                        broadcastEventToSubscribers(tradebot, 'candle_live', data)
                        // socket.emit('candle_live', data)
                    })
                    tradebot.simulation_online();
                    break
                case 'backtest':

                    tradebot.Simulation_offline();

                    break
            }
        })
        socket.on('getBotSummary', function (id) {
            console.log('Getting bot summary', id)
            for (var bot of liveBots) {
                if (bot.id === id) {
                    var this_bot = bot.bot
                    var summary = bot.bot.getBotSummary()
                    if (bot.subscribers.indexOf(socket) === -1) {
                        bot.subscribers.push(socket)
                    }
                    socket.emit('getBotSummary', summary)
                    this_bot.getAllPastChartData(function (data) {
                        socket.emit('allChartData', data);
                        // broadcastEventToSubscribers(this_bot,'allChartData', data)
                    })
                    break
                }
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

    // server.listen(PORT, process.env.IP || "localhost", function ()
    server.listen(PORT,  () =>{
        var addr = server.address();
        console.log("Chat server listening at", addr.address + ":" + addr.port);
        console.log(`Our app is running on port ${ PORT }`);
    });
    console.log('After binding port')
    router.use(express.static(path.join(__dirname, 'client')));
    router.use('/bower_components',  express.static( path.join(__dirname, 'client/bower_components')))
    console.log('After routing files')
    // router.get('/*', function (req, res) {
    //     res.sendfile('client/index.html');
    // });
    console.log('After setting catch all routing')
    setupSocket()
    console.log('After setting up socket')
    keepPingingMyself()
}

//FEATURES
runServer()


