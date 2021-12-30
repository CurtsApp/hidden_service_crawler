// To get a new id restart tor service

import { DBManager } from "./DBManager";
import { URL } from "./URL";
import { Web } from "./Web";
import { ActiveDogs, WatchDog } from "./WatchDog";

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

function exit() {
    console.log("Gracefully exiting");
    DBManager.close();
    process.exit();
}

function main() {
    process.on('SIGINT', () => exit());
    process.on('SIGTERM', () => exit());

    let args = process.argv.slice(2);
    if (args.length > 0) {
        let startUrl = args[0];

        // REQUESTS is fed by webUtils, if a web request is not made every 60sec exit program
        new WatchDog(ActiveDogs.REQUESTS, 60000, () => exit());

        let web = new Web(() => {
            web.addURL(new URL(startUrl), true, () => console.log(web.toString()));
        });

    } else {
        console.log("Provide source url as first argument.");
    }
}

main();