export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method === "OPTIONS") return res.status(200).end();

  const { tournamentId } = req.query;
  if(!tournamentId) return res.status(400).json({ error: "Missing tournamentId" });

  // ESPN blocks requests where the server IP isn't in their allowlist.
  // We spoof the headers to look like a browser navigating from espn.com directly.
  const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard/_/tournamentId/${tournamentId}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.espn.com/golf/leaderboard",
        "Origin": "https://www.espn.com",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "Cache-Control": "no-cache",
      }
    });

    if(!response.ok) {
      const text = await response.text().catch(() => "");
      return res.status(response.status).json({ 
        error: `ESPN error ${response.status}`, 
        detail: text.substring(0, 200) 
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
