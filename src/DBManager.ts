import { URL } from "./URL";
const sqlite3 = require('sqlite3');

export class DBManager {
    private db: any;
    private static instance: DBManager;

    private constructor() {
        this.db = new sqlite3.Database('./../sql/data/crawler.db');
    }

    static getDBManager() {
        if (!DBManager.instance) {
            DBManager.instance = new DBManager();
        }

        return DBManager.instance;
    }

    storeSite(url: URL, title?: string) {
        this.db.run("INSERT INTO sites(link, title) VALUES (?, ?);",
            [url.getFull(), title ? title : null],
            (err) => {
                if (err) {
                    throw new Error(err);
                }
            });
    }

    logSiteAccess(url: URL, status: boolean) {
        let now = Date.now();
        this.db.run("INSERT INTO pings(link, access_time, was_online) VALUES (?, ?, ?);",
            [url.getFull(), now, status],
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

    static close() {
        if (DBManager.instance) {
            DBManager.instance.db.close();
        }
    }
}

export interface SitesRow {
    link: string,
    title?: string
}
