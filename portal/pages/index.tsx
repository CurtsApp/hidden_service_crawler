import type { NextPage } from 'next'
import styles from '../styles/Home.module.css'

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <h1>Quaero</h1>
      <form action="/SearchResult" method="get">
        <input type={"text"} name="q"></input>
        <input type="submit" value="Search"></input>
      </form>      
    </div>
  )
}

export default Home
