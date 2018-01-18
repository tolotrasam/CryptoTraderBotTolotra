/**
 * Created by Tolotra Samuel on 11/01/2018.
 */
var Tradebot = require('./../tradebot')
class MR extends Tradebot {

    constructor(settings) {
        super(settings);
        this.requiresIndicatorsLoaded = true
        this.indicator.addIndicators('SMA_1D','ma24h',{showChart:true})
        this.indicator.addIndicators('SMA_1h','ma1h',{showChart:true})
        //Any field not depending on the user setting
    }

    onCheckTrade() {
        //your code here
        this.description = "sudden growth distance percentage peak of ticker close vs 24h moving average and never sell lower than last buy price"
        if (typeof (this.cleaned_obj_current_market_data['ma24h']) !== "undefined") {

            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data['ma24h']
            var distance_close_to_sma_in_percentage = distance_close_sma / this.cleaned_obj_current_market_data['ma24h'];
            this.local_stat.push(distance_close_to_sma_in_percentage)

            if (this.mode === 'waiting_for_buy') {
                if (distance_close_to_sma_in_percentage > -this.parameters.lower_trade_risk && distance_close_to_sma_in_percentage < this.parameters.lower_trade_risk) {
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_to_sma_in_percentage > this.parameters.trade_risk) {
                    if (this.cleaned_obj_current_market_data.close_price > this.last_buy_price) { //second condition
                        this.mode = 'waiting_for_buy';
                        this.sell_btc(this.btc_balance)
                    }
                }
            }


        }
    }
}
MR.parameters = {
    trade_risk: 0.12,
    lower_trade_risk: 0.05,//Used to define when to sell after this.paper.fees are cleared
}

MR.info =
    "<ul>" +
    "<li>Startegy sudden growth distance percentage peak of ticker close vs 24h moving average </li>" +
    "<li>Never sell lower than last buy price</li>" +
    "<li>Buy when price is close to sma at a percentage of lower_trade_risk above sma(or below)</li>" +
    "</ul>";

module.exports = MR