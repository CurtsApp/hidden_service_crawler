export interface SearchResults {
    totalMatches: number;
    pageResults: SearchResult[]
}

export interface SearchResult {
    url: string;
    containsKeywords: string[];
    excludesKeywords: string[];
    uptime: number;
}

// Get the results that match the query for the given page number
export function getResults(query: string | string[], pageNumber: number): SearchResults {
    let results: SearchResults = {
        totalMatches: 0,
        pageResults: []
    }

    results.totalMatches = 3;

    results.pageResults.push({
        url: "asdasd.onion",
        containsKeywords: [],
        excludesKeywords: [],
        uptime: .9
    });
    results.pageResults.push({
        url: "ffff.onion",
        containsKeywords: [],
        excludesKeywords: [],
        uptime: .8
    })
    results.pageResults.push({
        url: "aaa.onion",
        containsKeywords: [],
        excludesKeywords: [],
        uptime: .05
    })

    return results;
}