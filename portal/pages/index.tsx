import type { NextPage } from 'next'
import Link from 'next/link'
import styles from '../styles/Home.module.css'

const Home: NextPage = () => {
  return (
    <div>
      <div className={styles.container}>
        <h1>Quaero</h1>
        <form action="/SearchResult" method="get">
          <input type={"text"} name="q"></input>
          <input type="submit" value="Search"></input>
        </form>
      </div>
      <div className={styles.container}>
        <p><Link href={"/IndexScheduler"}>Index a site?</Link></p>
      </div>
    </div>
  )
}

export default Home
