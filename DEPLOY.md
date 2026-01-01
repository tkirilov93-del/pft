# Deployment Guide

## Recommended Hosting: Vercel (Easiest & Free)
Since this application uses **Server-Side API Routes** to securely proxy requests to Trading212 and Crypto.com, it requires a Node.js environment. It cannot be hosted on simple static hosting (like GitHub Pages) without modification.

**Vercel** is the creators of Next.js and provides free hosting for this exact type of app.

### Option 1: Drag & Drop (Fastest)
1.  Go to [https://vercel.com/new](https://vercel.com/new).
2.  If you have the `portfolio-tracker-source` folder or zip, you can try importing via CLI or Git.
3.  **Better method:** Push this code to a **GitHub Repository**.
4.  In Vercel, click "Import" next to your new repository.
5.  Click **Deploy**.
6.  That's it! Vercel detects everything automatically.

### Option 2: Manual Node.js Hosting
If you have a VPS or server with Node.js installed:
1.  Upload these files.
2.  Run `npm install`.
3.  Run `npm run build`.
4.  Run `npm start`.
5.  The app will run on port 3000.

## Environment Variables
This app operates **client-side** for keys (Session Storage), so you do **NOT** need to set any API keys in the server environment variables. This makes deployment very simple.
