Server-side rendering (SSR) notes for Aerogram

Overview
- SSR is required for SEO-critical pages so meta tags are present in the initial HTML response.
- Options: use a framework with built-in SSR (Next.js, Remix), or add a small Node server that renders with React on the server (Vite + Express or plain Node).

Key considerations
- Data fetching: fetch SEO/meta on the server before rendering so title/description are injected server-side.
- Hydration: server returns HTML produced by React; client hydrates to make it interactive.
- Meta management: use `react-helmet-async` server APIs to extract head tags during server render.

Minimal Express + Vite SSR flow (conceptual)
1. Build client assets with Vite: `vite build`.
2. Create a server entry that imports your app's server renderer.
3. On each request, fetch SEO meta (from your API or DB), render the React tree to string with `HelmetProvider` and the meta data, then insert rendered HTML + head tags into an HTML template and return.

Example server sketch (Node / Express)

```js
// server.js (conceptual)
import express from 'express'
import fs from 'fs'
import path from 'path'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { HelmetProvider } from 'react-helmet-async'
import App from './dist/server/App.js' // your server bundle exported as an ESM

const indexHtml = fs.readFileSync(path.resolve('dist/client/index.html'), 'utf-8')

const server = express()
server.use('/assets', express.static('dist/client/assets'))

server.get('*', async (req, res) => {
  // fetch SEO meta for this route
  const meta = await fetchSeoForPath(req.path)

  const helmetContext = {}
  const appHtml = renderToString(
    <HelmetProvider context={helmetContext}>
      <App initialMeta={meta} url={req.url} />
    </HelmetProvider>
  )

  const { helmet } = helmetContext
  const html = indexHtml
    .replace('<!--app-html-->', appHtml)
    .replace('<!--head-tags-->', `${helmet.title.toString()}${helmet.meta.toString()}${helmet.link.toString()}`)

  res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
})

server.listen(3000)
```

Notes on `react-helmet-async` SSR
- Wrap the server render in `<HelmetProvider context={helmetContext}>`.
- After `renderToString`, `helmetContext.helmet` contains `.title`, `.meta`, `.link` helpers with `.toString()` to inject into HTML.

Next steps for Aerogram
- Decide whether to migrate to Next.js (simpler SSR) or add a small Node server as above.
- Implement server-side data fetch for SEO endpoints so pages render with full meta.

References
- See `react-helmet-async` for SSR usage and the Vite SSR guide for build/run details.
