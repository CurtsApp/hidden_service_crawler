import type { NextPage } from 'next'
import Link from 'next/link';
import styles from '../styles/Home.module.css'

const IndexScheduler: NextPage = () => {
  return (
    <div>
      <div className={styles.container}>
        <h1><Link href={"/"}>Quaero</Link></h1>
        <h2>Request site indexing</h2>
        <form action="/api/addIndex" method="post">
          <input type={"text"} name="q"></input>
          <input type="submit" value="Submit"></input>
        </form>
      </div>
      <div className={styles.container}>
        <p><Link href={"/"}>Search for sites?</Link></p>
      </div>
    </div>
  )
}

export default IndexScheduler
