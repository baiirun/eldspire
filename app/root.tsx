import type { LinksFunction, MetaFunction } from '@remix-run/server-runtime'
import { json, LoaderFunction } from '@remix-run/server-runtime'

import {
    Links,
    LiveReload,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLoaderData,
    useTransition,
} from '@remix-run/react'

import { AnimatePresence, motion } from 'framer-motion'

import rootStyles from './styles/tailwind.css'
import React from 'react'
import { Navbar } from './components/navbar'
import { getPageLinks, PageLink } from './db.server'
import { useIsomorphicSearch } from './state'

export const meta: MetaFunction = () => {
    const title = 'Eldspire | A Fantasy World'
    const url = 'https://eldspire.com'

    return {
        title,
        'og:title': title,
        url,
        'og:url': url,
    }
}

export const links: LinksFunction = () => {
    return [{ rel: 'stylesheet', href: rootStyles }]
}

export const loader: LoaderFunction = async ({ request }) => {
    const pages = await getPageLinks()
    return json(pages)
}

export default function App() {
    const pages = useLoaderData<PageLink[]>()
    const isTransitioningPages = useTransition().state === 'loading'
    useIsomorphicSearch(pages)

    return (
        <Document>
            <AnimatePresence>
                {!isTransitioningPages ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Outlet />
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </Document>
    )
}

function Document({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta property="og:type" content="website" />

                {/* Essential for socials */}
                {/* <title></title> */}
                {/* <meta property="og:title" content={title} /> */}
                <meta name="description" content="Wiki site for the Eldspire fantasy universe." />
                <meta property="og:description" content="Wiki site for the Eldspire fantasy universe." />
                <meta name="twitter:card" content="summary_large_image" />
                {/* TODO: Base image off image in content -- once library is open. Prob will come from CDN */}
                <meta property="og:image" content="/site.png" />

                {/* Less essential */}
                <meta property="og:site_name" content="eldspire.com" />
                <meta name="twitter:site" content="@byronguina" />
                <meta name="twitter:creator" content="@byronguina" />
                <meta name="theme-color" content="#f2f2f0" />

                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

                <link rel="shortcut icon" type="image/png" href="/favicon.png" />
                <link rel="apple-touch-icon" href="/favicon.png" />
                <Meta />
                <Links />
                <LiveReload />
            </head>
            <body className="relative">
                <Layout>{children}</Layout>

                <ScrollRestoration />
                <Scripts />
                {/* {process.env.NODE_ENV === 'development' && <LiveReload />} */}
            </body>
        </html>
    )
}

function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <Navbar />
            <main className="layout">{children}</main>
        </div>
    )
}

export function CatchBoundary() {
    return (
        <Document>
            <p>Uh oh, looks like something went wrong. Our bad. Hit the Home button to go back to the wiki.</p>
        </Document>
    )
}

export function ErrorBoundary() {
    return (
        <Document>
            <p>Uh oh, looks like something went wrong. Our bad. Hit the Home button to go back to the wiki.</p>
        </Document>
    )
}
