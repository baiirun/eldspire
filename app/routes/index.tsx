import { json, LoaderFunction, useLoaderData } from 'remix'
import { Block } from '~/components/notion/block'
import { NotionBlock } from '~/components/notion/types'
import { getFrontPage } from '~/db.server'

export const loader: LoaderFunction = async () => {
    return json(await getFrontPage(), {
        headers: {
            'Cache-Control': 'publilc, max-age=1, s-maxage=86400, stale-while-revalidate=3600',
        },
    })
}

export default function Index() {
    const blocks = useLoaderData<NotionBlock[]>()
    return (
        <>
            {blocks.map(b => (
                <Block key={b.id} block={b} />
            ))}
        </>
    )
}
