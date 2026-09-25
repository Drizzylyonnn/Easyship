import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'

export default function SeoFromApi({ apiUrl }) {
  const [meta, setMeta] = useState(null)

  useEffect(() => {
    let mounted = true
    async function fetchMeta() {
      try {
        const res = await fetch(apiUrl)
        if (!res.ok) throw new Error('Network response not ok')
        const data = await res.json()
        if (mounted) setMeta(data)
      } catch (e) {
        console.error('Failed to fetch SEO meta', e)
      }
    }
    fetchMeta()
    return () => { mounted = false }
  }, [apiUrl])

  if (!meta) return null

  return (
    <Helmet>
      {meta.title && <title>{meta.title}</title>}
      {meta.description && (
        <meta name="description" content={meta.description} />
      )}
      {meta.ogTitle && <meta property="og:title" content={meta.ogTitle} />}
      {meta.ogDescription && (
        <meta property="og:description" content={meta.ogDescription} />
      )}
      {meta.ogImage && <meta property="og:image" content={meta.ogImage} />}
      {meta.canonical && <link rel="canonical" href={meta.canonical} />}
    </Helmet>
  )
}
