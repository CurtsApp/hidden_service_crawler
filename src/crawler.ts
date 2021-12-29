// To get a new id restart tor service

import { URL } from "./URL";
import { Web } from "./Web";

// sudo service tor restart
function newID() {
    const {
        spawn
    } = require('child_process');

    const idProc = spawn('python3', ['new_id.py']);
    let procMsg = '';
    idProc.stdout.on('data', (data) => {
        procMsg += data;
    });

    idProc.on('close', (code) => {
        console.log(procMsg);
        console.log('ID Reset');
    })
}


function main() {
    let args = process.argv.slice(2);
    if (args.length > 0) {
        let startUrl = args[0];

        let web = new Web();
        web.addURL(new URL(startUrl), false, () => console.log(web.toString()));     
    } else {
        console.log("Provide source url as first argument.");
    }
}

main();