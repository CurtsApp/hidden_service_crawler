import type { NextPage } from 'next'
import Link from 'next/link';
import { ParsedUrlQuery } from 'querystring';
import styles from '../styles/Home.module.css'
import { getResults, SearchResult, SearchResults } from '../util/resultUtils'

interface SearchResultProps {
  isValid: boolean,
  searchResults: SearchResults
  searchQuery: string
}

const SearchResult: NextPage<SearchResultProps> = (props: SearchResultProps) => {
  // Get get arguments
  // Read results from database
  // Generate page based on results
  // Return page
  if (!props.isValid) {
    // Redirect   
    return (
      <div>
        <h1>Missing search query. Please go <Link href='/'>home</Link> and try again.</h1>
      </div>
    );
  }
  
  return (
    <div className={styles.container}>
      <h1>Results!</h1>
      {props.searchResults.pageResults.map(res => SiteResult(res))}
      <h2>{`Total Pages: ${props.searchResults.totalMatches}`}</h2>
    </div>
  )

  function SiteResult(props: SearchResult) {
    return (
      <div>
        <h2>{props.url}</h2>
        <h3>{`Contains: ${props.containsKeywords}`}</h3>
        <h3>{`Missing: ${props.excludesKeywords}`}</h3>
        <h3>{`Uptime: ${props.uptime}`}</h3>
        <h3>{`Score: ${props.score}`}</h3>
      </div>
    )
  }
}

export async function getServerSideProps(ctx: any): Promise<{ props: SearchResultProps }> {
  const {
    req, res, query
  } = ctx;

  let isValid = true;

  let rawQuery = query?.q as string | string[]

  if (!rawQuery) {
    isValid = false;    
  }

  // q should be valid to execute this line
  let pageIdx = 0;
  if(query.pageIdx !== undefined) {
    // Default to first page
    pageIdx = Number(query.pageIdx);
    if(isNaN(pageIdx)) {
      pageIdx = 0;
    }
  } 

  let searchQuery = ""
  if(Array.isArray(rawQuery)) {
    rawQuery.forEach(item => searchQuery = `${searchQuery} ${item}`)
  } else {
    searchQuery = rawQuery
  }

  let results = await getResults(searchQuery, pageIdx);

  return {
    props: {
      isValid,
      searchResults: results,
      searchQuery
    }
  }
}

export default SearchResult
