/**
 * Created by Tolotra Samuel on 11/01/2018.
 */

var Tradebot = require('./../tradebot')

class PMR extends Tradebot {

    constructor(settings) {
        super(settings);
        this.requiresIndicatorsLoaded = true
        this.indicator.addIndicators('SMA_1D','ma24h',{showChart:true})
        // this.indicator.addIndicators('SMA')
    }

    onCheckTrade() {
        //your code here
        // console.log('nothing', this.cleaned_obj_current_market_data.average_price)
        this.description = "this.strategy micro trader + sudden growth from moving average"

        if (typeof (this.cleaned_obj_current_market_data['ma24h']) !== "undefined") {

            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data['ma24h']
            var distance_close_sma_percentage_from_sma = distance_close_sma / this.cleaned_obj_current_market_data['ma24h'];
            this.local_stat.push(distance_close_sma_percentage_from_sma)

            if (this.mode === 'waiting_for_buy') {
                var feePaid = this.last_sell_price * this.paper.fee / 100
                var profitPerUnitOfAssetTarget = this.last_sell_price * this.parameters.lower_trade_risk
                var targetBuy = (this.last_sell_price - feePaid - profitPerUnitOfAssetTarget)
                if (targetBuy > (this.cleaned_obj_current_market_data.close_price )) {
                    // console.log('buy!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_sma_percentage_from_sma > this.parameters.trade_risk) {
                    var feePaid =  this.last_buy_price * this.paper.fee / 100
                    var profitPerUnitOfAssetTarget = this.last_buy_price * this.parameters.upper_trade_risk
                    var targetSell = (this.last_buy_price + feePaid + profitPerUnitOfAssetTarget)

                    if (targetSell < (this.cleaned_obj_current_market_data.close_price)) { //second condition
                        //current price must be higher than targetsell before selling
                        // console.log('sell!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                        this.mode = 'waiting_for_buy';
                        this.sell_btc(this.btc_balance)
                    }
                }
            }
        }
    }
}

PMR.parameters = {
    trade_risk: 0.09,
    upper_trade_risk: 0.01,//Used to define when to sell after this.paper.fees are cleared
    lower_trade_risk: 0.002,//Used to define when to buy after this.paper.fees are cleared

}

PMR.info =
    "<ul>" +
    "<li>upper_trade_risk is a percentage of price above the last buy price used to define when to sell after fees are cleared, normally, fee = 0.002 which must be less than upper_trade_risk (upper_trade_risk-fee)= your profit </li>" +
    "<li>lower_trade_risk is Used to define when to buy after this.paper.fees are cleared </li>" +
    "<li>trade_risk is a percentage value of the distance between the moving average and the close price</li>" +
    "</ul>";

module.exports = PMR