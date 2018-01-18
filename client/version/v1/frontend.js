/**
 * Created by Tolotra Samuel on 04/01/2018.
 */
var app = angular.module('myApp', ['ngSanitize'])
app.directive('jsonText', function () {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function (scope, element, attr, ngModel) {
            function into(input) {
                return JSON.parse(input);
            }

            function out(data) {
                return JSON.stringify(data, null, 2);
            }

            ngModel.$parsers.push(into);
            ngModel.$formatters.push(out);

        }
    };
});

app.config(function($routeProvider) {
    $routeProvider
        .when("/", {
            templateUrl : "main.htm"
        })
        .when("/red", {
            templateUrl : "red.htm"
        })
        .when("/green", {
            templateUrl : "green.htm"
        })
        .when("/blue", {
            templateUrl : "blue.htm"
        });
});
app.controller('ChatController', function ($scope) {

    $scope.myData = [1, 4, 5, 5, 10];
    var socket = io.connect();

    $scope.messages = [];
    $scope.roster = [];
    $scope.roster = [];
    $scope.placeholder = {
        mode: [
            {name: "Tradebot", slug: "tradebot"},
            {name: "Paper Trader", slug: "paper_trade"},
            {name: "Backtest", default: true, slug: "backtest"}]
    };
    $scope.text = '';
    $scope.settings = {}
    $scope.data_range = {}
    $scope.botdefault = {trades: [], status: {state: 'waiting for something to do'}}
    $scope.bot = JSON.parse(JSON.stringify($scope.botdefault))
    socket.on('connect', function () {
        $scope.setName();
    });
    function getDefaultObj(obj) {
        console.log(obj)
        for (var el of obj) {
            if (el.hasOwnProperty('default')) {
                if (el.default) {
                    return el;
                    break
                }
            }
        }
        return obj[0]
    }

    function getBulkDefault() {
        // Object.assign($scope.settings, $scope.placeholder)
        for (let key in $scope.placeholder) {
            //if the placeholder is an array, meaning that it goes inside selects
            if (Array.isArray($scope.placeholder[key])) {
                $scope.settings[key] = getDefaultObj($scope.placeholder[key]).slug
            } else {
                $scope.settings[key] = $scope.placeholder[key]
            }
        }
    }

    socket.on('placeholder', function (msg) {
        // alert(msg)
        Object.assign($scope.placeholder, msg);
        console.log($scope.placeholder, 'placeholders')

        getBulkDefault()

        $scope.settings.strategy = getDefaultObj($scope.placeholder.strategy)
        $scope.newDataAvailableRange($scope.settings.available_since, $scope.settings.available_until)
        $scope.$apply();
        console.log($scope.placeholder)
    });

    socket.on('message', function (msg) {
        $scope.messages.push(msg);
        $scope.$apply();
    });

    socket.on('roster', function (names) {
        $scope.roster = names;
        $scope.$apply();
    });

    //When bot is running
    socket.on('init', function (data) {
        console.log(data)
        Object.assign($scope.bot, data)
        $scope.$apply()
    })
    socket.on('status', function (data) {
        console.log(data)
        Object.assign($scope.bot, {status: data})
        $scope.$apply()
    })
    socket.on('candle', function (data) {
        console.log('new candle', data)
        Object.assign($scope.bot, data)
        $scope.$apply()
    })
    socket.on('candle_live', function (data) {
            console.log('new candle', data)
            Object.assign($scope.bot, data.candleUpdate);

            for (var serie of chart.series) {
                if (typeof serie.userOptions !== typeof undefined) {
                    if (serie.userOptions.id === 'close_serie') {
                        var ticker = [data.candleUpdate.current_data_timestamp * 1000, data.candleUpdate.current_price]
                        console.log('ticker added to chart: ', ticker)
                        serie.addPoint(ticker)
                    } else {
                        for (var chartUpate of data.chartUpdate) {
                            if (serie.userOptions.id === chartUpate.id) {
                                console.log('Indicator added to chart: ', chartUpate.data)
                                serie.addPoint(chartUpate.data)
                            }
                        }
                    }
                }
            }

            $scope.$apply()
        }
    )

    socket.on('trade', function (data) {
        console.log(data)
        var EntryExitTradePair = {}

        if (data.trade.type === 'buy') {
            EntryExitTradePair.buy = data.trade
            $scope.bot.trades.unshift(EntryExitTradePair)
        } else {
            $scope.bot.trades[0].sell = data.trade
        }
        if (typeof chart !== typeof undefined) {
            for (var serie of chart.series) {
                if (typeof serie.userOptions !== typeof undefined) {
                    if (serie.userOptions.id === data.trade.type) {
                        var ticker = {x: data.trade.timestamp}
                        if (data.trade.type === 'buy') {
                            ticker.text = 'Buy @' + data.trade.price
                            ticker.title = 'B'
                        } else {
                            ticker.text = 'Sell @' + data.trade.price
                            ticker.title = 'S'
                        }
                        serie.addPoint(ticker)
                    }
                }
            }
        }


        var tradeData = JSON.parse(JSON.stringify(data.trade))
        delete data.trade
        Object.assign($scope.bot, data)
        $scope.bot.asset_balance = tradeData.asset_balance
        $scope.bot.currency_balance = tradeData.currency_balance


        $scope.$apply()
    })

    socket.on('stop', function (data) {
        console.log(data)
        Object.assign($scope.bot, data)
        $scope.showStartNewBtn = true;
        $scope.show_pause_stop_Btn = false;
        $scope.hide_start_btn = true;
        $scope.$apply()

        console.log('tradehistory gathered from on candle', $scope.bot.trades)
    })

    socket.on('init_live', function (data) {
        console.log(data)
        Object.assign($scope.bot, data)
        $scope.$apply()
        console.log('tradehistory gathered from on candle', $scope.bot.trades)
    })

    socket.on('allChartData', function (data) {
        console.log('Chart', data)
        // showChart(data)
        createChart(data, $scope.settings.asset + ' to ' + $scope.settings.currency + ' exchange rate');
        $scope.showChart = true
        $scope.$apply()
    })

    $scope.start_new = function () {
        $scope.checkAvailableData()
        $scope.showStartNewBtn = false;
        $scope.hide_start_btn = false;
        $scope.started = false
        $scope.showChart = false
        $scope.bot = JSON.parse(JSON.stringify($scope.botdefault)) //resetings values
        // $scope.$apply()
    }

    ///*****End when bot is running
    $scope.checkAvailableData = function () {
        socket.emit('checkAvailableData', $scope.settings);
    }
    socket.on('checkAvailableData', function (rangeObj) {
        console.log(rangeObj, 'checkAvailableData')
        Object.assign($scope.settings, rangeObj)
        $scope.newDataAvailableRange($scope.settings.available_since, $scope.settings.available_until)
        $scope.$apply()
    })
    $scope.send = function send() {
        console.log('Sending message:', $scope.text);
        socket.emit('message', $scope.text);
        $scope.text = '';
    };

    $scope.newDataAvailableRange = function (since, until) {
        $scope.data_range.available_since = since
        $scope.data_range.available_until = until
        create_time_picker(since, until)
        $scope.$apply()
    }
    $scope.modes = ["Tradebot", "Paper Trader", "Backtest"];

    $scope.start = function () {
        console.log('Starting with settings:', $scope.settings);
        $scope.showStartNewBtn = false;
        $scope.hide_start_btn = true;
        $scope.started = true
        $scope.show_pause_stop_Btn = true;

        socket.emit('start', ($scope.settings));
    };

    $scope.stop = function () {
        console.log('stopping bot...')
        $scope.bot.id = 0
        socket.emit('stop_bot', $scope.bot.id);
    }

    $scope.setName = function setName() {
        // socket.emit('identify', $scope.name);
        socket.emit('placeholder', $scope.name);
    };

});
app.filter('millSecondsToTimeString', function () {
    return function (millseconds) {
        var oneSecond = 1000;
        var oneMinute = oneSecond * 60;
        var oneHour = oneMinute * 60;
        var oneDay = oneHour * 24;

        var seconds = Math.floor((millseconds % oneMinute) / oneSecond);
        var minutes = Math.floor((millseconds % oneHour) / oneMinute);
        var hours = Math.floor((millseconds % oneDay) / oneHour);
        var days = Math.floor(millseconds / oneDay);

        var timeString = '';
        if (days !== 0) {
            timeString += (days !== 1) ? (days + ' days ') : (days + ' day ');
        }
        if (hours !== 0) {
            timeString += (hours !== 1) ? (hours + ' hours ') : (hours + ' hour ');
        }
        if (minutes !== 0) {
            timeString += (minutes !== 1) ? (minutes + ' minutes ') : (minutes + ' minute ');
        }
        if (seconds !== 0 || millseconds < 1000) {
            timeString += (seconds !== 1) ? (seconds + ' seconds ') : (seconds + ' second ');
        }

        return timeString;
    };
});
app.filter('nicePercentage', function () {
    return function (percentage) {
        var nicePercentageSrt;
        var nicePercentage = percentage.toFixed(2)
        if (nicePercentage > 0) {
            nicePercentageSrt = '<span class="positive-growth">+' + nicePercentage + '</span>';
        } else if (nicePercentage < 0) {
            nicePercentageSrt = '<span class="negative-growth">' + nicePercentage + '</span>';
        } else {
            nicePercentageSrt = '<span class="neutral-growth">' + nicePercentage + '</span>';
        }
        return nicePercentageSrt
    };
});


/**
 * Create the chart when all data is loaded
 * @returns {undefined}
 */
var chart;
function createChart(data, title) {
    Highcharts.setOptions({
        global: {
            timezoneOffset: new Date().getTimezoneOffset()
        }
    });

    // Create the chart
    chart = Highcharts.stockChart('container', {

        chart: {
            zoomType: 'x'
        },

        rangeSelector: {
            selected: 1
        },

        title: {
            text: title
        },

        yAxis: {
            title: {
                text: 'Close Price'
            }
        },

        series: data
    });
}
function create_time_picker(start_unix, end_unix) {

    console.log(' creating time picker ' + start_unix, end_unix)


    var start = moment.unix(start_unix)
    var end = moment.unix(end_unix);
    console.log(end.diff(start))
    if (end.diff(start) > 86400000) {
        start = start.add(1, 'days')
    }
    if (end.diff(start) > 30*86400000) {
        start = start.add(7, 'days')
    }
    if (!start.isValid()) {
        start = moment().subtract(1, 'months')
    }
    if (!end.isValid()) {
        end = moment()
    }
    var max = moment();
    var min = moment().subtract(2, 'years');

    function cb(start, end) {
        $('#reportrange span').html(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
        console.log(start)
        console.log(end)

        var appElement = document.querySelector('[ng-app=myApp]');
        var $scope = angular.element(appElement).scope();
        console.log($scope, 'scope')
        $scope.$apply(function () {
            $scope.settings.available_since = start.format('X');
            $scope.settings.available_until = end.format('X');
        });

    }

    $('#reportrange').daterangepicker({
        startDate: start,
        minDate: min,
        timePicker: true,
        maxDate: max,
        timePickerIncrement: 30,
        showDropdowns: true,
        locale: {
            format: 'MM/DD/YYYY h:mm A'
        },
        endDate: end,
        ranges: {
            'Today': [moment().startOf('day'), moment()],
            'Yesterday': [moment().subtract(1, 'days').startOf('day'), moment().startOf('day')],
            'Last 7 Days': [moment().subtract(7, 'days'), moment()],
            'Last 30 Days': [moment().subtract(30, 'days'), moment()],
            'This Month': [moment().startOf('month'), moment()],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    }, cb);

    cb(start, end);

}