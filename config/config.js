/**
 * Created by Tolotra Samuel on 12/01/2018.
 */


module.exports = {
    initial_asset_balance: 1,
    initial_currency_balance: 1000,
    placeholder: {
        exchanges: [
            {name: 'Bitfinex', default: true, slug: 'bitfinex'},
            {name: 'Kraken', isInvalid: true, slug: 'kraken'},
            {name: 'Bitmex', isInvalid: true, slug: 'bitmex'},
            {name: 'Poloniex', isInvalid: true, slug: 'poloniex'}
        ],
        currency: [
            {name: 'USD', default: true, slug: 'USD'},
            {name: 'ETH', slug: 'ETH'},
            {name: 'BTC', slug: 'BTC'},
            {name: 'EUR', slug: 'EUR'}
        ],
        asset: [
            {name: 'BTC', default: true, slug: 'BTC'},
            {name: 'IOTA', slug: 'IOT'},
            {name: 'ETH', slug: 'ETH'},
            {name: 'XMR', slug: 'XMR'}],
        candle_size: [
            {name: '1m', default: true, slug: '1m'},
            {name: '5m', slug: '5m'},
            {name: '15m', slug: '15m'},
            {name: '1h', slug: '1h'},
            {name: '3h', slug: '3h'},
            {name: '3d', slug: '3d'}],
        strategy: ['TO LOAD'],
        paper_trader: {},
        available_since: 'None',
        available_until: 'None'
    },
    default:{
        strategy:'PMR'
    }
}