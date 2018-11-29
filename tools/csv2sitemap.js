/* jshint ignore:start*/
const csv = require('csv-streamify'),
    fs = require('fs'),
    csvp = csv(), 
    siteMap = {
        "jamanetwork":{"type": "reliable", "score": 9},
        //"google":{"type": "search engine", "score": 0},
        "bing":{"type": "search engine", "score": 0},
        "ask":{"type": "search engine", "score": 0},
        "yahoo":{"type": "search engine", "score": 0},
        "baidu":{"type": "search engine", "score": 0},
        "duckduckgo":{"type": "reliable", "score": 0},
        "journal": {"type": "reliable", "score": 9},
        "amjmed": {"type": "reliable", "score": 9},
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
        "cnn": {"type": "reliable", "score": 7},
        "msnbc": {"type": "reliable", "score": 7},
        "bbc": {"type": "reliable", "score": 7},
        "usatoday": {"type": "reliable", "score": 7},
        "buzzfeed": {"type": "reliable", "score": 6.5},
        "gizmodo": {"type": "reliable", "score": 6.5},
        "kotaku": {"type": "reliable", "score": 6.5},
        "axios": {"type": "reliable", "score": 8},
        "reuters": {"type": "reliable", "score": 8},
        "foxnews": {"type": "reliable", "score": 7},
        "nytimes": {"type": "reliable", "score": 7},
        "nasa": {"type": "reliable", "score": 9},
        "cdc": {"type": "reliable", "score": 9},
        "mnn": {"type": "reliable", "score": 6.5},
        "edu": {"type": "reliable", "score": 8},
        "thanksgiving":{"type":"social media","score":0},
        "grateful":{"type":"social media","score":0},
        "washingtonpost": {"type": "reliable", "score": 7},
        "theguardian": {"type": "reliable", "score": 7},
      },
    ranks = {
        "fake": 0.5,
        "satire": 0.5,
        "bias": 4.5,
        "conspiracy": 3,
        "state": 5,
        "junksci": 0.5,
        "hate": 0.5,
        "clickbait": 5,
        "unreliable": 5.5,
        "political": 6,
        "unknown": 4,
        "reliable": 7,
    };
// emits each line as a buffer or as a string representing an array of fields
csvp.on('data', line => {
    //console.log(line);
    //_fcorpus is corrupted, ignore any numerical key or key with spaces (not valid host)
    let tar = line[0];
    if (line.length == 3 && !siteMap[tar] && !tar.includes(" ") && tar.includes(".") && (Object.keys(ranks).includes(line[1]) || !line[1].length)) {
        siteMap[line[0]] = {
            host: line[0],
            type: line[1] || "?",
            score: ranks[line[1]] || 4
        };
        fs.writeFileSync("sitemap.json", JSON.stringify(siteMap));
    }
});

// now pipe some data into it
fs.createReadStream('_fcorpus.csv').pipe(csvp);
/* jshint ignore:end*/