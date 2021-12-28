import { getPage, getPageTitle, getPageLinks } from "./webUtils";

export class Site {
    loaded: boolean;
    url: string;
    title: string;
    links: string[];
    depth: number;

    constructor(url: string, onComplete?: (site: Site) => void) {
        this.loaded = false;
        this.url = url;
        this.links = [];
        
        console.log("Getting Page");
        getPage(url).then(page => {
            console.log("Getting Title");
            this.title = getPageTitle(page);
            console.log("Getting Links");
            getPageLinks(page).forEach(link => this.links.push(link));
            this.loaded = true;
            if (onComplete) {
                onComplete(this);
            }
        }).catch(e => console.log(e));
    }

    toString(): string {
        if (this.loaded) {
            return `Loading: "${this.url}"`
        } else {
            return {
                title: this.title,
                links: this.links
            }.toString();
        }
    }
}

