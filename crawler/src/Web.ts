import { DBManager } from "./DBManager";
import { RequestManager, UniqueStatus } from "./RequestManager";
import { Site } from "./Site";
import { URL } from "./URL";

const MAX_SITE_ATTEMPTS = 250000;
const SITE_UPDATE_TIME = 1 * 60 * 60 * 1000; // 1 hour in ms

export class Web {
    attempts: number;
    knownSites: { [url: string]: number }; // last access time
    dbm: DBManager;
    rm: RequestManager;

    constructor(rm: RequestManager, onInit: () => void) {
        this.attempts = 0;
        this.dbm = DBManager.getDBManager();
        this.rm = rm;

        //Initalize known sites
        this.knownSites = {};
        this.dbm.getLastPingForSites((results) => {
            //console.log(results);
            results.forEach(result => {
                this.knownSites[result.link] = result.access_time;
            });
            // console.log(this.knownSites);
            onInit();
        });
    }

    toString(): string {
        return `Web Stats[Known Site Count: ${Object.keys(this.knownSites).length}]`
    }

    addURL(url: URL, recursive: boolean = false, onComplete?: () => void) {
        // Avoid requesting the same site more than once
        let urlString = url.getFull();
        const now = Date.now();
        if (this.knownSites[urlString] > now - SITE_UPDATE_TIME) {
            // url has been updated within the last hour. don't add.
            // console.log(`Too soon: ${urlString}`);
            return;
        }

        // Update ping time so we don't request this url again
        this.knownSites[urlString] = Date.now();

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
        // Update placeholder with current time
        this.knownSites[urlString] = Date.now();

        this.dbm.storeSite(site.url, site.title);
        this.dbm.logSiteAccess(site.url, site.pageStatus);

        // Prune old links and add new ones. Should have better performance if too many bugs delete all existing links and insert new links
        this.dbm.getLinksFromSite(site.url, (oldLinks => {
            site.links.forEach(link => {
                if (!oldLinks.find(oldLink => oldLink.isEqual(link))) {
                    // If link not already logged, log link
                    this.dbm.logLink(site.url, link);
                }
            });

            oldLinks.forEach(oldLink => {
                if (!site.links.find(link => link.isEqual(oldLink))) {
                    // If link no longer exists delete old link
                    this.dbm.deleteLink(site.url, oldLink);
                }
            });
        }));


        if (site.keywords.length > 0) {
            this.dbm.logKeywords(site.url, site.keywords);
        }

        // Add site of relocated urls
        if (site.relocatedTo) {
            this.dbm.logRedirect(site.url, site.relocatedTo);
            this.addURL(site.relocatedTo, true, onComplete);
        }

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