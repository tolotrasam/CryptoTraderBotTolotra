/**
 * Created by Tolotra Samuel on 12/01/2018.
 */
class Indicators {
    constructor(array, obj, candle_size, graph_data) {
        this.indicators = []
        this.graph_data = graph_data
        this.obj = obj
        this.array = array
        this.candle_size = candle_size
    }

    addIndicators(name, id, params={}) {

        var path = './indicators/'
        var Indicator = require(path + name + '.js')
        var indicator = new Indicator(this.array, this.obj, this.candle_size,this.graph_data,id,params)
        this.indicators.push({indicatorObj:indicator, params:params})

    }

    getMaxStepSize() {
        var max_step_size_indicator = 0
        for (var indicator of this.indicators) {
            if (typeof indicator.indicatorObj.getMaxStepSize === 'function') {
                if (indicator.indicatorObj.getMaxStepSize() > max_step_size_indicator) {
                    max_step_size_indicator = indicator.indicatorObj.getMaxStepSize()
                }
            }
        }
        console.log('max_step_size_indicator is '+ max_step_size_indicator)
        return max_step_size_indicator
    }

    calculateAllIndicators(candle) {
        for (var indicator of this.indicators) {
            indicator.indicatorObj.calculateIndicator(candle)
        }
    }
    insertChartData() {
        for (var indicator of this.indicators) {

            if (indicator.params.hasOwnProperty('showChart')) {
                if (indicator.params.showChart===true) {
                    if (typeof indicator.indicatorObj.insertChartData === 'function') {
                        indicator.indicatorObj.insertChartData()
                    }
                }
            }
        }
    }
    getIndicatorChartTicker() {
        var ticker
        var tickers = []
        for (var indicator of this.indicators) {

            if (indicator.params.hasOwnProperty('showChart')) {
                if (indicator.params.showChart===true) {
                    if (typeof indicator.indicatorObj.getIndicatorChartTicker === 'function') {
                        var ticker = indicator.indicatorObj.getIndicatorChartTicker()
                        tickers.push(ticker)
                    }
                }
            }
        }
        return tickers
    }
}

module.exports = Indicators