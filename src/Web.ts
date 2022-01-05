import { DBManager } from "./DBManager";
import { RequestManager, UniqueStatus } from "./RequestManager";
import { Site } from "./Site";
import { URL } from "./URL";

const MAX_SITE_ATTEMPTS = 25000;
const HOST_LIMIT = 10; // Only index a few pages from the same host
export class Web {
    attempts: number;
    knownSites: { [url: string]: string }; // titles
    knownHosts: { [url: string]: number }; // count of known sites with each host
    dbm: DBManager;
    rm: RequestManager;

    constructor(rm: RequestManager, onInit: () => void) {
        this.attempts = 0;
        this.dbm = DBManager.getDBManager();
        this.rm = rm;

        //Initalize known sites
        this.knownSites = {};
        this.knownHosts = {};
        this.dbm.getSiteTitleMap((results) => {
            results.forEach(result => {
                this.knownSites[result.url] = result.title;
                let resultHostName = new URL(result.url).hostName;
                if(this.knownHosts[resultHostName]) {
                    this.knownHosts[resultHostName] += 1;
                } else {
                    this.knownHosts[resultHostName] = 1;
                }                
            });
            onInit();
        });
    }

    toString(): string {
        return `Web Stats[Known Site Count: ${Object.keys(this.knownSites).length}]`
    }

    addURL(url: URL, recursive: boolean = false, onComplete?: () => void) {
        // Avoid requesting the same site more than once
        let urlString = url.getFull();
        if (this.knownSites.hasOwnProperty(urlString)) {
            return;
        }

        if(this.knownHosts[url.hostName] && this.knownHosts[url.hostName] > HOST_LIMIT) {
            return;
        }

        // Set placeholder so we don't request this url again
        this.knownSites[urlString] = null;
        // Track host name usage
        if(this.knownHosts[url.hostName]) {
            this.knownHosts[url.hostName] += 1;
        } else {
            this.knownHosts[url.hostName] = 1;
        }  
        // Track total attempts to prevent ram from exploding to infinite recursion
        this.attempts++;
        Site.factory(url, this.rm).then(site => {
            this.addSite(site, recursive, onComplete);
        }).catch(e => {
            this.dbm.storeSite(url);
            this.dbm.logSiteAccess(url, UniqueStatus.GENERIC_FAILURE);
        }).finally(() => {
            // Call onComplete only once after recursion is finished
            if (onComplete && !this.rm.isProcessing()) {
                onComplete();
            }
        });
    }

    private addSite(site: Site, recursive: boolean = false, onComplete?: () => void) {
        if (!site.loaded) {
            throw new Error(`Site not finished loading: ${site.url.getFull()}`);
        }

        let urlString = site.url.getFull();
        // Update placeholder with correct title
        this.knownSites[urlString] = site.title;

        this.dbm.storeSite(site.url, site.title);
        this.dbm.logSiteAccess(site.url, site.pageStatus);

        if (recursive) {
            if (this.attempts > MAX_SITE_ATTEMPTS) {
                console.log("Max attempts reached");
                return;
            }
            site.links.forEach((link) => {
                this.addURL(link, true, onComplete);
            });
        }
    }
}