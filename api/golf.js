export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { tournamentId } = req.query;

  if (!tournamentId) {
    return res.status(400).json({ error: "Missing tournamentId" });
  }

  try {
    // ESPN public API — no key required
    const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard/_/tournamentId/${tournamentId}`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0", // ESPN sometimes blocks non-browser UAs
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `ESPN API error ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
