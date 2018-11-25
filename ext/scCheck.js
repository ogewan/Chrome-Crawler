/* jshint ignore:start*/
/**
 * 1. Get all links
 * 2. filter to relevant links
 * 3. open port and send to background for searching and scoring
 * 4. get back links and modify anchors
 */
(() => {
    //let port = chrome.runtime.connect({name: "schk"}),
    let maxDepth = 3,
        siteMap,
        queue = [],
        visited = {},
        getServer = hname => hname.split(".")[hname.split(".").length - 2],
        extGood = path => {
            let arrLast = path.split("/").pop().split(".");
            if (arrLast.length > 1) {
                return ["html", "htm"].includes(arrLast.pop());//php needs testing
            }
            return true;
        }
        runQ = () => {
            let nextA;
            while (queue.length) {
                nextA = queue.pop();
                if (nextA && !visited[getServer(nextA.hostname)] && nextA.scDepth <= maxDepth) {
                    break;
                }
            }
            if (nextA) {
                reqPage(nextA);
            } else {
                console.log("queue is empty");
                evaluate();
            }
        },
        rateSite = s => {
            let score = (siteMap[Object.keys(siteMap).find( h => s.includes(h) )] || {}).score;
            return (score !== undefined) ? score : 4;
        },
        rateRange = n => (n < 2) ? "False": (n < 4) ? "Mostly False": (n < 6) ? "Opinion": (n < 8) ? "Mostly True": "True",
        truncate = str => (str.length > 25) ? `${str.substring(0, 25 - 3)}...` : str,
        rateTree = {},
        scoreMap = {},
        reqPage = anchor => {
            console.log(`load ${anchor.href}`)
            visited[getServer(anchor.hostname)] = true;
            $.ajax(anchor.href)
            .done(data => {
                anchor.scParent.scChildren[anchor.href] = {
                    host: anchor.hostname,
                    href: anchor.href,
                    baseScore: rateSite(anchor.hostname),
                    scChildren: {},
                    //scParent: anchor
                };
                let validanch = getValidAnchors(data, anchor);
                validanch.forEach(e => {
                    let ele = $(e)[0];
                    ele.scParent = anchor.scParent.scChildren[anchor.href];
                    ele.scDepth = anchor.depth + 1;
                    queue.push(ele);
                });
            })
            .fail((j, t, e) => {
                //console.error(j, t, e);
            })
            .always(() => runQ());
        },
        getValidAnchors = (page, anc) => 
        $(page).find("a").toArray().filter(e => 
            //(anc.hostname !== e.hostname) &&
            e.hostname &&
                !e.hostname.includes(getServer(anc.hostname)) &&
                !e.hostname.includes(getServer(window.location.hostname)) &&
                (e.protocol == 'https:' ) &&//|| e.protocol == 'http:' ignore http for now
                (e.type = "text/html") &&
                !e.hash &&
                extGood(e.pathname) &&
                !e.closest("iframe") &&
                !e.querySelectorAll("img").length &&
                !e.querySelectorAll("svg").length &&
                !e.querySelectorAll("canvas").length &&
                !e.querySelectorAll("video").length &&
                !e.querySelectorAll("picture").length &&
                !e.querySelectorAll("map").length &&
                !e.querySelectorAll("audio").length &&
                (siteMap[Object.keys(siteMap).find( s => e.hostname.includes(s) )] || {}).score !== 0
        ),
        calcScore = (t, v) => {
            let score = 0, children = Object.values(v.scChildren);

            if (children.length) {
                score = (v.baseScore + (children.reduce(calcScore, 0)/children.length))/2
            } else {
                score = v.baseScore;
            }
            scoreMap[v.href] = score;
            return t + score;
        },
        evaluate = () => {
            let finalScore = calcScore(0, Object.values(rateTree)[0]), 
                rateColor = {
                    "False": "#ff0000",
                    "Mostly False": "ff8000",
                    "Opinion": "#D8D800",
                    "Mostly True": "#417F00",
                    "True": "#007F00"
                },
                rating = rateRange(finalScore),
                realXtra = [];

            console.log(`The page is rated as ${finalScore}: ${rating}!`);

            [...document.querySelectorAll(`[scidx]`)].forEach(l => {
                //console.log(`tar [${scoreMap[l.href]}]: ${l.href} ${l} ${l.getAttribute("scidx")}`);
                let score = scoreMap[l.href] || 4,
                    rate = rateRange(score);
                    etitle = `${score}: ${rate} | ${truncate(l.href)}`;

                l.setAttribute("title", etitle);
                l.style.color = rateColor[rate];
                realXtra.push(etitle);
            });

            chrome.runtime.sendMessage({text: finalScore.toString(), color: rateColor[rating], title: `Overall: [${finalScore}] ${rating}\n${realXtra.join("\n")}`});
        };
        //INIT
        $.get(chrome.runtime.getURL("sitemap.json"), null, d => {
            siteMap = d;
            visited[getServer(window.location.hostname)] = true;
    
            rateTree[window.location.href] = {
                host: window.location.hostname,
                href: window.location.href,
                baseScore: rateSite(window.location.hostname),
                scChildren: {},
                scParent: null
            }
    
            if (rateTree[window.location.href].baseScore) {
                let validanch = getValidAnchors("html", window.location);
                validanch.forEach((e, i) => {
                    let ele = $(e)[0];
                    ele.scParent = rateTree[window.location.href];
                    ele.scDepth = 1;
                    queue.push(ele);
                    e.setAttribute("scidx", i);
                });
                runQ();
            }
            else {
                let wUrl = window.location.href, 
                    sKey = Object.keys(siteMap).find( h => wUrl.includes(h));
                    sEntry = siteMap[sKey] || false;
                    
                chrome.runtime.sendMessage({
                    disable: true,
                    title: `Page not supported: ${(sEntry) ? sKey : window.location.hostname}\nReason: ${(sEntry) ? sEntry.type : "Not Found"}`
                });
            }
        });
    })();
/* jshint ignore:end*/