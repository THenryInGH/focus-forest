# Focus Forest (GitHub Pages)

A tiny Forest-style focus timer (static HTML/CSS/JS) that:
- Tracks focus sessions for **today** (local time)
- Shows a small "forest" (one tree per completed session)
- Can submit today's totals to a **Google Form**

## 1) Create your Google Form

Make a Google Form with questions like:
1. **Date** (Short answer)
2. **Focused minutes** (Short answer or Number)
3. **Sessions** (Short answer or Number)
4. *(Optional)* **Notes** (Short answer)

Tip: link responses to a Google Sheet (Form -> Responses -> Link to Sheets).

### Get your entry IDs
Google Form:
- Click the **⋮** (More) menu
- Choose **Get pre-filled link**
- Fill sample values
- Click **Get link**

The URL will look like:
`https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url&entry.111=2026-01-03&entry.222=75...`

Those `entry.XXXX` are the IDs you need.

## 2) Configure `app.js`

Open `app.js` and set:

- `FORM.enabled = true`
- `FORM.formResponseUrl = "https://docs.google.com/forms/d/e/FORM_ID/formResponse"`
- Replace each `entry.*` with your real entry IDs.

## 3) Run locally (optional)

Just open `index.html` in your browser, or use a simple local server:
- VS Code Live Server, or
- `python -m http.server`

## 4) Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `focus-forest`)
2. Upload these files to the repo root:
   - `index.html`
   - `style.css`
   - `app.js`
3. GitHub repo -> **Settings** -> **Pages**
4. Choose:
   - Source: **Deploy from a branch**
   - Branch: `main` / `/ (root)`
5. Save — your site will be:
   `https://YOUR_USERNAME.github.io/YOUR_REPO/`

## Notes / limitations

- Google Forms **does not provide CORS headers**, so the site uses `fetch(..., {mode: "no-cors"})`.
  - You won't get a "success response" in the browser.
  - Check the Form Responses to confirm entries arrived.
- If your form requires sign-in or is restricted to your organization, the submission might fail.

If you need reliable submissions + authentication, a slightly more advanced approach is:
- A Google Apps Script Web App that accepts JSON and writes to a sheet.
