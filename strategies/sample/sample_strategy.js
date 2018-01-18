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
        // this.indicator.addIndicators('SMA_1D','ma24h',{showChart:true})
        // this.indicator.addIndicators('SMA')
    }

    onCheckTrade() {
        //your code here
        // console.log('nothing', this.cleaned_obj_current_market_data.average_price)

    }
}

MYSTRATEGY.parameters = {
    // trade_risk: 0.09,
    // upper_trade_risk: 0.01,//Used to define when to sell after this.paper.fees are cleared
    // lower_trade_risk: 0.002,//Used to define when to buy after this.paper.fees are cleared
}

MYSTRATEGY.info =
    "<ul>" +
    "<li>Write the info about the strategy here</li>" +
    "<li>You can user html tags</li>" +
    "</ul>";


module.exports = MYSTRATEGY
