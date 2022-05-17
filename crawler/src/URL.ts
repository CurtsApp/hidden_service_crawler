import { VALID_ONION_REGEX } from "./webUtils";

// URL stored as components hostname.onion/path1/path2/path3/
export class URL {
    protocol: "http" | "https";
    hostName: string;
    path: string[];
    containsSlashSuffix: boolean;

    constructor(fullURL: string) {
        let validOnionRegEx = new RegExp(VALID_ONION_REGEX);

        if (!validOnionRegEx.test(fullURL)) {
            console.log(`Invalid URL: ${fullURL}`);
            return null;
        }

        // The suffix will be dropped when calculating the path
        this.containsSlashSuffix = fullURL.slice(-1) === "/";

        let urlPieces = fullURL.split(".onion");
        let hostPieces = urlPieces[0].split("://");
        if (hostPieces.length > 1) {
            if (hostPieces[0] === "http" || hostPieces[0] === "https") {
                this.protocol = hostPieces[0];
            }
            this.hostName = hostPieces[1];
        } else {
            this.protocol = "http";
            this.hostName = urlPieces[0];
        }
        
        let pathPieces = urlPieces[1].split("/");
        this.path = pathPieces.filter(p => p !== "");
    }

    getFull(): string {
        return `${this.protocol}://${this.hostName}.onion${this.getSuffix()}`
    }

    toString(): string {
        return this.getFull();
    }

    getPath(): string {
        let path = "";
        if (this.path.length === 0) {
            return "";
        }
        this.path.forEach(segment => path += `/${segment}`)
        return path;
    }

    getSuffix(): string {
        return `${this.getPath()}${this.containsSlashSuffix ? "/" : ""}`
    }

    isEqual(url: URL): boolean {
        // Check hostname
        if(url.hostName !== this.hostName) {
            return false;
        }
        // Check paths
        if(url.path.length !== this.path.length) {
            return false;
        }
        let pathEqual = true;
        url.path.forEach((segment, i) => {
            if(segment !== this.path[i]) {
                pathEqual = false;
            }
        });
        if(!pathEqual) {
            return false;
        }
        // Check protocol
        if(url.protocol !== this.protocol) {
            return false;
        }
        // Check suffix
        if(url.containsSlashSuffix !== this.containsSlashSuffix) {
            return false;
        }

        return true;
    }
}