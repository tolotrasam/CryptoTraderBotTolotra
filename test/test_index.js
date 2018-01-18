const request = require('request')
const fs = require('fs')
const history_trades = require('../analysis/local_history_log.json')
var filename = 'from_1480550400to_1514053361_5mquote_cleaned'


function sumProfit() {

    var profit = 0;
    for(var n = 0 ; n< history_trades.length; n++){
        profit = history_trades[0].sell.profit+history_trades[0].buy.profit
    }
    console.log(profit)

}
function findPrice(price){
   price = price - price*0.002
   for(var n =0; n<bitfinex_raw.length;n++){
      if(bitfinex_raw[n][2] <= price && bitfinex_raw[n][0] >= 1501902300000){
         console.log(bitfinex_raw[n][2],  bitfinex_raw[n][0] )
      }
   }
}
function getStartegyList() {
    var StartDirPath = '../strategies/'
    var strategies = []
    var files = fs.readdirSync(StartDirPath);
    for(var file of files){
        if(fs.lstatSync(StartDirPath+file).isFile()){
            var startegy = {name:file.split('.')[0]}
            var startJs = require(StartDirPath+file)
            startegy.parameters = startJs.parameters
            strategies.push(startegy)
        }
    }
    // console.log('startegies:', strategies)
}
getStartegyList()
// sumProfit()
// findPrice(831.378185175563)