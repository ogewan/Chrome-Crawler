/* jshint ignore:start*/
/**
 * 1. Test Extension on sites
 */
const pup = require("puppeteer"),
    fs = require("fs-extra"), 
    path = require("path"),
    Axios = require("axios"),
    readline = require('readline'),
    cpx = require("./fork.js"),
    util = require('util'),
    archiver = require('archiver'),
    sanitize = require("sanitize-filename"),
    tally = { total: 0, success: 0, error: 0, ignore: 0 },
    timeStamp = (new Date()).valueOf(),
    sp = (process.platform == "win32") ? "\r\n" : " \n",
    truncate = str => (str.length > 25) ? `${str.substring(0, 25 - 3)}...` : str,
    removeDup = array => Object.keys(Object.assign({}, ...Object.entries({...array}).map(([a,b]) => ({ [b]: a })))),
    shuffleArray = array => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },
    msToTime = s => {
        //https://stackoverflow.com/a/9763769
        // Pad to 2 or 3 digits, default is 2
        var pad = (n, z = 2) => ('00' + n).slice(-z);
        return pad(s/3.6e6|0) + ':' +
            pad((s%3.6e6)/6e4 | 0) + ':' +
            pad((s%6e4)/1000|0) + '.' + pad(s%1000, 3);
    },
    bytesToSize = bytes => {
        //https://gist.github.com/lanqy/5193417
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
        if (bytes === 0) return 'n/a'
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10)
        if (i === 0) return `${bytes} ${sizes[i]}`
        return `${(bytes / (1024 ** i)).toFixed(1)} ${sizes[i]}`
    },
    injectExtract = () => {
        //link extract v.6
        console.log("link extract injected");
        //var removed to redefine ftn in page context
        download_next_image = function() {
            var newHtml = '';
            $("body").html(`<div id='name' style='font-weight: bold'>${galleryname_to_download}</div>
            <div id='count' style='font-weight: bold'>${urls_to_download.length}</div"`);
            $("body").append($("<div id='place' style='display:inline-block;'></div>"));
            $.each(urls_to_download, function(index, value) {
                newHtml += " <a class='iex' href='" + value + "' target='_blank'>"+ index + "</a> ";
            });
            $("#place").append($(newHtml));
        }
        $("#dl-button").click();
        return true;
    },
    downloadImage = async (url, name, title) => {
        const directory = path.resolve(opts.export, title);

        await fs.mkdirp(directory);
        
        const addr = path.resolve(directory, name);

        // axios image download with response type "stream"
        const response = await Axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            onDownloadProgress: (p) => {
                if (p.lengthComputable) {
                    readline.cursorTo(process.stdout, 0);
                    process.stdout.write(`${p.loaded}/${p.total}`);
                }
            }
        });

        // pipe the result stream into a file on disc
        response.data.pipe(fs.createWriteStream(addr));

        // return a promise and resolve when download finishes
        return new Promise((resolve, reject) => {
            response.data.on('end', () => {
                resolve();
            })

            response.data.on('error', () => {
                reject();
            })
        })
    },
    mangaGet = async (targets, opts = {}) => {
        //console.log("mangaGet", opts)
        if (targets.length) targets = shuffleArray(removeDup(targets));
        tally.total = targets.length;

        const writeFileP = util.promisify(fs.writeFile),
            browser = (opts.WSE) ? await pup.connect({browserWSEndpoint: opts.WSE}) :
            await pup.launch({
                headless: !opts.show,
                //slowMo: 2000
            }),
            page = opts.WSE ? await browser.newPage() : null;
        
        if (!opts.WSE) {
            let targetInstance = 0, zipState = false,
                mapLD = path.resolve(__dirname, "_mapLinks.json"),
                mapLinks;
            
            try { mapLinks = (fs.pathExistsSync(mapLD)) ? JSON.parse(fs.readFileSync(mapLD) || "{}") : {}; }
            catch (e) { console.log(e); mapLinks = {}; }
                
            const child = Array(opts.tabs).fill(),
                childStatus = Array(opts.tabs).fill("linkFetch"),
                childAssign = Array(opts.tabs).fill({}),
                linkMaps = [], zipMaps = [], failed = [],
                mHandler = (m) => {
                    //console.log(m);
                    let { data, id } = m, 
                        task = {};

                    if (data.e) {
                        console.log(data.e);
                        failed.push(data.src);
                        tally.error++;
                        childAssign[id] = {};
                        child[id].send({method: "ping"});
                    } else if (data.closeTab) {
                        if (!childStatus.includes("linkFetch")) {
                            fs.appendFileSync(path.resolve(opts.logs, `_${timeStamp}_out.txt`), `linkFetch completed @ ${new Date()}${sp}`);
                            browser.close();
                        }
                    } else {
                        if (data.images) {
                            linkMaps.push(data);
                            mapLinks[data.src] = data;
                            try { fs.writeFileSync(mapLD, JSON.stringify(mapLinks)); } catch (e) { console.log(e); }
                        } else if (data.dir) {
                            zipMaps.push(data);
                        } else if (data.success) {
                            tally.success++;
                        }

                        let unfinishedChild = childAssign.find(e => e.images && e.images.length);
                        if (childAssign[id].images && childAssign[id].images.length) {
                            task.method = "getSingleImage";
                            task.data = {
                                name: childAssign[id].name,
                                image: childAssign[id].images.pop(),
                                targetID: childAssign[id].cursor,
                                src: childAssign[id].src,
                                count: childAssign[id].count,
                                mID: childAssign[id].mID
                            };
                            childAssign[id].cursor++;
                        }
                        else if (targets.length) {
                            task.method = "getLinks";
                            //mID is slightly misleading
                            //it identfies the instance relative to the collective worker status
                            //the comic is identified by its src (url) not mID
                            //because of the way tasks are moved, mIDs flip
                            //requiring that displayed instance is mTotal - mID for every other status
                            //i.e linkFetch = mID, imageDown = mTotal - mID, fileZip = mID
                            while (1) {
                                task.data = { src: targets.pop(), mID: targetInstance };
                                targetInstance++;
                                if (task.data.src) {
                                    let { src, mID } = task.data, mTotal = tally.total;
                                    if (mapLinks[src]) {
                                        let { name, count } = mapLinks[src];
                                        console.log(`${(mID/mTotal*100).toFixed(2)}% [${mID}/${mTotal}] (preFetch) ${truncate(name)}: ${count} images listed`);
                                        linkMaps.push({...mapLinks[src], mID});
                                    } else {
                                        break;
                                    }
                                } else {
                                    task.method = "ping";
                                    break;
                                }
                            }
                        } else if (linkMaps.length) {
                            if (childStatus[id] != "imageDown") childStatus[id] = "imageDown";
                            task.method = "getImages";
                            //Assign
                            while (1) {
                                task.data = linkMaps.pop();
                                if (task.data) {
                                    let { name } = task.data;
                                    if (fs.pathExistsSync(path.resolve(opts.export, `${name}.cbz`))) {
                                        console.log(`${name}.cbz already exists!`);
                                    } else if (fs.pathExistsSync(path.resolve(opts.export, name, 'info.txt'))) {
                                        console.log(`${name} exists but has not been zipped!`);
                                        zipMaps.push( {
                                            dir: path.resolve(opts.export, name), 
                                            src: task.data.src, mID: task.data.mID, count: task.data.count
                                        });
                                    } else {
                                        break;
                                    }
                                    tally.ignore++;
                                } else {
                                    task.method = "ping";
                                    break;
                                }
                            }
                            if (task.method == "getImages") {
                                task.method = "ping";
                                childAssign[id] = task.data;
                                childAssign[id].cursor = 0; 
                                childAssign[id].images = childAssign[id].images.reverse();
                                task.data = null;
                            }
                        } else if (unfinishedChild) {
                            task.method = "getSingleImage";
                            task.data = {
                                name: unfinishedChild.name,
                                image: unfinishedChild.images.pop(),
                                targetID: unfinishedChild.cursor,
                                src: unfinishedChild.src,
                                count: unfinishedChild.count,
                                mID: unfinishedChild.mID
                            };
                            unfinishedChild.cursor++;
                        } else if (zipMaps.length) {
                            if (!zipState) {
                                fs.appendFileSync(path.resolve(opts.logs, `_${timeStamp}_out.txt`), `imageDown completed @ ${new Date()}${sp}`);
                                zipState = true;
                            }
                            if (childStatus[id] != "fileZip") childStatus[id] = "fileZip";
                            task.method = "zipCBZ";
                            task.data = zipMaps.pop();
                        } else {
                            if (childStatus[id] != "complete") childStatus[id] = "complete";
                            task.method = "finish";
                        }
                        if (task.method != "ping" && task.method != "finish") {
                            task.data.mTotal = tally.total;
                        }
                        child[id].send(task);
                    }
                };
            
            await Promise.all(child.map((e, index) => forkCPP([index, browser.wsEndpoint()], {child, index, mHandler})));
            //play sound on finish (only works when run from terminal)
            console.log("\007");
            let { total, success, error, ignore } = tally, endStamp = new Date(),
                signOff = `Completed ${success}/${total} with ${error} errors and ${ignore} ignored after ${msToTime(endStamp.valueOf() - timeStamp)}${sp}@${endStamp}`;
            console.log(signOff);
            fs.appendFileSync(path.resolve(opts.logs, `_${timeStamp}_out.txt`), signOff);
            fs.writeFileSync(path.resolve(__dirname, 'failedRequest.txt'), failed.join("\n"));
            process.exit();
        } else {
            let status = "linkFetch", activeTab = true;
            const mMethods = {
                getLinks: async d => {
                    let images, name, count, data,
                        { src, mID, mTotal } = d;
                    try {
                        await page.goto(src);
                        await Promise.all([
                            page.waitForFunction(`(${injectExtract.toString()})()`),
                            page.waitForSelector("a.iex")
                        ]);
                        images = await page.$$eval("a.iex", links => {
                            let imgs = [];
                            for (let link of links) {
                                imgs.push(link.href);
                            }
                            return imgs;
                        }),
                        name = sanitize(await page.$eval("#name", getText)),
                        count = await page.$eval("#count", getText);
                        console.log(`${(mID/mTotal*100).toFixed(2)}% [${mID}/${mTotal}] (${status}) ${truncate(name)}: ${count} images found`);
                        data = { name, images, count, src, mID };
                    } catch (e) {
                        console.log(`${(mID/mTotal*100).toFixed(2)}% [${mID}/${mTotal}] (${status}) ${src} \n${e}`);
                        data = { e: e.toString(), name, images, count, src, mID };
                    }
                    process.send( { data, id: opts.identity } );
                },
                getSingleImage: async d => {
                    let { image, name, targetID, src, count, mID, mTotal } = d,
                        dir = path.resolve(opts.export, name), data;
                    try {
                        if (status != "imageDown") {
                            status = "imageDown";
                        }
                        mID = mTotal - mID;
                        console.log(`${(mID/mTotal*100).toFixed(2)}% [${mID}/${mTotal}] (${status}) ${truncate(name)}: Page ${targetID}/${count}`);
                        await downloadImage(image, `${targetID}_${path.basename(image)}`, name);
                        if (targetID == count - 1) {
                            await writeFileP(path.resolve(dir, 'info.txt'), `Retrieved ${count} pages from ${src}${sp}mangaGet.js`);
                            data = { dir, src, mID, count };
                        } else {
                            data = { src, mID };
                        }
                    } catch (e) {
                        console.log(`${(mID/mTotal*100).toFixed(2)}% [${mID}/${mTotal}] (${status}) ${truncate(name)} \n${e}`);
                        data = { e: e.toString(), dir, src, mID };
                    }
                    process.send( { data, id: opts.identity } );
                },
                zipCBZ: async d => {
                    if (status != "fileZip") {
                        status = "fileZip";
                    }
                    let { dir, src, count, mID, mTotal } = d, 
                        name = path.basename(dir);
                    try {
                        let cbz = fs.createWriteStream(`${dir}.cbz`),
                            arc = new archiver('zip');
                        
                        cbz.on('close', function () {
                            console.log(`${(mID/mTotal*100).toFixed(2)}% [${mID}/${mTotal}] (${status}) ${name}.cbz zipped w/ ${bytesToSize(arc.pointer())}`);
                            fs.removeSync(dir);
                            process.send( { data: { success: true, mID }, id: opts.identity } );
                        });

                        arc.on('error', function (e) {
                            console.log(`${(mID/mTotal*100).toFixed(2)}% [${mID}/${mTotal}] (${status}) ${name} \n${e}`);
                            process.send( { data: { e: e.toString(), src, success: false, mID }, id: opts.identity } );
                        });

                        arc.pipe(cbz);
                        console.log(`${(mID/mTotal*100).toFixed(2)}% [${mID}/${mTotal}] (${status}) Zipping ${name}.cbz ${count} files`);
                        arc.directory(dir, false).finalize();
                    } catch (e) {
                        console.log(`${(mID/mTotal*100).toFixed(2)}% [${mID}/${mTotal}] (${status}) ${name} \n${e}`);
                        process.send( { data: { e: e.toString(), src, success: false, mID }, id: opts.identity } );
                    }
                },
                finish: (d, done) => {
                    if (status == "linkFetch") {
                        teardown(done);
                    } else {
                        done();
                    }
                },
                ping: () => { process.send( { data: { }, id: opts.identity } ); }
            },
            getText = ele => ele.innerText,
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
                    //console.log(m);
                    let { method, data } = m;
                    mMethods[method](data, cb);
                    if (status != "linkFetch" && activeTab) {
                        activeTab = false;
                        try { teardown(); } catch (e) { console.log("[teardown]", e) }
                    }
                });
                process.send( { data: { }, id: opts.identity } );
            }))();
            console.log("\007");
            console.log("Mission accomplished.");
            process.exit();
        }
    };
    
let getList = [], opts = {};

if (fs.pathExistsSync("_opts.json")) {
    opts = JSON.parse(fs.readFileSync("_opts.json", {encoding: "utf8"}));
}

opts.tabs = opts.tabs || 5;
opts.export = opts.export || path.resolve(__dirname, 'got');
opts.logs = opts.logs || path.resolve(__dirname, 'got');
opts.requests = opts.requests || "requests.txt";

try { fs.writeFileSync("_opts.json", JSON.stringify(opts, null, 4)); } 
catch (e) { console.log(e); }

if (!fs.pathExistsSync(opts.export)) {
    fs.mkdirp(opts.export);
}
if (!fs.pathExistsSync(opts.logs)) {
    fs.mkdirp(opts.logs);
}

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
    fs.appendFileSync(path.resolve(opts.logs, `_${timeStamp}_out.txt`), `${new Date()}\n`);
    getList = fs.readFileSync(opts.requests, {encoding: "utf8"}).split(sp);
}

//Debug
if (process.execArgv.length) {
    opts.tabs = 1;
    opts.show = true;
}

mangaGet(getList, opts);