import { Link, Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useCatch, useTransition } from 'remix'
import type { MetaFunction, LinksFunction } from 'remix'
import { AnimatePresence, motion } from 'framer-motion'

import rootStyles from './styles/tailwind.css'
import React from 'react'

export const meta: MetaFunction = () => {
    return { title: 'Eldspire | A Fantasy World' }
}

export const links: LinksFunction = () => {
    return [{ rel: 'stylesheet', href: rootStyles }]
}

export default function App() {
    const isTransitioningPages = useTransition().state === 'loading'

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
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no"
                />
                <meta property="og:type" content="website" />

                {/* Essential for socials */}
                {/* <title></title> */}
                {/* <meta name="description" content=""/> */}
                {/* <meta property="og:title" content={title} /> */}
                {/* <meta property="og:description" content={description} /> */}
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
            </head>
            <body>
                <Layout>{children}</Layout>

                <ScrollRestoration />
                <Scripts />
                <LiveReload />
            </body>
        </html>
    )
}

function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <nav className="navbar">
                <Link to="/" prefetch="intent">
                    Home
                </Link>
            </nav>
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
