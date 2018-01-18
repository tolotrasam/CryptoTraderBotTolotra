/**
 * Created by Tolotra Samuel on 11/01/2018.
 */
var Tradebot = require('./../tradebot')
class sample_strategy extends Tradebot {

    constructor(settings){
        super(settings);
        this.requiresIndicatorsLoaded = false
        //Any field not depending on the user setting

    }

    offline_trade_sudden_growth_min_step() {
        this.strategy = "simple step candle sudden growth"
        if (typeof (this.cleaned_obj_current_market_data.min_step_change) !== "undefined") {
            if (this.mode === 'waiting_for_buy') {
                step_before_sell--;
                if (this.step_before_sell === 0) {
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {
                if (this.cleaned_obj_current_market_data.min_step_change < -this.parameters.trade_risk) {
                    console.log('sell!!!!!', this.cleaned_obj_current_market_data.min_step_change)
                    this.mode = 'waiting_for_buy';
                    this.step_before_sell = 24 * 4 * 2 * 3
                    this.sell_btc(this.btc_balance)
                }
            }


        }
    }

    offline_trade_sudden_growth_daily() {
        this.strategy = "simple daily candle sudden growth"
        if (typeof (this.cleaned_obj_current_market_data.daily_growth) !== "undefined") {
            if (this.cleaned_obj_current_market_data.daily_growth > this.parameters.trade_risk) {
                this.buy_btc(this.zar_balance)
            }
            if (this.cleaned_obj_current_market_data.daily_growth < -this.parameters.trade_risk) {
                this.sell_btc(this.btc_balance)
            }
        }
    }

    offline_trade_moving_average() {
        this.strategy = "moving average candle sudden growth 24h"
        if (typeof (this.cleaned_obj_current_market_data.daily_ma24h_growth) !== "undefined") {
            if (this.cleaned_obj_current_market_data.daily_ma24h_growth > this.parameters.trade_risk) {

                // buy_btc(this.zar_balance)
                this.buy_btc(this.zar_balance)

            }
            if (this.cleaned_obj_current_market_data.daily_ma24h_growth < -this.parameters.trade_risk) {

                // sell_btc(this.btc_balance)
                this.sell_btc(this.btc_balance)

            }
        }
    }

    offline_trade_moving_average_sudden_growth() {
        this.strategy = "moving average candle sudden growth 1h"
        if (typeof (this.cleaned_obj_current_market_data.daily_ma1h_growth) !== "undefined") {
            if (this.cleaned_obj_current_market_data.daily_ma1h_growth > this.parameters.trade_risk) {

                this.buy_btc(this.zar_balance)

            }
            if (this.cleaned_obj_current_market_data.daily_ma1h_growth < -this.parameters.trade_risk) {

                this.sell_btc(this.btc_balance)

            }
        }
    }

    offline_trade_moving_average_with_anti_loss() {
        this.strategy = "moving average candle sudden growth with anti loss"
        if (typeof (this.cleaned_obj_current_market_data.daily_ma24h_growth) !== "undefined") {
            if (this.cleaned_obj_current_market_data.daily_ma24h_growth > this.parameters.trade_risk) {
                if (this.cleaned_obj_current_market_data.average_price < this.last_sell_price) {
                    console.log(this.last_sell_price, this.cleaned_obj_current_market_data.average_price)
                    this.buy_btc(this.zar_balance)
                }
            }
            if (this.cleaned_obj_current_market_data.daily_ma24h_growth < -this.parameters.trade_risk) {
                if (this.cleaned_obj_current_market_data.average_price > this.last_buy_price) {
                    console.log(this.last_buy_price, this.cleaned_obj_current_market_data.average_price)
                    this.sell_btc(this.btc_balance)
                }
            }
        }
    }

    offline_trade_moving_average_comparaison() {
        this.parameters.trade_risk = 20
        this.strategy = "moving average candle comparaison"
        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {
            if (typeof (this.cleaned_obj_current_market_data.ma1h) !== "undefined") {
                // var diff = this.cleaned_obj_current_market_data.ma24h - this.cleaned_obj_current_market_data.ma1h
                var diff = this.cleaned_obj_current_market_data.ma24h - this.cleaned_obj_current_market_data.average_price
                // console.log(diff)
                if (diff > this.parameters.trade_risk) {
                    this.sell_btc(this.btc_balance)
                    // sell_btc(this.btc_balance)
                }
                if (diff < -this.parameters.trade_risk) {
                    this.buy_btc(this.zar_balance)
                    // buy_btc(this.zar_balance)
                }
            }
        }
    }

    offline_micro_trade() {
        this.strategy = " this.strategy micro trader + sudden growth from moving average"

        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {

            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data.ma24h
            var distance_close_sma_percentage_from_sma = distance_close_sma / this.cleaned_obj_current_market_data.ma24h;
            this.local_stat.push(distance_close_sma_percentage_from_sma)

            if (this.mode === 'waiting_for_buy') {
                var hasExpired = (this.cleaned_obj_current_market_data.timestamp - this.last_trade_obj.sell.timestamp) > this.expiry_buy_wait;
                hasExpired = false;
                if ((this.last_sell_price - this.last_sell_price * this.paper.fee / 100 - this.last_sell_price * this.parameters.lower_trade_risk) > (this.cleaned_obj_current_market_data.close_price ) || hasExpired) {
                    // console.log('buy!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_sell'
                    if ((this.cleaned_obj_current_market_data.timestamp - this.last_trade_obj.sell.timestamp) > this.expiry_buy_wait) {
                        this.lastTradeStatus = 'expired buy';
                    }
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_sma_percentage_from_sma > this.parameters.trade_risk) {
                    if ((this.last_buy_price + this.last_buy_price * this.paper.fee / 100 + this.last_buy_price * this.parameters.upper_trade_risk ) < (this.cleaned_obj_current_market_data.close_price)) { //second condition
                        // console.log('sell!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                        this.mode = 'waiting_for_buy';
                        this.lastTradeStatus = '';
                        this.sell_btc(this.btc_balance)
                    }
                }
            }

        }
    }
    offline_trade_sudden_growth_buy_sell_difference_from_moving_average() {
        this.strategy = "sudden growth distance percentage peak of ticker close vs 24h moving average"
        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {
            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data.ma24h
            var distance_close_sma_percentage_from_sma = distance_close_sma / this.cleaned_obj_current_market_data.ma24h;
            this.local_stat.push(distance_close_sma_percentage_from_sma)

            if (this.mode === 'waiting_for_buy') {
                if (distance_close_sma_percentage_from_sma < this.parameters.trade_risk_negative) {
                    console.log('buy!!!!!', distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_sma_percentage_from_sma > this.parameters.trade_risk) {
                    console.log('sell!!!!!', distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_buy';
                    this.sell_btc(this.btc_balance)

                }
            }

        }
    }

    offline_trade_sudden_growth_difference_from_moving_average() {
        this.strategy = "sudden growth distance percentage peak of ticker close vs 24h moving average"
        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {
            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data.ma24h
            var distance_close_sma_percentage_from_sma = distance_close_sma / this.cleaned_obj_current_market_data.ma24h;
            this.local_stat.push(distance_close_sma_percentage_from_sma)

            if (this.mode === 'waiting_for_buy') {
                if (distance_close_sma_percentage_from_sma > -this.parameters.lower_trade_risk && distance_close_sma_percentage_from_sma < this.parameters.lower_trade_risk) {
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_sma_percentage_from_sma > this.parameters.trade_risk) {
                    console.log('sell!!!!!', distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_buy';
                    this.sell_btc(this.btc_balance)
                }
            }

        }
    }

    offline_trade_sudden_growth_difference_from_moving_average_no_sell_low() {
        this.strategy = "sudden growth distance percentage peak of ticker close vs 24h moving average and never sell lower than last buy price"
        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {
            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data.ma24h
            var distance_close_sma_percentage_from_sma = distance_close_sma / this.cleaned_obj_current_market_data.ma24h;
            this.local_stat.push(distance_close_sma_percentage_from_sma)

            if (this.mode === 'waiting_for_buy') {
                if (distance_close_sma_percentage_from_sma > -this.parameters.lower_trade_risk && distance_close_sma_percentage_from_sma < this.parameters.lower_trade_risk) {
                    console.log('buy!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_sma_percentage_from_sma > this.parameters.trade_risk) {
                    if (this.cleaned_obj_current_market_data.close_price > this.last_buy_price) { //second condition
                        console.log('sell!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                        this.mode = 'waiting_for_buy';
                        this.sell_btc(this.btc_balance)

                    }
                }
            }

        }
    }

    offline_trade_all_time_high_watcher() {
        this.strategy = " this.strategy all time high watcher "

        if (typeof (this.cleaned_obj_current_market_data.ma24h) !== "undefined") {
            // if(this.isAllTimeHigh===1){
            //
            //     hasPreviouslyReachedAllTimeHigh = true
            //     console.log(this.cleaned_obj_current_market_data.timestamp+" "+this.cleaned_obj_current_market_data.ma24h,this.cleaned_obj_current_market_data.ma1h+" "+this.cleaned_obj_current_market_data.min_step_change+" "+this.cleaned_obj_current_market_data.volume)
            // }else {
            //     if(hasPreviouslyReachedAllTimeHigh){
            //         console.log(this.cleaned_obj_current_market_data.timestamp+" "+this.cleaned_obj_current_market_data.ma24h,this.cleaned_obj_current_market_data.ma1h+" "+this.cleaned_obj_current_market_data.min_step_change+" "+this.cleaned_obj_current_market_data.volume+" #");
            //     }
            //     hasPreviouslyReachedAllTimeHigh = false
            // }
            // return;
            var distance_close_sma = this.cleaned_obj_current_market_data.close_price - this.cleaned_obj_current_market_data.ma24h
            var distance_close_sma_percentage_from_sma = distance_close_sma / this.cleaned_obj_current_market_data.ma24h;
            this.local_stat.push(distance_close_sma_percentage_from_sma)

            if (this.mode === 'waiting_for_buy') {
                if (distance_close_sma_percentage_from_sma > -this.parameters.lower_trade_risk && distance_close_sma_percentage_from_sma < this.parameters.lower_trade_risk) {
                    console.log('buy!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                    this.mode = 'waiting_for_sell'
                    this.buy_btc(this.zar_balance)
                }

            } else {

                if (distance_close_sma_percentage_from_sma > this.parameters.trade_risk) {
                    if (this.cleaned_obj_current_market_data.close_price > this.last_buy_price && this.isAllTimeHigh) { //second condition
                        console.log('sell!!!!!' + this.cleaned_obj_current_market_data.timestamp, distance_close_sma_percentage_from_sma)
                        this.mode = 'waiting_for_buy';
                        this.sell_btc(this.btc_balance)

                    }
                }
            }

        }
    }

}
sample_strategy.parameters = {
    myParam: 0.09,
}

sample_strategy.info =
    "<ul>" +
    "<li>Write the info about the strategy here</li>" +
    "<li>You can user html tags</li>" +
    "</ul>";

module.exports = sample_strategy