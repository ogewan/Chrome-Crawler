/* jshint ignore:start*/
/**
 * 1. Test Extension on sites
 */
const pup = require("puppeteer"),
    fs = require("fs-extra"), 
    path = require("path"),
    cpx = require("./fork.js"),
    util = require('util'),
    sp = (process.platform == "win32") ? "\r\n" : " \n",
    //siteMap = JSON.parse(fs.readFileSync("ext/sitemap.json")),
    msToTime = s => {
        //https://stackoverflow.com/a/9763769
        // Pad to 2 or 3 digits, default is 2
        var pad = (n, z = 2) => ('00' + n).slice(-z);
        return pad(s/3.6e6|0) + ':' +
            pad((s%3.6e6)/6e4 | 0) + ':' +
            pad((s%6e4)/1000|0) + '.' + pad(s%1000, 3);
    },
    tester = async (targets, opts = {}) => {
        //console.log(opts);
        const browser = (opts.WSE) ? await pup.connect({browserWSEndpoint: opts.WSE}) :
            await pup.launch({
                //headless: false
            }),
            page = opts.WSE ? await browser.newPage() : null;
        
        if (!opts.WSE) {
            let srPath = path.resolve(__dirname, "_siteResuts.json"),
                lineNum = 0,
                siteRes = {};
                
            const child = Array(opts.tabs).fill(),
                childStatus = Array(opts.tabs).fill("awake"),
                total = targets.length,
                mHandler = (m) => {
                    let { data, id, lno } = m, 
                        task = {};

                    if (data.closeTab) {
                        if (!childStatus.includes("awake")) {
                            browser.close();
                        }
                    } else {
                        if (data.result) {
                            siteRes[lno] = data.result;
                            try {
                                fs.writeFileSync(srPath, JSON.stringify(siteRes, null, 2)); 
                            } catch (e) {
                                console.log(e);
                            }
                        }
                        if (targets.length) {
                            task.method = "test";
                            task.data = { src: targets.pop(), lno: lineNum };
                            console.log(`${lineNum}/${total} => [${id}]`)
                            lineNum++;
                        } else {
                            if (childStatus[id] != "sleep") childStatus[id] = "sleep";
                            task.method = "finish";
                        }
                        child[id].send(task);
                    }
                };
            console.log(`There are ${child.length} children`);
            await Promise.all(child.map((e, index) => cpx.forkCPP([index, browser.wsEndpoint()], {child, index, mHandler})));
            process.exit();
        } else {
            console.log(`${opts.identity} has woken`);
            let status = "awake", activeTab = true;
            const mMethods = {
                test: async d => {
                    let { src, lno } = d,
                        scStr = null, scEnd = null, scRep = {};
                    try {
                        await page.goto(src);
                        await page.addScriptTag({content: "TESTER_smp = "+ fs.readFileSync("ext/sitemap.json")});
                        await page.addScriptTag({path: "ext/jquery-3.3.1.min.js"});
                        await page.addScriptTag({path: "ext/scCheck.js"});
                        await page.waitForSelector("sc-2");
                        //CSV report order startTime, baseLinkCount, score, rating, endTime
                        scStr = await page.$eval('sc-1', e => [e.getAttribute("time"), e.getAttribute("count")]);//, e.getAttribute("href")]);
                        scEnd = await page.$eval('sc-2', e => [e.getAttribute("time"), e.getAttribute("score"), e.getAttribute("rating")]);
                        data = {result: [...scStr, ...scEnd].join(",")};
                    } catch (e) {
                        //console.log(`${(mID/mTotal*100).toFixed(2)}% [${mID}/${mTotal}] (${status}) ${src} \n${e}`);
                        //data = { e: e.toString(), name, images, count, src, mID };
                        console.log(e);
                        0;
                    }
                    process.send( { data, id: opts.identity, lno } );
                },
                finish: (d, done) => {
                    if (status == "sleep") {
                        teardown(done);
                    } else {
                        done();
                    }
                }
            },
            teardown = async (finish) => {
                await page.close();
                await browser.disconnect();
                process.send( { data: {closeTab: true} , id: opts.identity } );
                if (finish) {
                    finish();
                }
            };

            await (util.promisify(cb => {
                process.on("message", (m) => {
                    let { method, data } = m;
                    mMethods[method](data, cb);
                });
                process.send( { data: { }, id: opts.identity } );
            }))();
            process.exit();
        }
    };

let opts = { tabs: 10 };
//CLI args
process.argv.forEach((val, index) => {
    if (index == 2) {
        opts.identity = val;
    }
    if (index == 3) {
        opts.WSE = val;
    }
});

//Main Thread
if (!opts.WSE) {
    let siteList = [],
        lineReader = require('readline').createInterface({
            input: fs.createReadStream('_cfcorpus.csv')
        });

    lineReader.on('line', line => siteList.push(line))
    lineReader.on('close', () => tester(siteList, opts));
} else tester([], opts);