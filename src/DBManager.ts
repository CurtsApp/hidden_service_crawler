import { getUrlsFromLinkRow } from "./dbUtils";
import { URL } from "./URL";
const sqlite3 = require('sqlite3').verbose();

export interface SitesRow {
    url: string,
    title: string | null
}

export interface PingsRow {
    url: string,
    accessTime: number,
    statusCode: number
}

export interface LinksRow {
    fromProtcolIsSecure: 0 | 1, // 0 or 1 for true or false
    fromHostname: string,
    fromPath: string,
    toProtcolIsSecure: 0 | 1,
    toHostname: string,
    toPath: string
}

export interface RedirectsRow {
    fromLink: string,
    toLink: string
}

export interface KeywordsRow {
    url: string,
    keywords: string
}

const MAX_INSERT_QUEUE = 200;

/* All write operations a requeued until database close */
export class DBManager {
    private db: any;
    private static instance: DBManager;

    private queuedRows: {
        sites: SitesRow[];
        pings: PingsRow[];
        links: LinksRow[];
        redirects: RedirectsRow[];
        keywords: KeywordsRow[];
    };

    private constructor() {
        this.db = new sqlite3.Database('./../sql/data/crawler.db');
        this.initalizeQueue();
    }

    static getDBManager() {
        if (!DBManager.instance) {
            DBManager.instance = new DBManager();
        }

        return DBManager.instance;
    }

    getInsertQueueLength(): number {
        return this.queuedRows.pings.length + this.queuedRows.sites.length;
    }

    private checkQueueStatus() {
        if (this.getInsertQueueLength() > MAX_INSERT_QUEUE) {
            this.commitQueuedInserts();
        }
    }

    storeSite(url: URL, title?: string) {
        this.queuedRows.sites.push({
            url: url.getFull(),
            title: title ? title : null
        });
        this.checkQueueStatus();
    }

    private writeSite(siteRow: SitesRow) {
        this.db.run("INSERT INTO sites(link, title) VALUES (?, ?);",
            [siteRow.url, siteRow.title],
            (err) => {
                if (err) {
                    throw new Error(err);
                }
            });
    }

    logSiteAccess(url: URL, status: number) {
        let now = Date.now();
        this.queuedRows.pings.push({
            url: url.getFull(),
            accessTime: now,
            statusCode: status
        });
        this.checkQueueStatus();
    }

    private writePing(pingRow: PingsRow) {
        this.db.run("INSERT INTO pings(link, access_time, status_code) VALUES (?, ?, ?);",
            [pingRow.url, pingRow.accessTime, pingRow.statusCode],
            (err) => {
                if (err) {
                    throw new Error(err);
                }
            });
    }

    logLink(fromURL: URL, toURL: URL) {
        console.log(`from: ${fromURL} to: ${toURL}`);
        this.queuedRows.links.push({
            fromProtcolIsSecure: fromURL.protocol === "https" ? 1 : 0,
            fromHostname: fromURL.hostName,
            fromPath: fromURL.getSuffix(),
            toProtcolIsSecure: toURL.protocol === "https" ? 1 : 0,
            toHostname: toURL.hostName,
            toPath: toURL.getSuffix()
        });
        this.checkQueueStatus();
    }

    private writeLink(linkRow: LinksRow) {
        let debug = getUrlsFromLinkRow(linkRow);
        //console.log(`from: ${debug.from} to: ${debug.to}`);
        this.db.run("INSERT INTO links(from_protocol_is_secure, from_hostname, from_path, to_protocol_is_secure, to_hostname, to_path) VALUES (?, ?, ?, ?, ?, ?);",
            [linkRow.fromProtcolIsSecure, linkRow.fromHostname, linkRow.fromPath, linkRow.toProtcolIsSecure, linkRow.toHostname, linkRow.toPath],
            (err) => {
                if (err) {
                    console.log(`error on: from: ${debug.from} to: ${debug.to}`);
                    throw new Error(err);
                }
            });
    }

    logRedirect(fromURL: URL, toURL: URL) {
        this.queuedRows.redirects.push({
            fromLink: fromURL.getFull(),
            toLink: fromURL.getFull()
        });
        this.checkQueueStatus();
    }

    private writeRedirect(redirectRow: RedirectsRow) {
        this.db.run("INSERT INTO redirects(from_link, to_link) VALUES (?, ?);",
            [redirectRow.fromLink, redirectRow.toLink],
            (err) => {
                if (err) {
                    throw new Error(err);
                }
            });
    }

    // Keywords should be sorted from most common to least common
    logKeywords(url: URL, keywords: string[]) {
        let keywordString = keywords.join(" ");
        this.queuedRows.keywords.push({
            url: url.getFull(),
            keywords: keywordString
        });
        this.checkQueueStatus();
    }

    private writeKeywords(keywordRow: KeywordsRow) {
        this.db.run("INSERT INTO keywords(link, keywords) VALUES (?, ?);",
            [keywordRow.url, keywordRow.keywords],
            (err) => {
                if (err) {
                    throw new Error(err);
                }
            });
    }

    getSiteTitleMap(onComplete: (results: SitesRow[]) => void) {
        this.db.all(`SELECT link, title FROM sites;`, (err, rows) => {
            if (err) {
                throw new Error(err);
            }

            onComplete(rows);
        });
    }

    commitQueuedInserts() {
        if (this.getInsertQueueLength() <= 0) {
            return;
        }

        console.log("Commiting Queue!");
        try {
            this.db.run("BEGIN TRANSACTION;");
            this.queuedRows.sites.forEach(site => this.writeSite(site));
            this.queuedRows.pings.forEach(ping => this.writePing(ping));
            this.queuedRows.keywords.forEach(keyword => this.writeKeywords(keyword));
            this.queuedRows.links.forEach(link => this.writeLink(link));
            this.queuedRows.redirects.forEach(redirect => this.writeRedirect(redirect));
            this.db.run("COMMIT;");
        } catch (e) {
            console.log(e);
            throw e;
        } finally {
            this.initalizeQueue();
        }
    }

    private initalizeQueue() {
        this.queuedRows = {
            sites: [],
            pings: [],
            keywords: [],
            links: [],
            redirects: []
        };
    }

    static close() {
        if (DBManager.instance) {
            DBManager.instance.commitQueuedInserts();
            DBManager.instance.db.close();
        }
    }
}
