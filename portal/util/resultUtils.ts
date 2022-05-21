let sqlite3 = require('sqlite3');
let db = new sqlite3.Database('../sql/data/crawler.db');

export interface SearchResults {
    totalMatches: number;
    pageResults: SearchResult[]
}

export interface SearchResult {
    url: string;
    containsKeywords: string[];
    excludesKeywords: string[];
    uptime: number;
    score: number;
}

// Get the results that match the query for the given page number
export async function getResults(query: string, pageNumber: number) {
    let results: SearchResults = {
        totalMatches: 0,
        pageResults: []
    }

    let search_promise = new Promise<SearchResults>(function (resolve, reject) {
        get_search_results(query).then(source_relevance_results => {
            source_relevance_results.forEach(result => {
                let final_result = {
                    url: result.url,
                    containsKeywords: result.matched_terms,
                    excludesKeywords: result.missing_terms,
                    uptime: result.uptime || 0,
                    score: result.source_score
                }
                results.pageResults.push(final_result)
            })
            results.totalMatches = source_relevance_results.length
            resolve(results)
        })
    })

    let waited_results = await search_promise
    return waited_results

}

//1
function get_search_results(search_term: string) {
    let result_promise = new Promise<relevance_results[]>(function (resolve, reject) {
        db.all("SELECT link, keywords FROM keywords", (error: any, rows: keyword_row[]) => {
            //2
            let process_rows_promise = process_rows(rows, search_term)
            process_rows_promise.then(source_relevance_results => {
                resolve(source_relevance_results)
            })
        })
    })
    return result_promise
}

//5
function access_time(url: string) {
    let ping_promise = new Promise<number>((resolve) => {
        let ping_prep = db.prepare("SELECT link, access_time, status_code FROM pings WHERE link = ?;", [url])
        ping_prep.all((error: any, rows: ping_row[]) => {
            var uptime = process_pings(rows)
            resolve(uptime)
        })
    })
    return ping_promise
}

interface keyword_row {
    link: string
    keywords: string
}
interface relevance_results {
    url: string
    source_score: number
    matched_terms: string[]
    missing_terms: string[]
    uptime?: number
}
function process_rows(rows: keyword_row[], search_term: string) {
    let process_rows_promise = new Promise<relevance_results[]>(function (resolve, reject) {
        let source_relevance_results: relevance_results[] = []
        let all_search_terms = search_term.split(' ')
        rows.forEach((row) => {
            let source_score = 0
            let url = row.link
            let keyword_list = row.keywords.toLowerCase().split(' ')
            let missing_terms: string[] = []
            let matched_terms: string[] = []
            all_search_terms.forEach((current_term) => {
                if (keyword_list.includes(current_term.toLowerCase()) === true) {
                    //If source contains current search term
                    source_score += 1000
                    //Relevance score of source for current search term
                    source_score += keyword_list.length - keyword_list.indexOf(current_term)
                    //Adds search terms that matched with a url keyword
                    matched_terms.push(current_term)
                } else {
                    //Adds search terms that did not match with a url keyword
                    missing_terms.push(current_term)
                }
            })
            let scored_source = { url, source_score, matched_terms, missing_terms }
            if (source_score > 0) {
                source_relevance_results.push(scored_source)
            }
        })
        //3
        let results_promise: Promise<number | void>[] = []
        source_relevance_results.forEach(relevant_result => {
            //4
            results_promise.push(access_time(relevant_result.url).then(uptime => {
                let uptime_score = 0
                if (uptime <= 1 && uptime > .9) {
                    uptime_score += 800
                } else if (uptime <= .9 && uptime > .8) {
                    uptime_score += 500
                } else if (uptime <= .8 && uptime > .7) {
                    uptime_score += 300
                } else if (uptime <= .7 && uptime > .6) {
                    uptime_score += 0
                } else if (uptime <= .6 && uptime > .5) {
                    uptime_score += -300
                } else if (uptime <= .5 && uptime > .4) {
                    uptime_score += -500
                } else if (uptime <= .4 && uptime > .3) {
                    uptime_score += -700
                } else if (uptime <= .3) {
                    uptime_score += -1000
                }

                if (relevant_result.source_score > 0) {
                    relevant_result.source_score += uptime_score
                }
                relevant_result.uptime = uptime
            }))
        })

        Promise.all(results_promise).then(unsorted_results => {
            source_relevance_results.sort((a, b) => {
                return b.source_score - a.source_score
            })
            resolve(source_relevance_results)
        })
    })
    return process_rows_promise
}

//Determines the uptime ratio of matching keyword urls
interface ping_row {
    access_time: number
    link: string
    status_code: number
}
function process_pings(rows: ping_row[]) {
    let sorted_rows = rows.sort(function (a, b) { return a.access_time - b.access_time })
    let source_uptime = 0
    let source_downtime = 0
    let date = Date.now()
    sorted_rows.forEach((row, index) => {
        let previous_ping;
        let next_ping;
        let status_code = row.status_code
        previous_ping = sorted_rows[index].access_time
        if (index === sorted_rows.length - 1) {
            next_ping = date
        } else {
            next_ping = sorted_rows[index + 1].access_time
        }
        if (status_code >= 200 && status_code < 300) {
            source_uptime += next_ping - previous_ping
        } else {
            source_downtime += next_ping - previous_ping
        }
    })
    let source_ratio = source_uptime / (source_downtime + source_uptime)
    return source_ratio
}