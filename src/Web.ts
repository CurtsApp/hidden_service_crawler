import { DBManager } from "./DBManager";
import { RequestManager, UniqueStatus } from "./RequestManager";
import { Site } from "./Site";
import { URL } from "./URL";

const MAX_SITE_ATTEMPTS = 250000;

export class Web {
    attempts: number;
    knownSites: { [url: string]: string }; // titles
    dbm: DBManager;
    rm: RequestManager;

    constructor(rm: RequestManager, onInit: () => void) {
        this.attempts = 0;
        this.dbm = DBManager.getDBManager();
        this.rm = rm;

        //Initalize known sites
        this.knownSites = {};
        this.dbm.getSiteTitleMap((results) => {
            results.forEach(result => {
                this.knownSites[result.url] = result.title;             
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

        // Set placeholder so we don't request this url again
        this.knownSites[urlString] = null;
 
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
        // debug to detect duplicate links. Should be removed in Site creation
        site.links.forEach((link, i) => {
            for(let j = 0; j < i; j++) {
                if(site.links[j].isEqual(link)) {
                    console.log(`Duplicate link:\n${site.url}\n${link}\n${site.links[j]}`);
                    throw new Error(`Duplicate link: ${site.url} to ${link}`);
                }
            }
        });        

        site.links.forEach(link => {
            //console.log(`link ${site.url} to ${link}`);
            //this.dbm.logLink(site.url, link);
        });
        if(site.keywords.length > 0) {
            this.dbm.logKeywords(site.url, site.keywords);
        }      

        // Add site of relocated urls
        if(site.relocatedTo) {
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