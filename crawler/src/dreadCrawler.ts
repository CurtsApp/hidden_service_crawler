import { Cookie, RequestManager } from "./RequestManager";
import { URL } from "./URL";
import { getPageRefreshTimer } from "./webUtils";

const fs = require('fs');
const readline = require('readline');

function main() {
    const DREAD_URL = new URL('http://dreadytofatroptsdj6io7l3xptbet6onoyno2yv7jicoxknyazubrad.onion/');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let rm = new RequestManager();

    let sessionCookies: Cookie[] = [];
    let getCaptchaPage = new Promise((resolve, reject) => {
        refreshPage(0);

        function refreshPage(refreshDelaySec: number) {
            setTimeout(() => {
                console.log("Getting with cookies:");
                console.log(sessionCookies);
                rm.getPage(DREAD_URL, sessionCookies).then(pageData => {
                    sessionCookies = pageData.setCookies;
                    let refreshDelay = getPageRefreshTimer(pageData.page);
                    console.log(`Refresh Delay: ${refreshDelay}`);
                    if (refreshDelay) {
                        refreshPage(refreshDelay);
                    } else {                        
                        resolve(pageData.page);
                    }
                }).catch(e => console.log(e));
            }, refreshDelaySec * 1000);
        }
    });

    getCaptchaPage.then(page => {
        // Session cookies should be valid
        fs.writeFile('captcha.html', page, (err) => {
            if(err) {
                console.log(err);
            }
        });
        rl.question("What time is it? HH:MM", (time) => {
            rl.close();
            console.log(time);
            let pieces = time.split(":");
            let hours = pieces[0];
            let minutes = pieces[1];
            // Send post resquest with session cookies and time
        })
    });
}

main();