import { URL } from "./URL";
const sqlite3 = require('sqlite3');

export interface SitesRow {
    url: string,
    title: string | null
}

export interface PingsRow {
    url: string,
    accessTime: number,
    statusCode: number
}

const MAX_INSERT_QUEUE = 2000;

/* All write operations a requeued until database close */
export class DBManager {
    private db: any;
    private static instance: DBManager;

    private queuedRows: {
        sites: SitesRow[];
        pings: PingsRow[];
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
            this.db.run("COMMIT;");
        } catch(e) {
            console.log(e);
            throw e;
        } finally {
            this.initalizeQueue();
        }        
    }

    private initalizeQueue() {
        this.queuedRows = {
            sites: [],
            pings: []
        };
    }

    static close() {
        if (DBManager.instance) {
            DBManager.instance.commitQueuedInserts();
            DBManager.instance.db.close();
        }
    }
}
