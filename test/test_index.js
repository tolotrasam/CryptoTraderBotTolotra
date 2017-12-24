now = new Date();
last5mTimestamp = now - now % (1000*60*5)
startTickerLoggingTimestamp  = last5mTimestamp - (1000*60*60*24*2)

console.log( last5mTimestamp,startTickerLoggingTimestamp);
// console.log(typeof testfoo());
//1514135700000