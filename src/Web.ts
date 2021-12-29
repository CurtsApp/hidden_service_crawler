import { Site } from "./Site";
import { URL } from "./URL";

const MAX_SITE_ATTEMPTS = 500;
export class Web {
    attempts: number;
    siteStats: { [url: string]: SiteStats };
    // Individual words in a title map to a urls which contain it in the title
    titleMap: { [word: string]: string[] };
    errorSites: { url: string, error: any }[];

    constructor() {
        this.siteStats = {};
        this.titleMap = {};
        this.errorSites = [];
        this.attempts = 0;
    }

    addSite(site: Site, parentUrl: URL = null, recursive: boolean = false) {
        if (!site.loaded) {
            throw new Error(`Site not finished loading: ${site.getURL()}`);
        }

        this.attempts++;
        let url = site.url.getFull();
        if (parentUrl) {
            this.siteStats[url].external.linksFrom.push(parentUrl.getFull());
        }
        
        if (!this.siteStats[url]) {
            // Site has not been indexed
            this.siteStats[url] = {
                internal: {
                    linksFrom: [],
                    linksTo: []
                },
                external: {
                    linksFrom: [],
                    linksTo: []
                }
            }
            this.siteStats[url].external.linksTo.concat(site.links.map(link => link.getFull()));

            if (recursive && this.attempts < MAX_SITE_ATTEMPTS) {
                let pendingSites = [];
                site.links.forEach((link) => {
                    pendingSites.push(Site.factory(link.getFull()).then(newSite => {
                        this.addSite(newSite, site.url, true);
                    }).catch(e => this.errorSites.push({ url: link.getFull(), error: e })));
                });
                Promise.all(pendingSites).then(() => console.log(`Site finished...\nSite Count: ${Object.keys(this.siteStats).length}\nBad Links Count: ${this.errorSites.length}`));
            }
        }      
    }
}

interface SiteStats {
    internal: {
        linksTo: string[];
        linksFrom: string[];
    },
    external: {
        linksTo: string[]; // urls
        linksFrom: string[]; // urls
    }
}