import { DBManager } from "./DBManager";
import { URL } from "./URL";
import { Web } from "./Web";
import { ActiveDogs, WatchDog } from "./WatchDog";
import { RequestManager } from "./RequestManager";
require('source-map-support').install();

function exit(hard: boolean = true) {
    console.log("Gracefully exiting");
    DBManager.close();
    if(hard) {
        process.exit();
    }    
}

function main() {
    process.on('SIGINT', () => exit());
    process.on('SIGTERM', () => exit());
    process.on('unhandledRejection', console.log);

    let args = process.argv.slice(2);
    if (args.length > 0) {
        let startUrl = args[0];
        console.log("ehh");
        let rm = new RequestManager();
        // REQUESTS is fed by webUtils, if a web request is not made every 32sec exit program
        /*new WatchDog(ActiveDogs.REQUESTS, 32 * 1000, () => {
            console.log(rm.getActiveRequestString());
            exit();
        });*/
        let web = new Web(rm, () => {
            web.addURL(new URL(startUrl), true, () => exit(false));
        });

    } else {
        console.log("Provide source url as first argument.");
    }
}

main();