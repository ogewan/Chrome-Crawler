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
            }
        },
        rateSite = s => (siteMap[Object.keys(siteMap).find( h => s.includes(h) )] || {}).score || 5;
        rateTree = {},
        reqPage = anchor => {
            console.log(`load ${anchor.href}`)
            visited[getServer(anchor.hostname)] = true;
            $.ajax(anchor.href)
            .done(data => {
                anchor.scParent.scChildren[anchor.href] = {
                    scidx: anchor.getAttribute("scidx"),
                    baseScore: rateSite(anchor.hostname),
                    scChildren: {},
                    scParent: anchor
                };
                let validanch = getValidAnchors(data, anchor);
                validanch.forEach(e => {
                    let ele = $(e)[0];
                    ele.scParent = anchor.scParent.scChildren[anchor.href];
                    ele.scDepth = anchor.depth + 1;
                    queue.push(ele);
                });
            })
            .fail((j, t, e) => console.error(j, t, e))
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
        );
        //INIT
        $.get(chrome.runtime.getURL("sitemap.json"), null, d => {
            siteMap = d;
            visited[getServer(window.location.hostname)] = true;
    
            rateTree[window.location.href] = {
                baseScore: rateSite(window.location.hostname),
                scChildren: {},
                scParent: null
            }
    
            if (rateTree[window.location.href].baseScore) {
                let validanch = getValidAnchors("html", window.location);
                validanch.forEach(e => {
                    let ele = $(e)[0];
                    ele.scParent = rateTree[window.location.href];
                    ele.scDepth = 1;
                    queue.push(ele);
                });
                runQ();
            }
        });
    })();
/* jshint ignore:end*/
