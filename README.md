# simvy-site

The Simvy marketing landing page, served on GitHub Pages at simvy.app.
Single self-contained index.html (fonts, images and video inlined; exported from Claude Design and wired to the join-waitlist Edge Function).
Do NOT add a CNAME file before the DNS records exist - cutover order matters.

## t.js — the traffic counter

Every page loads `<script defer src="/t.js"></script>` from just before
`</head>`. It reports a page view and CTA clicks to the `track-visit` Supabase
Edge Function, and a digest email goes out each morning. Without it nothing
records a visit at all: GitHub Pages gives the site owner no access logs, and
Search Console covers only the Google-search slice of the traffic.

**After any re-export of index.html from Claude Design, put that line back.**
The export overwrites the whole file and the loss is silent: the page looks
perfectly fine and simply stops being counted. The logic lives in its own file
precisely so a re-export can cost the one script tag and never the tracker.

No cookie, no localStorage, nothing stored on the visitor's device, so no
consent banner is required.
