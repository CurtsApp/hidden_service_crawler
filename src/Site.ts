import { getPage, getPageTitle, getPageLinks } from "./webUtils";
import { URL } from "./URL";

export class Site {
    loaded: boolean;
    url: URL;
    title: string;
    links: URL[];
    pageStatus: number; // HTTP Status code
    error: any;

    private constructor(url: URL, onComplete?: (site: Site) => void) {
        this.loaded = false;
        this.links = [];
        this.url = url;

        getPage(this.url).then(result => {
            this.pageStatus = result.status;
            if (result.page !== null) {
                this.title = getPageTitle(result.page);
                getPageLinks(result.page).forEach(link => this.links.push(new URL(link)));
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

    getURL(): string {
        return this.url.getFull();
    }

    toString(): string {
        if (this.loaded) {
            return `Loading: "${this.getURL()}"`
        } else {
            return {
                title: this.title,
                links: this.links
            }.toString();
        }
    }

    static factory(url: URL) {
        return new Promise((resolve: (site: Site) => void, reject) => {
            new Site(url, (site) => {
                if (site.error) {
                    reject(site.error);
                }
                resolve(site);
            });
        });
    }
}



