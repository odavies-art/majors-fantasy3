export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { tournamentId, apiKey, type, tour, season } = req.query;

  if (!apiKey) {
    return res.status(400).json({ error: "Missing apiKey" });
  }

  const headers = {
    "X-RapidAPI-Key": apiKey,
    "X-RapidAPI-Host": "golf-leaderboard-data.p.rapidapi.com",
  };

  try {
    // type=rankings fetches world rankings
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

    // type=fixtures fetches tournament schedule
    if (type === "fixtures") {
      const t = tour || "pga";
      const s = season || new Date().getFullYear();
      const response = await fetch(
        `https://golf-leaderboard-data.p.rapidapi.com/fixtures/${t}/${s}`,
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
