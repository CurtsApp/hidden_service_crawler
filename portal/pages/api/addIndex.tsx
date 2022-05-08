// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse, NextPage } from 'next'
import Link from 'next/link'

type Data = {
  name: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  
  console.log(req)
  res.status(200).send()
}

const addIndexResultPage: NextPage = () => {
  return (
    <div>
      Result?
      <Link href="/">Home</Link>
      <Link href="/IndexScheduler">Back</Link>
    </div>
  );
}
