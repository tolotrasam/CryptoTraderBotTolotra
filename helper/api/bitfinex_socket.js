/**
 * Created by Tolotra Samuel on 03/01/2018.
 */



const apiKey = process.env.BitfinexKey;
const apiSecretKey = process.env.BitfinexSecret;

var payload = {
    "request": "/v1/account_infos",
    "nonce": Date.now().toString()
}

// or use bitfinex-api-node

const BFX = require('bitfinex-api-node')
const bfx = new BFX({apiKey: apiKey, apiSecret: apiSecretKey})

const rest2 = bfx.rest(2, {
    // options
    transform: true
})

function restText() {

    rest2.wallets(function (err, res) {
        if (err) console.log(err)
        console.log(res)
    })
    return
    rest2.accountInfo(function (err, res) {
        if (err) console.log(err)
        console.log(res)
    })
    rest2.accountFees(function (err, res) {
        if (err) console.log(err)
        console.log(res)
    })
}

// restText()
// return

const ws = bfx.ws()
const Order = BFX.Models.Order;
ws.on('error', function (err) {
    console.log(err)
})
ws.on('open', ws.auth.bind(ws))

ws.once('auth', function () {
    const o = new Order({
        cid: Date.now(),
        symbol: 'tBTCUSD',
        amount: 1,
        type: Order.type.MARKET
    }, ws)

    // Enable automatic updates
    o.registerListeners()

    o.on('update', function () {
        console.log(`order updated: ${o.serialize()}`)
    })
    o.on('error', function (err) {
        console.log(err)
    })
    o.on('close', function () {
        console.log(`order closed: ${o.status}`)
        ws.close()
    })

    o.submit().then(function () {
        console.log(`submitted order ${o.id}`)
    }).catch(function (err) {
        console.error(err)
        ws.close()
    })
})
ws.open()