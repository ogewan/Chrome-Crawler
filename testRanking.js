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
    resulter = {
        srPath: path.resolve(__dirname, `_siteResults.c.${(new Date()).valueOf()}.json`),
        siteRes: {},
        timeout: -1,
    },
    scheduledWrite = () => {
        let {srPath, siteRes} = resulter;
        try {
            fs.writeFileSync(srPath, JSON.stringify(siteRes, null, 1)); 
            console.log(`Write @ ${msToTime((new Date()).valueOf())}`)
        } catch (e) {
            console.log(e);
        }
        resulter.timeout = setTimeout(scheduledWrite, 10000);
    },
    tester = async (targets, opts = {}) => {
        //console.log(opts);
        const dargs = pup.defaultArgs().filter(arg => String(arg).toLowerCase() !== '--disable-extensions'),
            browser = (opts.WSE) ? await pup.connect({browserWSEndpoint: opts.WSE}) :
            await pup.launch({
                ignoreDefaultArgs: true,
                args: [
                    //...dargs,
                    `--load-extension=${path.resolve(__dirname, "ext")}`
                ],
                headless: false
            }),
            page = opts.WSE ? await browser.newPage() : null;
        
        if (!opts.WSE) {
            let lineNum = 0,
                continueNum = 0;
                
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
                            resulter.siteRes[lno] = data.result;
                            if (!resulter.active) {
                                resulter.active = true;
                                scheduledWrite();
                            }
                        }
                        if (targets.length) {
                            task.method = "test";
                            task.data = { src: targets.pop(), lno: lineNum };
                            /*while(task.data.src && task.data.src.includes("express.co.uk") && targets.length){
                                lineNum++;
                                task.data = { src: targets.pop(), lno: lineNum };
                            }*/
                            if (!task.data.src) {
                                console.log("List exhausted prematurely")
                                if (childStatus[id] != "sleep") childStatus[id] = "sleep";
                                task.method = "finish";
                            } else {
                                console.log(`${lineNum}/${total} => [${id}]`)
                                lineNum++;
                            }
                        } else {
                            if (childStatus[id] != "sleep") childStatus[id] = "sleep";
                            task.method = "finish";
                        }
                        child[id].send(task);
                    }
                };

            console.log(`There are ${child.length} children`);
            if (continueNum) {
                //line count starts at 1, but arrays start at 0
                //addenda: siteResult starts from 0, considers line 1 to be 0
                //s.t last entry in siteResults is line num = key num + 1
                continueNum -= 1;
                console.log(`Continuing from index ${continueNum}`);
                targets = targets.slice(continueNum);
                lineNum = continueNum;
            }
            targets = targets.reverse();
            await Promise.all(child.map((e, index) => cpx.forkCPP([index, browser.wsEndpoint()], {child, index, mHandler})));
            scheduledWrite();
            clearTimeout(resulter.timeout);
            process.exit();
        } else {
            console.log(`${opts.identity} has woken`);
            let status = "awake", activeTab = true;
            //page.setDefaultNavigationTimeout(15000);
            const mMethods = {
                test: async d => {
                    let { src, lno } = d,
                        scStr = [], scEnd = [], data = {};
                    try {
                        await page.setBypassCSP(true);
                        await page.goto(src);
                        //CSV report order startTime, baseLinkCount, score, rating, endTime
                        await page.waitForSelector("sc-1");
                        scStr = await page.$eval('sc-1', e => [e.getAttribute("time"), [e.getAttribute("count")]]);//, e.getAttribute("href")]);
                        await page.waitForSelector("sc-2");
                        scEnd = await page.$eval('sc-2', e => [e.getAttribute("time"), [e.getAttribute("score"), e.getAttribute("rating")]]);
                        data = {result: [scEnd[0] - scStr[0], ...scStr[1], ...scEnd[1]].join(",")};
                    } catch (e) {
                        let result = [];
                        if (!scStr.length) {
                            result = "0,0,0,Failed: Page Load"
                        } else {
                            result = `30000,${scStr[1]},0,Failed: Timeout`
                        }
                        data = {result};
                        console.log(e);
                    }
                    process.send( { data, id: opts.identity, lno } );
                    console.log(`   <=`);
                },
                finish: (d, done) => {
                    console.log(`${opts.identity} is going to sleep`);
                    if (status == "awake") {
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
            input: fs.createReadStream('_balSiteList.csv')
        });

    lineReader.on('line', line => siteList.push(line))
    lineReader.on('close', () => tester(siteList, opts));
} else tester([], opts);