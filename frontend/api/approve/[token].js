// Vercel Serverless Function — Dynamic OG preview for /approve/:token links.
// Deployed automatically when file lives in /frontend/api/ and vercel.json rewrites match.
// When a WhatsApp/Facebook/Twitter/LinkedIn/Slack crawler fetches /approve/:token,
// this function returns HTML with per-approval OG meta tags. Real browsers get an
// immediate redirect to the SPA route so the app still works.

const CRAWLER_UA_RE = /(WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|SkypeUriPreview|Applebot|Googlebot|bingbot|embedly|Iframely|redditbot)/i;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

export default async function handler(req, res) {
  const { token } = req.query;
  const ua = req.headers["user-agent"] || "";
  const isCrawler = CRAWLER_UA_RE.test(ua);

  // Real browsers: bounce straight to the SPA route
  if (!isCrawler) {
    res.writeHead(302, { Location: `/approve-app/${encodeURIComponent(token)}` });
    return res.end();
  }

  // Crawlers: fetch minimal meta from Supabase & return an OG-rich HTML stub
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  let subject = "Approval Request";
  let customer = "";
  let project = "";
  let status = "pending";

  if (SUPABASE_URL && SUPABASE_ANON) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_approval_meta_by_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ p_token: token }),
      });
      if (r.ok) {
        const rows = await r.json();
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (row) {
          subject = row.subject || subject;
          customer = row.customer_name || "";
          project = row.project_name || "";
          status = row.status || status;
        }
      }
    } catch (_) { /* ignore, fall back to defaults */ }
  }

  const title = `Approval Info : ${subject}${customer ? ` (${customer})` : ""}`;
  const desc = [
    status === "pending" ? "Please review and respond." : `Status: ${status.toUpperCase()}.`,
    project && `Project: ${project}`,
    "— Sankalp Group · Business Solutions",
  ].filter(Boolean).join(" · ");
  const url = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/approve/${token}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).end(`<!doctype html><html><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:site_name" content="Sankalp Group · Business Solutions">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta http-equiv="refresh" content="0;url=/approve-app/${encodeURIComponent(token)}">
</head><body>
<h1>${esc(title)}</h1>
<p>${esc(desc)}</p>
<p><a href="/approve-app/${encodeURIComponent(token)}">Open approval page</a></p>
</body></html>`);
}
