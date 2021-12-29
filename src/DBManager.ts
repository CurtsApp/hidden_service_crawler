import { URL } from "./URL";

const sqlite3 = require('sqlite3');

export class DBManager {
    db: any;
    static instance: DBManager;

    constructor() {
        if(DBManager.instance) {
            return DBManager.instance;
        }
        this.db = new sqlite3.Database('./../sql/data/crawler.db');
        DBManager.instance = this;
    }

    storeSite(url: URL, title?: string) {
        this.db.run(`INSERT INTO sites(link, title) VALUES ("${url.getFull()}", ${title !== undefined ? `"${title}"` : "NULL"})`);
    }

    logSiteAccess(url: URL, status: boolean) {
        let now = Date.now();
        this.db.run(`INSERT INTO pings(link, access_time, was_online) VALUES ("${url.getFull()}", ${now}, ${status})`);
    }

    getSiteTitleMap(onComplete: (results: SitesRow[]) => void) {
        this.db.all(`SELECT link, title FROM sites;`, (err, rows) => {
            if(err) {
                console.log(err);
            }

            onComplete(rows);
        });
    }    
}

export interface SitesRow {
    link: string,
    title?: string
}
