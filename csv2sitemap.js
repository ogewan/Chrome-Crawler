/* jshint ignore:start*/
const csv = require('csv-streamify'),
    fs = require('fs'),
    csvp = csv(), 
    siteMap = {
        "jamanetwork":{"type": "credible", "score": 9},
        //"google":{"type": "search engine", "score": 0},
        "bing":{"type": "search engine", "score": 0},
        "ask":{"type": "search engine", "score": 0},
        "yahoo":{"type": "search engine", "score": 0},
        "baidu":{"type": "search engine", "score": 0},
        "duckduckgo":{"type": "credible", "score": 0},
        "journal": {"type": "credible", "score": 9},
        "amjmed": {"type": "credible", "score": 9},
        "stack": {"type": "social media", "score": 0},
        "overflow": {"type": "social media", "score": 0},
        "outbrain": {"type": "social media", "score": 0},
        "twitter": {"type": "social media", "score": 0},
        "facebook": {"type": "social media", "score": 0},
        "instagram":  {"type": "social media", "score": 0},
        "flickr": {"type": "social media", "score": 0},
        "youtube": {"type": "social media", "score": 0},
        "reddit": {"type": "social media", "score": 0},
        "mixer": {"type": "social media", "score": 0},
        "twitch": {"type": "social media", "score": 0},
        "outlook": {"type": "social media", "score": 0},
        "gmail": {"type": "social media", "score": 0},
        "pixels": {"type": "social media", "score": 0},
        "woot": {"type": "social media", "score": 0},
        "amazon": {"type": "social media", "score": 0},
        "irc": {"type": "social media", "score": 0},
        "vimeo": {"type": "social media", "score": 0},
        "genius": {"type": "social media", "score": 0},
        "plus": {"type": "social media", "score": 0},
        "snapchat": {"type": "social media", "score": 0},
        "soundcloud": {"type": "social media", "score": 0},
        "messenger": {"type": "social media", "score": 0},
        "pin": {"type": "social media", "score": 0},
        "moonlighting": {"type": "social media", "score": 0},
        "gomnlt": {"type": "social media", "score": 0},
        "cnn": {"type": "credible", "score": 7},
        "msnbc": {"type": "credible", "score": 7},
        "bbc": {"type": "credible", "score": 7},
        "usatoday": {"type": "credible", "score": 7},
        "buzzfeed": {"type": "credible", "score": 6.5},
        "gizmodo": {"type": "credible", "score": 6.5},
        "kotaku": {"type": "credible", "score": 6.5},
        "axios": {"type": "credible", "score": 8},
        "reuters": {"type": "credible", "score": 8},
        "foxnews": {"type": "credible", "score": 7},
        "nytimes": {"type": "credible", "score": 7},
        "nasa": {"type": "credible", "score": 9},
        "cdc": {"type": "credible", "score": 9},
        "mnn": {"type": "credible", "score": 6.5},
        "edu": {"type": "credible", "score": 8},
        "thanksgiving":{"type":"social media","score":0},
        "grateful":{"type":"social media","score":0},
        "washingtonpost": {"type": "credible", "score": 7},
        "theguardian": {"type": "credible", "score": 7},
      },
    ranks = {
        "fake": 0.5,
        "satire": 0.5,
        "bias": 5,
        "conspiracy": 3,
        "state": 5,
        "junksci": 1,
        "hate": 1,
        "clickbait": 5,
        "unreliable": 6,
        "political": 6,
        "credible": 7,
    };
// emits each line as a buffer or as a string representing an array of fields
csvp.on('data', line => {
    //console.log(line);
    if (!siteMap[line[0]]) {
        siteMap[line[0]] = {
            host: line[0],
            type: line[1] || "?",
            score: ranks[line[1]] || 4
        };
        fs.writeFileSync("sitemap.json", JSON.stringify(siteMap));
    }
    0;
});

// now pipe some data into it
fs.createReadStream('_fcorpus.csv').pipe(csvp);
/* jshint ignore:end*/