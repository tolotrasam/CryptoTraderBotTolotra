/**
 * Created by Tolotra Samuel on 12/01/2018.
 */
class SMA {
    constructor(array, obj, candle_size, graph_data, id) {

        this.id = id
        this.graph_data = graph_data
        this.indicator_graph = {
            id: this.id,
            data: [],
            type: 'line',
            name: 'ma1h'
        }
        this.graph_data[this.id] = (this.indicator_graph)

        this.cleaned_obj_current_market_data = obj
        this.cleaned_array_offline_array_data = array
        this.candle_size = candle_size
        var hours_step_size = 1 * 2 * 2 * 3;
        var daily_step_size = 24 * 2 * 2 * 3;
        var range = this.candle_size;
        switch (range) {
            case '1m':
                this.hours_step_size = 60;
                break;
            case '5m':
                this.hours_step_size = 12;
                break;
            case '15m':
                this.hours_step_size = 4;
                break;
            case '1h':
                this.hours_step_size = 1;
                break;
            case '3h':
                this.hours_step_size = 1;
                break;
        }

        this.max_step_size_indicator = this.hours_step_size

    }

    getMaxStepSize() {
        return this.max_step_size_indicator
    }

    calculateIndicator(candle) {

        var n = this.cleaned_array_offline_array_data.length


        if (n >= this.hours_step_size) {
            this.cleaned_obj_current_market_data.hourly_growth = (this.cleaned_obj_current_market_data.average_price - this.cleaned_array_offline_array_data[n - this.hours_step_size].average_price) / this.cleaned_array_offline_array_data[n - this.hours_step_size].average_price

//calculating the moving average
            var sum = this.cleaned_obj_current_market_data.close_price;
            for (var i = 1; i < this.hours_step_size; i++) {
                sum = sum + this.cleaned_array_offline_array_data[n - i].average_price
            }
            // console.log(sum)
            this.cleaned_obj_current_market_data[this.id] = sum / this.hours_step_size;
            // console.log(cleaned_data.hourly_growth, cleaned_data.average_price +" "+cleaned_offline_data[n - 2].average_price)
        }

        //MA GROWTHS REQUIRES THE LENGH OF A SMA TO BE LOADED TWICE
        if (n >= this.hours_step_size * 2) {
            this.cleaned_obj_current_market_data.daily_ma1h_growth = (this.cleaned_obj_current_market_data[this.id] - this.cleaned_array_offline_array_data[n - this.hours_step_size][this.id]) / this.cleaned_array_offline_array_data[n - this.hours_step_size][this.id]
            // console.log( this.cleaned_obj_current_market_data.daily_ma1h_growth)
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