import { getPageTitle, getPageLinks, getPageKeywords } from "./webUtils";
import { URL } from "./URL";
import { RequestManager } from "./RequestManager";

export class Site {
    loaded: boolean;
    url: URL;
    title: string;
    links: URL[];
    keywords: string[];
    pageStatus: number; // HTTP Status code
    relocatedTo?: URL; //If site was relocated, where to?
    error: any;

    private constructor(url: URL, rm: RequestManager, onComplete?: (site: Site) => void) {
        this.loaded = false;
        this.links = [];
        this.keywords = [];
        this.url = url;

        rm.getPage(this.url).then(result => {
            this.pageStatus = result.status;
            if (result.redirectUrl) {
                this.relocatedTo = result.redirectUrl;
            }
            if (result.page !== null) {
                this.title = getPageTitle(result.page);
                //console.log(result.page);
                let knownLinks = {};
                // Prevent self links
                knownLinks[this.url.getFull()] = true;
                getPageLinks(result.page).forEach(link => {
                    // Only include each link once
                    let fullLink = new URL(link);
                    let fullLinkText = fullLink.getFull();
                    if(!knownLinks[fullLinkText]) {                        
                        this.links.push(fullLink);
                        knownLinks[fullLinkText] = true;
                    }                   
                });
                this.keywords = getPageKeywords(result.page);
            }
        }).catch(e => {
            this.error = e;
        }).finally(() => {
            this.loaded = true;
            if (onComplete) {
                onComplete(this);
            }
        });
    }

    toString(): string {
        if (this.loaded) {
            return `Loading: "${this.url.getFull()}"`
        } else {
            return {
                title: this.title,
                links: this.links
            }.toString();
        }
    }

    static factory(url: URL, rm: RequestManager) {
        return new Promise((resolve: (site: Site) => void, reject) => {
            new Site(url, rm, (site) => {
                if (site.error) {
                    reject(site.error);
                }
                resolve(site);
            });
        });
    }
}



