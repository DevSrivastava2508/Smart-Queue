# SmartQueue – Patient Appointment & Live Queue

AI-Powered Hospital Appointment and Patient Live Queue Management System.

## Project Structure

```
├── index.html           # Main frontend application (HTML, Tailwind CSS, JS logic, i18n, Medi AI)
├── 404.html             # Custom 404 error page
├── server.js            # Node.js backend server (HTTP server, static file serving, AI proxy, Apps Script bridge)
├── server.cjs           # CommonJS server bundle
├── manifest.json        # PWA Web App Manifest
├── sw.js                # PWA Service Worker for offline caching & background sync
├── vercel.json          # Vercel deployment configuration
├── api/
│   ├── chat.js          # Serverless route for AI chat assistant
│   ├── send-confirmation.js # Serverless route for booking email notification
│   └── health.js        # Health check endpoint
├── icons/               # PWA App icons & SVG assets
│   ├── icon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
└── hero-hospital.jpg    # Hero banner visual
```

## Running Locally

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. (Optional) Set your `OPENROUTER_API_KEY` or `GOOGLE_API_KEY` inside `.env` to enable live AI chat.
3. Start the server:
   ```bash
   npm start
   ```
4. Open your browser at:
   ```
   http://localhost:8080
   ```
