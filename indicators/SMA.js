/**
 * Created by Tolotra Samuel on 12/01/2018.
 */
class SMA {
    constructor(array, obj, candle_size, graph_data, id, params) {
        //DEFAULT VARIABLES
        this.params = params
        this.id = id
        this.graph_data = graph_data
        this.cleaned_obj_current_market_data = obj
        this.cleaned_array_offline_array_data = array
        this.candle_size = candle_size
        //OPTIONALS
        this.indicator_graph = {
            id: this.id,
            data: [],
            type: 'line',
            name: params.count+' '+params.unit+' SMA'
        }
        this.graph_data[this.id] = (this.indicator_graph)
        //YOUR VARIABLES

        var range = this.candle_size;
        switch (range) {
            case '1m':
                this.range_in_minute = 1;
                break;
            case '5m':
                this.range_in_minute = 5;
                break;
            case '15m':
                this.range_in_minute = 15;
                break;
            case '1h':
                this.range_in_minute = 60;
                break;
            case '3h':
                this.range_in_minute = 180;
                break;
        }

        var sma_unit_in_min
        switch (this.params.unit) {
            case 'minutes':
                sma_unit_in_min = 1
                break;
            case 'hours':
                sma_unit_in_min = 60
                break;

            case 'days':
                sma_unit_in_min = 60 * 24
                break;
        }
        this.sma_lenght_step_in_min = sma_unit_in_min * this.params.count
        this.max_step_size_indicator = this.sma_lenght_step_in_min/this.range_in_minute

    }

    getMaxStepSize() {
        return this.max_step_size_indicator
    }

    calculateIndicator(candle) {

        var n = this.cleaned_array_offline_array_data.length

        if (n >= this.max_step_size_indicator) {
            this.cleaned_obj_current_market_data.hourly_growth = (this.cleaned_obj_current_market_data.average_price - this.cleaned_array_offline_array_data[n - this.max_step_size_indicator].average_price) / this.cleaned_array_offline_array_data[n - this.max_step_size_indicator].average_price
            //calculating the moving average
            var sum = this.cleaned_obj_current_market_data.close_price;
            for (var i = 1; i < this.max_step_size_indicator; i++) {
                sum = sum + this.cleaned_array_offline_array_data[n - i].average_price
            }
            this.cleaned_obj_current_market_data[this.id] = sum / this.max_step_size_indicator;
        }
    }



    insertChartData() {
        this.indicator_graph.data.push([this.cleaned_obj_current_market_data.timestamp, this.cleaned_obj_current_market_data[this.id]])
    }

    getIndicatorChartTicker() {

        var ticker = {
            id: this.indicator_graph.id,
            data: [this.cleaned_obj_current_market_data.timestamp, this.cleaned_obj_current_market_data[this.id]]
        }
        return ticker;
    }

}

module.exports = SMA