/* jshint ignore:start*/
chrome.runtime.onConnect.addListener(port => {
    console.assert(port.name == "schk");
    port.onMessage.addListener(msg => {
        console.log(msg);
        //INIT
        visited[msg.sURL] = true;
        rateTree[msg.sURL] = {
            baseScore: rateSite(msg.sHost),
            scChildren: {},
            scParent: null
        }
        //END INIT
        if (rateTree[msg.sURL].baseScore) {
            msg.links.forEach(e => {
                let ele = $(e)[0];
                ele.scParent = rateTree[msg.sURL];
                queue.push(ele);
            });
            runQ();
        }
    });
});


/* jshint ignore:end*/