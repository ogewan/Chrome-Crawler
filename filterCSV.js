/* jshint ignore:start*/
const csv = require('csv-streamify'),
    fs = require('fs')

const csvp = csv(),
    filter = [0, 1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
let fcsv = [];
// emits each line as a buffer or as a string representing an array of fields
csvp.on('data', line => {
    //console.log(line);
    let filtered = line.filter((e, i) => !filter.includes(i)).join(',');
    //console.log(filtered);
    //fcsv.push(line.filter((e, i) => !filter.includes(i)));
    fs.appendFileSync("_fcorpus.csv", `${filtered}\r\n`);
    0;
});

// now pipe some data into it
fs.createReadStream('_corpus.csv').pipe(csvp);
/* jshint ignore:end*/