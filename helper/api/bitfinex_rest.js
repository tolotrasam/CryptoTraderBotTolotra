/**
 * Created by Tolotra Samuel on 03/01/2018.
 */

const apiKey = process.env.BitfinexKey;
const apiSecretKey = process.env.BitfinexSecret;

const BFX = require('bitfinex-api-node')
const bfx = new BFX({apiKey: apiKey, apiSecret: apiSecretKey})
const bfxRest = bfx.rest(1, {
    // options
    transform: true
})


function placeOrder() {

    bfxRest.new_order('BTCUSD', '1.269', '1000', 'bitfinex', 'sell', 'exchange market', (err, res) => {
        if (err) console.log(err)
        console.log(res)
    })

}

// getAccountBalanceOfPairByPair('USD', 'BTC', function (err, res) {
//     console.log(res)
// })
function getAccountBalanceOfPairByPair(currency, asset, cb) {
    var balances = {}

    bfxRest.wallet_balances((err, res) => {
        if (err) {
            balances.asset = 'Internet or API or'
            balances.currency = 'Internet or API or'
            console.error(err)
            cb(null, balances)
        } else {
            if (err) {
                throw err
            }
            console.log(res)
            for (var balance of res) {
                if (balance.currency === currency.toLowerCase()) {
                    balances.currency = balance.available
                }
                if (balance.currency === asset.toLowerCase()) {
                    balances.asset = balance.available
                }
            }
            if (typeof balances.currency === typeof undefined) {
                balances.currency = 0
            }
            if (typeof  balances.asset === typeof  undefined) {
                balances.asset = 0
            }
            console.log(balances)
            cb(null, balances)
        }
    })

}

// getTradingFees()
function getTradingFees(currency, asset, cb) {
    if (typeof currency === 'function') {
        cb = currency
    }
    if (typeof asset === 'function') {
        cb = asset
    }
    bfxRest.account_infos(function (err, res) {
        if (err) {
            console.log(err)
            cb('API Error')
        } else {
            cb(res[0].taker_fees)
        }


    })
}
// getPairMarketPrice('USD','BTC')
function getPairMarketPrice(currency, asset, cb) {
    var pair = asset + currency
    bfxRest.ticker(pair, (err, res) => {

        if (err) {
            console.log(err)
            cb('API Error')
        } else {
            cb(res.last_price)
        }
    })
}
module.exports = {
    getAccountBalanceOfPairByPair: function (currency, asset, cb) {
        getAccountBalanceOfPairByPair(currency, asset, cb)
    },
    getTradingFees: function (currency, asset, cb) {
        getTradingFees(currency, asset, cb)
    },
    getPairMarketPrice: function (currency, asset, cb) {
        getPairMarketPrice(currency, asset, cb)
    }
}

