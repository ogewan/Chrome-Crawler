/* jshint ignore:start*/
const fs = require("fs-extra"), 
    path = require("path"),
    cp = require("child_process"),
    util = require('util'),
    timeStamp = (new Date()).valueOf(),
    forkCP = (params, config, done) => {
        let {child, index, mHandler} = config,
        execArgv = (process.execArgv.length) ? ["--inspect-brk=12345"] : [];
        child[index] = cp.fork(
            path.resolve('testRanking.js'),
            [...params],
            { stdio: ['pipe', 'pipe', 'pipe', 'ipc'], execArgv }
        ),
        printMessage = o => {
            let message = `${index}: ${o.replace('\n', '').replace('&n', '\n')}`;
            console.log(message);
            //fs.appendFileSync(path.resolve(opts.logs, `_${timeStamp}_out.txt`), `${message}\n`);
        };

        child[index].on('close', () => done(null, true));
        child[index].on('error', o => done(o, false));
        child[index].on('message', (m, sh) => mHandler(m, sh, index));

        child[index].stdout.setEncoding('utf8');
        child[index].stderr.setEncoding('utf8');
        child[index].stdout.on('data', printMessage);
        child[index].stderr.on('data', printMessage);
    },
    forkCPP = util.promisify(forkCP);

module.exports = {forkCP, forkCPP};