/* jshint esversion: 6*/
const fs = require("fs-extra"), 
    path = require("path"),
    url = require('url'),
    domMap = JSON.parse(fs.readFileSync(path.resolve(".", "ext", "siteMap.json"))),

    lineReader = require('readline').createInterface({
        input: fs.createReadStream(path.resolve(".", '_fcorpus.csv'))
    });

let lineCnt = 0;

lineReader.on('line', line => {
    try {
        //let uri = (new URL(href)).hostname.split(".")[0];
        //if (lineCnt%100000 == 0) { console.log(lineCnt); }
        let href = line.split(",")[2], phref = href.split(" "), uri;

        if (phref.length == 1 && phref[0].length) {
            uri = (new URL(phref[0])).hostname;

            if (uri.includes("www")) {
                uri = uri.substr(4);
            }
            if (domMap[uri] && domMap[uri].type) {
                domMap[uri] = href;
                fs.appendFileSync(path.resolve(".", "_balSitelist.csv"), domMap[uri] + "\n");
            } else if (!domMap[uri]) {
                domMap[uri] = href;
                fs.appendFileSync(path.resolve(".", "_balSitelist.csv"), domMap[uri] + "\n");
            }
            
        }
    } catch (e) {
        //console.log(e);
    }
    lineCnt++;
});

lineReader.on('close', () => {
    /*let bSitelist = Object.values(domMap), target;

    for (let href of bSitelist) {
        if (href.type) {
            target = "https://www.google.com/1";
        } else {
            target = href;
        }
        fs.appendFileSync(path.resolve(".", "_balSitelist.csv"), target + "\n");
    }*/
});