import type { NextPage } from 'next'
import Link from 'next/link';
import { ParsedUrlQuery } from 'querystring';
import styles from '../styles/Home.module.css'
const fs = require('fs');

interface IndexRequestResultProps {
  query: ParsedUrlQuery;
}

const IndexRequestResult: NextPage<IndexRequestResultProps> = (props: IndexRequestResultProps) => {
  // Get get arguments
  // Read results from database
  // Generate page based on results
  // Return page
  if (!props?.query?.site) {
    // Redirect   
    return (
      <div>
        <h1>Missing search query. Please go <Link href='/IndexScheduler'>back</Link> and try again.</h1>
      </div>
    );
  }

  let siteToIndex = props.query.site;

  /* Add site to index queue */


  fs.appendFile('$HOME/index_queue.txt', `${siteToIndex}\n`);
  
  return (
    <div className={styles.container}>
      <h1>Quaero</h1>
      <h2>{`Site: "${siteToIndex}" will be indexed as soon as possible. Check back in 48 hours.`}</h2>
    </div>
  )
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

export default IndexRequestResult
