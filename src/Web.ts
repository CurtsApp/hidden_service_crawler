import { Site } from "./Site";
import { URL } from "./URL";

const MAX_SITE_ATTEMPTS = 500;
export class Web {
    attempts: number;
    siteStats: { [url: string]: SiteStats };
    // Individual words in a title map to a urls which contain it in the title
    titleMap: { [word: string]: string[] };
    errorSites: { [url: string]: any }; // maps to errors
    pendingRequests: { [url: string]: number } // maps to start timestamp

    constructor() {
        this.siteStats = {};
        this.titleMap = {};
        this.errorSites = {};
        this.pendingRequests = {};
        this.attempts = 0;
    }

    toString(): string {
        return `\nWeb Stats:\nUnique Site Count: ${Object.keys(this.siteStats).length}\nBad Links Count: ${Object.keys(this.errorSites).length}\nPending Count: ${Object.keys(this.pendingRequests).length}\n`
    }

    addURL(url: URL, recursive: boolean = false, onComplete?: () => void) {
        // Avoid requesting the same site more than once
        let urlString = url.getFull();
        if (this.siteStats.hasOwnProperty(urlString) || this.errorSites.hasOwnProperty(urlString) || this.pendingRequests.hasOwnProperty(urlString)) {
            return;
        }
        this.attempts++;
        Site.factory(url).then(site => {
            this.addSite(site, recursive, onComplete);
        }).catch(e => {
            this.errorSites[url.getFull()] = e;
            delete this.pendingRequests[url.getFull()];
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
        this.siteStats[urlString] = {
            title: site.title
        };
        delete this.pendingRequests[urlString];

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