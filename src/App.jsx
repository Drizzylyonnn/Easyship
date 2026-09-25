import React from 'react'
import SeoFromApi from './components/SeoFromApi'

export default function App() {
  return (
    <div>
      <SeoFromApi apiUrl="/api/seo/home.json" />
      <h1>Welcome to Aerogram (React)</h1>
      <p>This is a minimal demo with SEO meta fetched from an API.</p>
    </div>
  )
}
