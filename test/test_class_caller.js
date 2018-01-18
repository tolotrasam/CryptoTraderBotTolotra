
var PMR = require('../strategies/PMR.js')
var DataMiner = require('../helper/data_miner.js')


var settings = {
    "currency": "USD",
    "mode": "backtest",
    "exchanges": "bitfinex",
    "asset": "BTC",
    "candle_size": "1m",
    "strategy": {
        "name": "MR-no-sell-low",
        "parameters": {
            "trade_risk": 0.12,
            "lower_trade_risk": 0.05
        },
        "info": "<ul><li>Startegy sudden growth distance percentage peak of ticker close vs 24h moving average </li><li>Never sell lower than last buy price</li><li>Buy when price is close to sma at a percentage of lower_trade_risk above sma(or below)</li></ul>"
    },
    "paper_trader": {
        "initial_asset_balance": 1,
        "initial_currency_balance": 1000,
        "fee": "0.2"
    },
    "available_since": "1480160400",
    "available_until": "1515667800",
    "balance": {
        "asset": "0.00175371",
        "currency": 0
    },
    "fee": "0.2",
    "marketPrice": "13601.0"
}

var Tradebot = require('../strategies/'+settings.strategy.name+'.js')
var tradebot = new Tradebot(settings)
var dataminer = new DataMiner()
tradebot.setUpDataMiner(dataminer)
tradebot.simulation_online()


// dataminer.getAvailableDataRanges('Bitfinex', 'USD','ETH', '5m',function (err,data) {
//     console.log(data)
// })
// tradebot.Simulation_offline()
