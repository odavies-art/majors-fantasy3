export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { tournamentId, apiKey, type } = req.query;

  if (!apiKey) {
    return res.status(400).json({ error: "Missing apiKey" });
  }

  const headers = {
    "X-RapidAPI-Key": apiKey,
    "X-RapidAPI-Host": "golf-leaderboard-data.p.rapidapi.com",
  };

  try {
    // type=rankings fetches world rankings, otherwise fetches leaderboard
    if (type === "rankings") {
      const response = await fetch(
        "https://golf-leaderboard-data.p.rapidapi.com/world-rankings",
        { headers }
      );
      if (!response.ok) {
        return res.status(response.status).json({ error: `RapidAPI error ${response.status}` });
      }
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (!tournamentId) {
      return res.status(400).json({ error: "Missing tournamentId" });
    }

    const response = await fetch(
      `https://golf-leaderboard-data.p.rapidapi.com/leaderboard/${tournamentId}`,
      { headers }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `RapidAPI error ${response.status}` });
    }
    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
