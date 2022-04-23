import type { NextPage } from 'next'
import { useRouter } from 'next/router';
import { ParsedUrlQuery } from 'querystring';
import Home from '.';
import styles from '../styles/Home.module.css'

interface SearchResultProps {
  query: ParsedUrlQuery;
}

const SearchResult: NextPage<SearchResultProps> = (props: SearchResultProps) => {
  // Get get arguments
  // Read results from database
  // Generate page based on results
  // Return page

  console.log(props);

  if(!props?.query?.q) {
    // Redirect
    console.log("Redirecting");
    
    return (
      <div>
        <h1>Missing search query. Please go <a href='/'>home</a> and try again.</h1>
      </div>
    );
  }

  const query = props.query;
  let results = [];
  
  return (
    <div className={styles.container}>
      <h1>Results!</h1>
      <h2>{query.q}</h2>
    </div>
  )

  interface SiteResultProps {
    url: string;
    containsKeywords: string[];
    excludesKeywords: string[];
    uptime: number;
  }

  function SiteResult(props: SiteResultProps) {
    return (
      <div>
        <h2>{props.url}</h2>
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
