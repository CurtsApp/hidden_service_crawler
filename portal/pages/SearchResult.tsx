import type { NextPage } from 'next'
import { ParsedUrlQuery } from 'querystring';
import Home from '.';
import styles from '../styles/Home.module.css'
import { getResults, SearchResult}  from '../util/resultUtils'

interface SearchResultProps {
  query: ParsedUrlQuery;
}

const SearchResult: NextPage<SearchResultProps> = (props: SearchResultProps) => {
  // Get get arguments
  // Read results from database
  // Generate page based on results
  // Return page
  if(!props?.query?.q) {
    // Redirect   
    return (
      <div>
        <h1>Missing search query. Please go <a href='/'>home</a> and try again.</h1>
      </div>
    );
  }

  // q should be valid to execute this line
  let searchQuery = props.query.q;
  let pageIdx = 0;
  if(props.query.pageIdx !== undefined) {
    // Default to first page
    pageIdx = Number(props.query.pageIdx);
    if(isNaN(pageIdx)) {
      pageIdx = 0;
    }
  } 

  const query = props.query.q;
  let results = getResults(searchQuery, pageIdx);
  
  return (
    <div className={styles.container}>
      <h1>Results!</h1>
      {results.pageResults.map(res => SiteResult(res))}
      <h2>{`Total Pages: ${results.totalMatches}`}</h2>
    </div>
  )

  function SiteResult(props: SearchResult) {
    return (
      <div>
        <h2>{props.url}</h2>
        <h3>{`Contains: ${props.containsKeywords}`}</h3>
        <h3>{`Missing: ${props.excludesKeywords}`}</h3>
        <h3>{`Uptime: ${props.uptime}`}</h3>
      </div>
    )
  }
}

export async function getServerSideProps(ctx: any) {
  const {
    req, res, query
  } = ctx;

  return {
    props: {
      query
    }
  }
}

export default SearchResult
