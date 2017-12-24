var username = 'rsamuel15'
var api_key = 'Eg0IklLSz0DDswYdllCc'

var plotly = require('plotly')(username, api_key);

module.exports = {
    plot: function (callback,traces) {
        plot(callback,traces)
    }
}

function plot(callaback, traces) {

    var data = traces;

    var graphOptions = {filename: "crypto_simulation", fileopt: "overwrite"};
    plotly.plot(data, graphOptions, function (err, msg) {
        console.log(msg);
        if(callaback){
            callaback()
        }
    });
}


