import { getComponentsFromUrl, getUrlsFromLinkRow } from "./dbUtils";
import { URL } from "./URL";
const sqlite3 = require('sqlite3').verbose();

export interface SitesRow {
    url: string,
    title: string | null
}

export interface PingsRow {
    link: string,
    access_time: number,
    status_code: number
}

export interface LinksRow {
    from_protocol_is_secure: 0 | 1, // 0 or 1 for true or false
    from_hostname: string,
    from_path: string,
    to_protocol_is_secure: 0 | 1,
    to_hostname: string,
    to_path: string
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
        addLinks: LinksRow[];
        delLinks: LinksRow[];
        redirects: RedirectsRow[];
        keywords: KeywordsRow[];
    };

    private constructor() {
        this.db = new sqlite3.Database('../../sql/data/crawler.db');
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
        return new Promise<boolean>((resolve, reject) => {
            this.db.run("INSERT OR REPLACE INTO sites(link, title) VALUES (?, ?);",
                [siteRow.url, siteRow.title],
                (err) => {
                    if (err) {
                        console.log("Write Site Error");
                        console.log(siteRow);
                        console.log(err);
                        reject(err);
                    } else {
                        resolve(true)
                    }
                });
        });

    }

    logSiteAccess(url: URL, status: number) {
        let now = Date.now();
        this.queuedRows.pings.push({
            link: url.getFull(),
            access_time: now,
            status_code: status
        });
        this.checkQueueStatus();
    }

    private writePing(pingRow: PingsRow) {
        return new Promise<boolean>((resolve, reject) => {
            this.db.run("INSERT INTO pings(link, access_time, status_code) VALUES (?, ?, ?);",
                [pingRow.link, pingRow.access_time, pingRow.status_code],
                (err) => {
                    if (err) {
                        console.log("Write Ping Error");
                        console.log(pingRow);
                        console.log(err);
                        reject(err);
                    } else {
                        resolve(true)
                    }
                });
        });
    }

    logLink(fromURL: URL, toURL: URL) {
        const fromComponents = getComponentsFromUrl(fromURL);
        const toComponents = getComponentsFromUrl(toURL);

        this.queuedRows.addLinks.push({
            from_protocol_is_secure: fromComponents.isSecure,
            from_hostname: fromComponents.hostname,
            from_path: fromComponents.path,
            to_protocol_is_secure: toComponents.isSecure,
            to_hostname: toComponents.hostname,
            to_path: toComponents.path
        });
        this.checkQueueStatus();
    }

    deleteLink(fromURL: URL, toURL: URL) {
        const fromComponents = getComponentsFromUrl(fromURL);
        const toComponents = getComponentsFromUrl(toURL);

        this.queuedRows.delLinks.push({
            from_protocol_is_secure: fromComponents.isSecure,
            from_hostname: fromComponents.hostname,
            from_path: fromComponents.path,
            to_protocol_is_secure: toComponents.isSecure,
            to_hostname: toComponents.hostname,
            to_path: toComponents.path
        });
        this.checkQueueStatus();
    }

    private writeLink(linkRow: LinksRow) {
        return new Promise<boolean>((resolve, reject) => {
            this.db.run("INSERT INTO links(from_protocol_is_secure, from_hostname, from_path, to_protocol_is_secure, to_hostname, to_path) VALUES (?, ?, ?, ?, ?, ?);",
                [linkRow.from_protocol_is_secure, linkRow.from_hostname, linkRow.from_path, linkRow.to_protocol_is_secure, linkRow.to_hostname, linkRow.to_path],
                (err) => {
                    if (err) {
                        console.log("Write Link Error");
                        console.log(linkRow);
                        console.log(err);
                        reject(err);
                    } else {
                        resolve(true);
                    }
                });
        });
    }

    private writeDeleteLink(linkRow: LinksRow) {
        return new Promise<boolean>((resolve, reject) => {
            this.db.run(`DELETE FROM links
            WHERE from_protocol_is_secure = ? 
              AND from_hostname = ? 
              AND from_path = ?
              AND to_protocol_is_secure = ?
              AND to_hostname = ?
              AND to_path = ?;`,
                [linkRow.from_protocol_is_secure, linkRow.from_hostname, linkRow.from_path, linkRow.to_protocol_is_secure, linkRow.to_hostname, linkRow.to_path],
                (err) => {
                    if (err) {
                        console.log("Write Delete Link Error");
                        console.log(linkRow);
                        console.log(err);
                        reject(err);
                    } else {
                        resolve(true)
                    }
                });
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
        return new Promise<boolean>((resolve, reject) => {
            this.db.run("INSERT OR REPLACE INTO redirects(from_link, to_link) VALUES (?, ?);",
                [redirectRow.fromLink, redirectRow.toLink],
                (err) => {
                    if (err) {
                        console.log("Write Redirect Error");
                        console.log(redirectRow);
                        console.log(err);
                        reject(err);
                    } else {
                        resolve(true);
                    }
                });
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
        return new Promise<boolean>((resolve, reject) => {
            this.db.run("INSERT OR REPLACE INTO keywords(link, keywords) VALUES (?, ?);",
                [keywordRow.url, keywordRow.keywords],
                (err) => {
                    if (err) {
                        console.log("Write Keyword Error");
                        console.log(keywordRow);
                        console.log(err);
                        reject(err);
                    } else {
                        resolve(true);
                    }
                });
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

    // Get most recent ping for each site only
    getLastPingForSites(onComplete: (results: PingsRow[]) => void) {
        this.db.all(`SELECT link, MAX(access_time) AS access_time, status_code FROM pings GROUP BY link;`, (err, rows) => {
            if (err) {
                throw new Error(err);
            }

            onComplete(rows);
        });
    }

    getLinksFromSite(url: URL, onComplete: (results: URL[]) => void) {
        const components = getComponentsFromUrl(url);
        this.db.all(`SELECT from_protocol_is_secure, from_hostname, from_path, to_protocol_is_secure, to_hostname, to_path FROM links 
                      WHERE from_protocol_is_secure = ? 
                        AND from_hostname = ? 
                        AND from_path = ?;`,
            [components.isSecure, components.hostname, components.path],
            (err, rows: LinksRow[]) => {
                if (err) {
                    throw new Error(err);
                }

                const links = rows.map(link => {
                    return getUrlsFromLinkRow(link).to
                });

                onComplete(links);
            });
    }

    commitQueuedInserts() {
        if (this.getInsertQueueLength() <= 0) {
            return;
        }

        console.log("Commiting Queue!");
        const queueCopy = {
            sites: [...this.queuedRows.sites],
            pings: [...this.queuedRows.pings],
            keywords: [...this.queuedRows.keywords],
            addLinks: [...this.queuedRows.addLinks],
            delLinks: [...this.queuedRows.delLinks],
            redirects: [...this.queuedRows.redirects]
        }
        this.initalizeQueue();
        let dbWriteQueue = [];
        try {
            this.db.run("BEGIN TRANSACTION;", {}, () => {
                console.log("FINISH TRANSACTION");
                queueCopy.sites.forEach(site => dbWriteQueue.push(this.writeSite(site)));
                queueCopy.pings.forEach(ping => dbWriteQueue.push(this.writePing(ping)));
                queueCopy.keywords.forEach(keyword => dbWriteQueue.push(this.writeKeywords(keyword)));
                queueCopy.addLinks.forEach(link => dbWriteQueue.push(this.writeLink(link)));
                queueCopy.delLinks.forEach(link => dbWriteQueue.push(this.writeDeleteLink(link)));
                queueCopy.redirects.forEach(redirect => dbWriteQueue.push(this.writeRedirect(redirect)));
                Promise.all(dbWriteQueue).then(res => {
                    this.db.run("COMMIT;", {}, () => console.log("FINISH COMMIT"));
                }).catch(reject => {
                    console.log("DB Write Error Rolling back");
                    console.log(reject);
                    this.db.run("ROLLBACK;");
                })
            });
        } catch (e) {
            console.log(e);
            console.log("DB Write Error Rolling back");
            this.db.run("ROLLBACK;");
        }
    }

    private initalizeQueue() {
        this.queuedRows = {
            sites: [],
            pings: [],
            keywords: [],
            addLinks: [],
            delLinks: [],
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
