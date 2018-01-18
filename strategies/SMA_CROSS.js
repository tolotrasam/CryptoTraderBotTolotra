/**
 * Created by Tolotra Samuel on 11/01/2018.
 */
/**
 * Created by Tolotra Samuel on 11/01/2018.
 */

var Tradebot = require('./../tradebot')

class MYSTRATEGY extends Tradebot {

    constructor(settings) {
        super(settings);
        // this.requiresIndicatorsLoaded = true
        this.indicator.addIndicators('SMA_1h', 'SMA_1h', {showChart: true})
        this.indicator.addIndicators('SMA','mySmaID30m',{showChart:true, count:30, unit:'minutes'})
        this.indicator.addIndicators('SMA','mySmaID15m',{showChart:true, count:15, unit:'minutes'})
    }

    onCheckTrade() {
        //your code here
        // console.log('nothing', this.cleaned_obj_current_market_data.average_price)
        var sma1h = this.cleaned_obj_current_market_data['mySmaID15m'];
        // if (typeof sma1h !== typeof undefined) {
            var diff = -sma1h + this.cleaned_obj_current_market_data.average_price
            if (this.mode === this.IsWAITINGFORBUY) {
                if (diff > 0) {
                    this.buy_btc(this.zar_balance)
                    this.mode = this.IsWAITINGFORSELL
                }
            } else {
                if (diff < 0) {
                    this.sell_btc(this.btc_balance)
                    this.mode = this.IsWAITINGFORBUY
                }
            // }
        }

    }
}

MYSTRATEGY.parameters = {
    // trade_risk: 0.09,
    // upper_trade_risk: 0.01,//Used to define when to sell after this.paper.fees are cleared
    // lower_trade_risk: 0.002,//Used to define when to buy after this.paper.fees are cleared
}

MYSTRATEGY.info =
    "<ul>" +
    "<li>Simple buy when sma 1h below price(downtrend)</li>" +
    "<li>Sell when sma 1h above price(uptrend)</li>" +
    "</ul>";


module.exports = MYSTRATEGY
