/* jshint ignore:start*/
const csv = require('csv-streamify'),
    fs = require('fs'),
    csvp = csv(),
    siteMap = JSON.parse(fs.readFileSync("ext/sitemap.json"));

csvp.on('data', line => {
    //console.log(line);
    //_fcorpus is corrupted, ignore any numerical key or key with spaces (not valid host)
    let tar = line[0];
    if (line.length == 3 && !siteMap[tar] && !tar.includes(" ") && tar.includes(".")) {
        fs.appendFileSync("_cfcorpus.csv", `${line[2]}`);
    }
});

// now pipe some data into it
fs.createReadStream('_fcorpus.csv').pipe(csvp);
/* jshint ignore:end*/