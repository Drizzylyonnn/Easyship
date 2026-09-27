import React from 'react'
import SeoFromApi from './components/SeoFromApi'

export default function App() {
  return (
    <div>
      <SeoFromApi apiUrl="/api/seo/home.json" />
      <h1>Welcome to Easyship</h1>
      <p>This is the Easyship demo app with metadata fetched from an API.</p>
    </div>
  )
}
