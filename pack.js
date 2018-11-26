/* jshint ignore:start*/
//You need a key.pem, this will silently fail 
const fs = require("fs"),
    ChromeExtension = require("crx"),
    path = require("path"),
    ext = path.resolve(__dirname, 'ext'),
    crx = new ChromeExtension({
        privateKey: fs.readFileSync(path.resolve(__dirname, "key.pem"))
    });

console.log("packing crx", ext);

crx.load(ext)
    .then(crx => crx.pack())
    .then(crxBuffer => {
        console.log("writing crx...")
        fs.writeFileSync(path.resolve(__dirname, 'sourceCheck.crx'), crxBuffer);
    });
/* jshint ignore:end*/