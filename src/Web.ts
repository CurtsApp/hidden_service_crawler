import { DBManager } from "./DBManager";
import { Site } from "./Site";
import { URL } from "./URL";

const MAX_SITE_ATTEMPTS = 500;
export class Web {
    attempts: number;
    knownSites: { [url: string]: string }; // titles
    dbm: DBManager;
    isInitComplete: boolean;

    constructor() {
        this.attempts = 0;
        this.isInitComplete = false;
        this.dbm = new DBManager();

        //Initalize known sites
        this.knownSites = {};
        this.dbm.getSiteTitleMap((results) => {
            results.forEach(result => this.knownSites[result.link] = result.title); 
            this.isInitComplete = true;           
        });
    }

    toString(): string {
        return `\nWeb Stats:\nKnown Site Count: ${Object.keys(this.knownSites).length}\n`
    }

    addURL(url: URL, recursive: boolean = false, onComplete?: () => void) {
        if(!this.isInitComplete) {
            setInterval(() => this.addURL(url, recursive, onComplete), 300);
            return;
        }
        // Avoid requesting the same site more than once
        let urlString = url.getFull();
        if (this.knownSites.hasOwnProperty(urlString)) {
            return;
        }
        // Set placeholder so we don't request this url again
        this.knownSites[urlString] = null;
        // Track total attempts to prevent ram from exploding to infinite recursion
        this.attempts++;
        Site.factory(url).then(site => {
            this.addSite(site, recursive, onComplete);
        }).catch(e => {
            this.dbm.storeSite(url);
            this.dbm.logSiteAccess(url, true);
        }).finally(() => {
            if(onComplete) {
                onComplete();
            }
        });
    }

    private addSite(site: Site, recursive: boolean = false, onComplete?: () => void) {
        if (!site.loaded) {
            throw new Error(`Site not finished loading: ${site.getURL()}`);
        }

        let urlString = site.url.getFull();
        // Update placeholder with correct title
        this.knownSites[urlString] = site.title;
        
        this.dbm.storeSite(site.url, site.title);
        this.dbm.logSiteAccess(site.url, true);

        if (recursive && this.attempts < MAX_SITE_ATTEMPTS) {
            site.links.forEach((link) => {
                this.addURL(link, true, onComplete);
            });
        }
    }
}

interface SiteStats {
    title: string
}