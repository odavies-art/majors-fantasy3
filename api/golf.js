export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method === "OPTIONS") return res.status(200).end();

  const { orgId, tournId, year } = req.query;
  if(!orgId || !tournId || !year) {
    return res.status(400).json({ error: "Missing orgId, tournId or year" });
  }

  const url = `https://live-golf-data.p.rapidapi.com/leaderboard?orgId=${orgId}&tournId=${tournId}&year=${year}`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": "92766ebb54msh2c3ec07cacb2b5ep1851b9jsnc0a92e82897a",
        "X-RapidAPI-Host": "live-golf-data.p.rapidapi.com",
      }
    });

    if(!response.ok) {
      const text = await response.text().catch(() => "");
      return res.status(response.status).json({ error: `API error ${response.status}`, detail: text.substring(0, 200) });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
