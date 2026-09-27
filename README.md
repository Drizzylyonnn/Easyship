# Easyship

Minimal Vite + React app for the Easyship demo.

Quick start

```bash
cd Easyship
npm install
npm run dev
```

Edit `src/components/SeoFromApi.jsx` to point `apiUrl` at your SEO endpoint.

Google Maps API (optional)

- This demo can use the Google Maps JavaScript API for the live map. If you don't supply a key the page falls back to Leaflet/OpenStreetMap.
- To create an API key:
	1. Visit https://console.cloud.google.com/ and sign in.
  2. Create or select a project.
  3. Enable the "Maps JavaScript API" for the project.
  4. Under "APIs & Services → Credentials" create an API key and restrict it to the Maps JavaScript API and your origin if desired.

How to use the key with this demo
- Option A — URL parameter (recommended for quick local testing): open the page with the key in the query string:

	http://localhost:5173/Easyship.html?gm_key=YOUR_API_KEY

- Option B — edit the file directly: open `public/Easyship.html` and set the `GM_API_KEY` variable at the bottom of the file.

Notes
- If the Google key is invalid or restricted, the app automatically falls back to Leaflet (no key required).
- Replace `YOUR_API_KEY` with the key you created. For production, secure and restrict your key via Google Cloud restrictions.

Real MongoDB setup

This app already supports a real MongoDB connection through `MONGODB_URI`.

1. Copy the example environment file:

```bash
copy .env.example .env
```

2. Edit `.env` and replace the placeholder values with your real MongoDB connection string and admin credentials.

```env
PORT=3001
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/easyship?retryWrites=true&w=majority
ADMIN_USERNAME=admin
ADMIN_PASSWORD=easyship123
SESSION_SECRET=change_this_secret
```

3. Start the API:

```bash
npm run api
```

If `MONGODB_URI` is not set, the API automatically runs in local JSON mode and stores shipment data in `data/shipments.json` instead.
