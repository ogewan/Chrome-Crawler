/* jshint esversion: 6*/
const domMap = {},
    fs = require("fs-extra"), 
    path = require("path"),
    url = require('url'),

    lineReader = require('readline').createInterface({
        input: fs.createReadStream('_cfcorpus.csv')
    });

lineReader.on('line', line => {
    let uri = (new URL(line)).hostname;
    if (domMap[uri]) {
        domMap[uri] += 1;
    } else {
        domMap[uri] = 1;
    }
});
lineReader.on('close', () => {
    fs.writeFileSync(path.resolve(__dirname, "_domcnt.csv"), JSON.stringify(domMap, null, 2));
});