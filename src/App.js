import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qmnulgmtzntxrdzcqnpb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtbnVsZ210em50eHJkemNxbnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODU5NDcsImV4cCI6MjA5NDE2MTk0N30.cfyVVLK1Ky73YmeyET-jy0z2cw2K029QTacPUgVpXsg"
);

// ─── Constants ────────────────────────────────────────────────────────────────
// ESPN tournament IDs for 2026 season — update each season
const MAJORS = [
  {id:"401811941", name:"The Masters",           course:"Augusta National Golf Club"},
  {id:"401811947", name:"PGA Championship",      course:"Aronimink Golf Club"},
  {id:"401811952", name:"US Open",               course:"Oakmont Country Club"},
  {id:"401811957", name:"The Open Championship", course:"Royal Portrush"},
];

const DEFAULT_TOURNAMENT = {
  majorId:"", name:"", course:"", date:"", status:"upcoming",
  currentRound:1, cutLine:null, locked:false, lastUpdated:null, field:[],
};

// ─── Supabase DB helpers ──────────────────────────────────────────────────────
// Rankings live in their own table — shared across all leagues
// Tournaments no longer store rankings or a using_mock flag
const db = {
  async getUsers(){ const {data} = await supabase.from("users").select("*"); return data||[]; },
  async createUser(u){ await supabase.from("users").insert(u); },
  async updateUser(username, updates){ await supabase.from("users").update(updates).eq("username", username); },

  async getLeagues(){ const {data} = await supabase.from("leagues").select("*"); return data||[]; },
  async createLeague(l){ await supabase.from("leagues").insert(l); },
  async updateLeague(code, updates){ await supabase.from("leagues").update(updates).eq("code", code); },
  async deleteLeague(code){ await supabase.from("leagues").delete().eq("code", code); },

  async getTournaments(){ const {data} = await supabase.from("tournaments").select("*"); return data||[]; },
  async upsertTournament(t){
    const {error} = await supabase
      .from("tournaments")
      .upsert(t, {onConflict:"league_code", ignoreDuplicates:false});
    if(error) throw new Error(`Tournament save failed: ${error.message} | code: ${error.code} | details: ${error.details}`);
  },

  async getPicks(){ const {data} = await supabase.from("picks").select("*"); return data||[]; },
  async upsertPick(p){
    const {error} = await supabase.from("picks").upsert(p, {onConflict:"pick_key"});
    if(error) throw new Error(`Pick save failed: ${error.message}`);
  },

  // Rankings: always a full replace — delete all then insert fresh
  async getRankings(){
    const {data} = await supabase.from("rankings").select("*").order("rank", {ascending:true});
    return data||[];
  },
  async saveRankings(rows){
    const {error: delError} = await supabase
      .from("rankings").delete().gte("rank", 1);
    if(delError) throw new Error(`Rankings delete failed: ${delError.message}`);
    if(rows.length === 0) return;
    for(let i = 0; i < rows.length; i += 500){
      const {error: insError} = await supabase
        .from("rankings").upsert(rows.slice(i, i + 500), {onConflict:"rank"});
      if(insError) throw new Error(`Rankings save failed (batch ${i/500+1}): ${insError.message}`);
    }
  },
};

function tournamentToDb(code, t){
  return {
    league_code:   code,
    major_id:      t.majorId      || "",
    name:          t.name         || "",
    course:        t.course       || "",
    date:          t.date         || "",
    status:        t.status       || "upcoming",
    current_round: t.currentRound || 1,
    cut_line:      t.cutLine      || null,
    locked:        t.locked       || false,
    last_updated:  t.lastUpdated  || null,
    field:         t.field        || [],
  };
}

function tournamentFromDb(row){
  if(!row) return DEFAULT_TOURNAMENT;
  // Clear field if it looks like old mock data (mock entries have sequential numeric ids 1-35)
  const rawField = row.field || [];
  const isMockField = rawField.length > 0 && rawField.length <= 35 &&
    rawField.every((p, i) => p.id === i + 1);
  const field = isMockField ? [] : rawField;
  return {
    majorId:      row.major_id      || "",
    name:         row.name          || "",
    course:       row.course        || "",
    date:         row.date          || "",
    status:       row.status        || "upcoming",
    currentRound: row.current_round || 1,
    cutLine:      row.cut_line      || null,
    locked:       row.locked        || false,
    lastUpdated:  row.last_updated  || null,
    field,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genCode(){ return Math.random().toString(36).substring(2,7).toUpperCase(); }
function isTop10(r){ return r && r <= 10; }

// Normalise player names for fuzzy matching between OWGR and ESPN
function normaliseName(n){
  return n.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\bjr\.?\b|\bsr\.?\b|\biii?\b|\bii\b/g, "")
    .replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function buildRankLookup(rankings){
  const map = {};
  rankings.forEach(r => { map[normaliseName(r.name)] = r.rank; });
  return map;
}

// Apply rankings to a field array, returning updated worldRank per player
function applyRankings(field, rankings){
  const lookup = buildRankLookup(rankings);
  return field.map(p => ({
    ...p,
    worldRank: lookup[normaliseName(p.name)] || 999,
  }));
}

// Scoring: look up a pick by name in the live field
// Returns { pos, score, display, unmatched }
// unmatched=true means the player wasn't found in the field — shown as "?" not 0
function getGolferScore(name, field, cutLine){
  const g = field.find(f => normaliseName(f.name) === normaliseName(name));
  if(!g) return {pos:null, score:null, display:"?", unmatched:true};
  if(g.cut){
    const p = cutLine || 65;
    return {pos:p, score:p, display:`MC (T${p})`, unmatched:false};
  }
  if(!g.pos) return {pos:null, score:null, display:"–", unmatched:false};
  return {pos:g.pos, score:g.pos, display:`${g.pos}`, unmatched:false};
}

// Calculate total score for a set of picks against the live field
// Unmatched players are excluded from total (shown as ?) rather than counting as 0
function calcScore(picks, field, cutLine){
  if(!picks?.mains?.length) return {total:null, breakdown:[]};
  const breakdown = picks.mains.map(name => ({name, ...getGolferScore(name, field, cutLine)}));
  const matched   = breakdown.filter(b => !b.unmatched && b.score !== null);
  const total     = matched.length === 4
    ? matched.reduce((s,b) => s + b.score, 0)
    : null; // don't show total until all 4 are matched
  return {total, breakdown};
}

// ─── ESPN leaderboard fetch ───────────────────────────────────────────────────
async function fetchLiveData(majorId, rankings){
  const res = await fetch(`/api/golf?tournamentId=${majorId}`);
  if(!res.ok){
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `ESPN API ${res.status}`);
  }
  const data = await res.json();
  const competitors = data?.events?.[0]?.competitions?.[0]?.competitors || [];
  if(competitors.length === 0) throw new Error("No competitors found — tournament may not have started yet.");

  const field = competitors.map((c, i) => {
    const athlete = c.athlete || {};
    const status  = c.status  || {};

    const scoreStr = c.score || "E";
    const score    = scoreStr === "E" ? 0 : (parseInt(scoreStr) || 0);

    const posStr = c.sortOrder || c.position?.displayName || "";
    const pos    = parseInt(posStr) || null;

    const thruVal = status.thru || status.period || 0;
    const thru    = status.type?.description === "Final" ? "F"
                  : thruVal === 0 ? "-" : `${thruVal}`;

    const isCut = status.type?.name === "STATUS_MISSED_CUT"
               || status.type?.name === "STATUS_CUT"
               || (status.type?.name||"").includes("CUT");
    const isOut = status.type?.name === "STATUS_WITHDRAWN"
               || status.type?.name === "STATUS_DQ"
               || isCut;

    return {
      id:        athlete.id || i,
      name:      athlete.displayName || `Player ${i+1}`,
      worldRank: 999,
      pos, score, thru,
      cut: isOut,
    };
  });

  // Cross-reference with rankings to assign worldRank
  return rankings.length > 0 ? applyRankings(field, rankings) : field;
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseOwgrCsv(csvText){
  const lines = csvText.trim().split("\n");
  if(lines.length < 2) throw new Error("CSV appears empty");

  const clean = s => s.replace(/^\uFEFF/, "").replace(/^"|"$/g, "").trim();
  const headers = lines[0].split(",").map(clean).map(h => h.toUpperCase());

  const rankIdx  = headers.indexOf("RANKING");
  const nameIdx  = headers.indexOf("NAME");
  const firstIdx = headers.indexOf("FIRST NAME");
  const lastIdx  = headers.indexOf("LAST NAME");
  const ctryIdx  = headers.indexOf("CTRY");
  const ptsIdx   = headers.indexOf("AVERAGE POINTS");

  if(rankIdx === -1 || (nameIdx === -1 && firstIdx === -1)){
    throw new Error("CSV missing expected columns. Expected: RANKING, NAME (or FIRST NAME + LAST NAME).");
  }

  const rankings = [];
  for(let i = 1; i < lines.length; i++){
    const line = lines[i];
    if(!line.trim()) continue;

    // Parse quoted CSV fields correctly
    const cols = [];
    let inQ = false, cur = "";
    for(const ch of line){
      if(ch === '"'){ inQ = !inQ; }
      else if(ch === "," && !inQ){ cols.push(cur); cur = ""; }
      else cur += ch;
    }
    cols.push(cur);

    const col = idx => (cols[idx] || "").replace(/^"|"$/g, "").trim();
    const rank = parseInt(col(rankIdx));
    if(!rank || isNaN(rank)) continue;

    let name = nameIdx >= 0 ? col(nameIdx) : "";
    if(!name && firstIdx >= 0) name = `${col(firstIdx)} ${col(lastIdx)}`.trim();
    if(!name) continue;

    const country = ctryIdx >= 0 ? col(ctryIdx) : "";
    const ptsRaw  = ptsIdx  >= 0 ? col(ptsIdx)  : "-";
    const points  = ptsRaw === "-" ? "0.00" : parseFloat(ptsRaw).toFixed(2);

    rankings.push({ rank, name, country, points });
    if(rank > 300) break; // 300 is plenty of buffer for the top-10 rule
  }

  if(rankings.length === 0) throw new Error("No ranked players found in CSV.");

  // Deduplicate by rank — keep first occurrence (CSV is ordered so first is correct)
  const seen = new Set();
  const deduped = rankings.filter(r => {
    if(seen.has(r.rank)) return false;
    seen.add(r.rank);
    return true;
  });

  return deduped;
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:"#0d1a0d", surface:"#132013", card:"#192619", border:"#2a3d2a",
  accent:"#4ade80", accentDim:"#22c55e", gold:"#f59e0b",
  text:"#e8f5e8", muted:"#6b8f6b", danger:"#f87171", warning:"#fbbf24",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:${C.bg};color:${C.text};font-family:'DM Sans',sans-serif;min-height:100vh;}
input,select{background:${C.card};border:1px solid ${C.border};color:${C.text};padding:10px 14px;border-radius:8px;font-family:inherit;font-size:14px;width:100%;outline:none;transition:border .2s;}
input:focus,select:focus{border-color:${C.accentDim};}
input::placeholder{color:${C.muted};}
button{cursor:pointer;font-family:inherit;border:none;border-radius:8px;font-size:14px;font-weight:500;transition:all .15s;}
::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:${C.bg};}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
.nav-tab{background:#1f3020;color:#f0fff0;padding:8px 18px;border-radius:20px;font-size:13px;font-weight:600;border:1px solid #4a6a4a;transition:all .15s;}
.nav-tab:hover{background:#2a4a2a;border-color:#5a8a5a;}
.nav-tab.active{background:${C.accent};color:#061006;border-color:${C.accent};}
.btn-primary{background:${C.accent};color:#061006;padding:11px 22px;font-weight:600;}
.btn-primary:hover:not(:disabled){background:#6ee7a0;}
.btn-primary:disabled{opacity:.35;cursor:not-allowed;}
.btn-secondary{background:${C.card};color:#f0fff0;padding:10px 18px;border:1px solid #4a6a4a;}
.btn-secondary:hover{border-color:${C.accentDim};}
.btn-ghost{background:transparent;color:#c0d8c0;padding:8px 14px;border:1px solid #3a5a3a;}
.btn-ghost:hover{color:#f0fff0;border-color:#4a6a4a;}
.card{background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:20px;}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;}
.b-green{background:#14532d;color:${C.accent};}
.b-amber{background:#451a03;color:${C.gold};}
.b-red{background:#7f1d1d;color:${C.danger};}
.b-gray{background:#1c2a1c;color:${C.muted};}
.b-warn{background:#3b2a00;color:${C.warning};}
.b-blue{background:#0c2744;color:#60a5fa;}
table{width:100%;border-collapse:collapse;font-size:13px;}
th{color:${C.muted};font-weight:500;text-transform:uppercase;font-size:11px;letter-spacing:.8px;padding:8px 12px;border-bottom:1px solid ${C.border};text-align:left;}
td{padding:10px 12px;border-bottom:1px solid #192619;color:${C.text};}
tr:hover td{background:${C.surface};}
tr:last-child td{border-bottom:none;}
.page-title{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#f0fff0;}
.page-sub{color:${C.muted};font-size:13px;margin-top:4px;}
.fade{animation:fi .25s ease;}
@keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.league-select{background:#1f3020;border:1px solid #3a5a3a;color:#f0fff0;padding:8px 32px 8px 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;outline:none;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234ade80' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;min-width:160px;}
.league-select:focus{border-color:${C.accent};}
.toggle-track{width:44px;height:24px;border-radius:12px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0;background:${C.border};}
.toggle-track.on{background:${C.accentDim};}
.toggle-thumb{width:18px;height:18px;background:#fff;border-radius:50%;position:absolute;top:3px;left:3px;transition:transform .2s;}
.toggle-track.on .toggle-thumb{transform:translateX(20px);}
.admin-subtab{padding:8px 16px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;transition:all .15s;}
.admin-subtab.active{background:${C.card};color:#f0fff0;}
.admin-subtab:not(.active){background:transparent;color:#a0c0a0;}
.admin-subtab:hover:not(.active){color:#f0fff0;}
.form-label{font-size:12px;color:${C.muted};display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.6px;}
.code-pill{font-family:monospace;background:#0c2744;color:#60a5fa;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:1px;}
.empty-state{text-align:center;padding:60px 20px;}
.loading{display:flex;align-items:center;justify-content:center;min-height:100vh;background:${C.bg};color:${C.muted};font-size:16px;font-family:'DM Sans',sans-serif;}
`;

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(dateStr){
  const [diff, setDiff] = useState(null);
  useEffect(() => {
    if(!dateStr) return;
    const target = new Date(dateStr);
    const tick = () => { const ms = target - Date.now(); setDiff(ms > 0 ? ms : 0); };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dateStr]);
  if(diff === null || diff === undefined) return null;
  if(diff === 0) return "Starting now!";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if(d > 0) return `${d}d ${h}h ${m}m`;
  if(h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App(){
  const [users,            setUsers]            = useState([]);
  const [picks,            setPicks]            = useState({});
  const [leagues,          setLeagues]          = useState([]);
  const [tournaments,      setTournaments]      = useState({});
  const [rankings,         setRankings]         = useState([]);
  const [currentUser,      setCurrentUser]      = useState(null);
  const [page,             setPage]             = useState("login");
  const [authMode,         setAuthMode]         = useState("login");
  const [activeLeagueCode, setActiveLeagueCode] = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [dbError,          setDbError]          = useState("");

  useEffect(() => {
    async function load(){
      const [dbUsers, dbLeagues, dbTournaments, dbPicks, dbRankings] = await Promise.all([
        db.getUsers(), db.getLeagues(), db.getTournaments(), db.getPicks(), db.getRankings(),
      ]);
      setUsers(dbUsers);
      setLeagues(dbLeagues);
      const tMap = {};
      dbTournaments.forEach(row => { tMap[row.league_code] = tournamentFromDb(row); });
      setTournaments(tMap);
      const pMap = {};
      dbPicks.forEach(row => { pMap[row.pick_key] = {mains: row.mains||[], tiebreakers: row.tiebreakers||[]}; });
      setPicks(pMap);
      setRankings(dbRankings);
      setLoading(false);
    }
    load();
  }, []);

  // Keep active league in sync when leagues or user changes
  useEffect(() => {
    const myLeagues = leagues.filter(l => l.members.includes(currentUser?.username));
    if(myLeagues.length > 0 && (!activeLeagueCode || !myLeagues.find(l => l.code === activeLeagueCode))){
      setActiveLeagueCode(myLeagues[0].code);
    }
    if(myLeagues.length === 0) setActiveLeagueCode(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagues, currentUser]);

  const saveLeagues = async (updated) => { setLeagues(updated); };
  const updateLeagueInDb = async (league) => { await db.updateLeague(league.code, {members: league.members}); };

  const savePicks = async (updated) => {
    setPicks(updated);
    const keys = Object.keys(updated);
    const latest = keys[keys.length - 1];
    if(latest){
      const p = updated[latest];
      const [leagueCode, ...userParts] = latest.split(":");
      const username = userParts.join(":");
      await db.upsertPick({pick_key: latest, username, league_code: leagueCode, mains: p.mains, tiebreakers: p.tiebreakers});
    }
  };

  const updateTournament = async (code, t) => {
    setTournaments(prev => ({...prev, [code]: t}));
    await db.upsertTournament(tournamentToDb(code, t));
  };

  const updateRankings = async (newRankings) => {
    setRankings(newRankings);
    await db.saveRankings(newRankings);
  };

  const isAdmin = currentUser?.role === "admin";
  const myLeagues = leagues.filter(l => l.members.includes(currentUser?.username));
  const activeLeague = leagues.find(l => l.code === activeLeagueCode) || null;
  const activeTournament = activeLeague ? (tournaments[activeLeague.code] || DEFAULT_TOURNAMENT) : null;
  const logout = () => { setCurrentUser(null); setPage("login"); setActiveLeagueCode(null); };

  if(loading) return <><style>{CSS}</style><div className="loading">Loading…</div></>;

  if(page === "login") return (
    <><style>{CSS}</style>
    <AuthPage users={users} setUsers={setUsers} authMode={authMode} setAuthMode={setAuthMode}
      onLogin={u => { setCurrentUser(u); setPage("standings"); }}
    /></>
  );

  return (
    <><style>{CSS}</style>
    <div style={{minHeight:"100vh", display:"flex", flexDirection:"column"}}>
      <Header user={currentUser} isAdmin={isAdmin} page={page} setPage={setPage} onLogout={logout}/>
      {dbError && (
        <div style={{background:"#7f1d1d", color:"#fca5a5", padding:"10px 20px", fontSize:13, textAlign:"center", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>⚠ Database error: {dbError}</span>
          <button onClick={() => setDbError("")} style={{background:"none", border:"none", color:"#fca5a5", cursor:"pointer", fontSize:18, lineHeight:1}}>×</button>
        </div>
      )}
      <main style={{flex:1, maxWidth:940, margin:"0 auto", width:"100%", padding:"24px 16px"}}>
        {page==="standings"   && <StandingsPage user={currentUser} leagues={leagues} saveLeagues={saveLeagues} updateLeagueInDb={updateLeagueInDb} picks={picks} tournaments={tournaments} rankings={rankings} activeLeagueCode={activeLeagueCode} setActiveLeagueCode={setActiveLeagueCode}/>}
        {page==="leaderboard" && <LeaderboardPage activeLeague={activeLeague} activeTournament={activeTournament} myLeagues={myLeagues} activeLeagueCode={activeLeagueCode} setActiveLeagueCode={setActiveLeagueCode}/>}
        {page==="rankings"    && <RankingsPage rankings={rankings}/>}
        {page==="picks"       && <MyPicksPage user={currentUser} leagues={leagues} saveLeagues={saveLeagues} updateLeagueInDb={updateLeagueInDb} picks={picks} savePicks={savePicks} tournaments={tournaments} rankings={rankings} activeLeagueCode={activeLeagueCode} setActiveLeagueCode={setActiveLeagueCode}/>}
        {page==="admin"       && isAdmin && <AdminPage users={users} setUsers={setUsers} leagues={leagues} saveLeagues={saveLeagues} tournaments={tournaments} updateTournament={updateTournament} rankings={rankings} updateRankings={updateRankings} picks={picks} currentUser={currentUser}/>}
      </main>
    </div></>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({user, isAdmin, page, setPage, onLogout}){
  const tabs = [
    {id:"standings",   label:"Standings"},
    {id:"leaderboard", label:"Leaderboard"},
    {id:"rankings",    label:"World Rankings"},
    {id:"picks",       label:"My Picks"},
    {id:"admin",       label:"Admin", adminOnly:true},
  ].filter(t => !t.adminOnly || isAdmin);

  return (
    <header style={{background:C.surface, borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:100}}>
      <div style={{maxWidth:940, margin:"0 auto", padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", height:60, gap:12}}>
        <span style={{fontFamily:"'Playfair Display',serif", fontWeight:900, fontSize:20, color:C.accent, flexShrink:0}}>⛳ Majors</span>
        <nav style={{display:"flex", gap:6, flexWrap:"wrap"}}>
          {tabs.map(t => (
            <button key={t.id} className={`nav-tab${page===t.id?" active":""}`} onClick={() => setPage(t.id)}>{t.label}</button>
          ))}
        </nav>
        <button className="btn-ghost" style={{padding:"6px 14px", fontSize:13, flexShrink:0}} onClick={onLogout}>
          {user?.username} · Sign out
        </button>
      </div>
    </header>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function AuthPage({users, setUsers, authMode, setAuthMode, onLogin}){
  const [form, setForm] = useState({username:"", password:"", confirm:""});
  const [err,  setErr]  = useState("");
  const [busy, setBusy] = useState(false);
  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const handle = async () => {
    setErr(""); setBusy(true);
    if(authMode === "login"){
      const u = users.find(u => u.username === form.username && u.password === form.password);
      if(!u){ setErr("Invalid username or password."); setBusy(false); return; }
      onLogin(u);
    } else {
      if(!form.username.trim() || !form.password){ setErr("All fields required."); setBusy(false); return; }
      if(form.password !== form.confirm){ setErr("Passwords don't match."); setBusy(false); return; }
      if(users.find(u => u.username === form.username)){ setErr("Username already taken."); setBusy(false); return; }
      const role = users.length === 0 ? "admin" : "member";
      const nu = {username: form.username.trim(), password: form.password, role};
      await db.createUser(nu);
      setUsers(prev => [...prev, nu]);
      onLogin(nu);
    }
    setBusy(false);
  };

  return (
    <div style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:`radial-gradient(ellipse at 50% 0%, #162116 0%, ${C.bg} 60%)`}}>
      <div style={{width:"100%", maxWidth:380}} className="fade">
        <div style={{textAlign:"center", marginBottom:40}}>
          <div style={{fontSize:52, marginBottom:10}}>⛳</div>
          <h1 style={{fontFamily:"'Playfair Display',serif", fontSize:32, fontWeight:900, color:"#f0fff0", letterSpacing:"-1px"}}>Majors Fantasy</h1>
          <p style={{color:C.muted, fontSize:14, marginTop:6}}>Pick your four, chase the glory</p>
        </div>
        <div className="card">
          {users.length===0 && authMode==="signup" && (
            <div style={{background:"#0c2744", border:"1px solid #1e4a7a", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#60a5fa"}}>
              You're the first user — you'll be granted admin access automatically.
            </div>
          )}
          <div style={{display:"flex", marginBottom:20, background:C.surface, borderRadius:8, padding:4}}>
            {["login","signup"].map(m => (
              <button key={m} onClick={() => setAuthMode(m)} style={{flex:1, padding:"8px", borderRadius:6, background:authMode===m?C.card:"transparent", color:authMode===m?"#f0fff0":C.muted, border:"none", fontWeight:authMode===m?600:400, fontSize:13, cursor:"pointer"}}>
                {m==="login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:12}}>
            <input placeholder="Username" value={form.username} onChange={f("username")} onKeyDown={e => e.key==="Enter" && handle()}/>
            <input type="password" placeholder="Password" value={form.password} onChange={f("password")} onKeyDown={e => e.key==="Enter" && handle()}/>
            {authMode==="signup" && <input type="password" placeholder="Confirm password" value={form.confirm} onChange={f("confirm")} onKeyDown={e => e.key==="Enter" && handle()}/>}
            {err && <p style={{color:C.danger, fontSize:13}}>{err}</p>}
            <button className="btn-primary" style={{width:"100%", marginTop:4}} onClick={handle} disabled={busy}>
              {busy ? "Please wait…" : authMode==="login" ? "Sign In" : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Join League Box ──────────────────────────────────────────────────────────
function JoinLeagueBox({user, leagues, saveLeagues, updateLeagueInDb, onJoined}){
  const [code, setCode] = useState("");
  const [err,  setErr]  = useState("");

  const join = async () => {
    setErr("");
    const l = leagues.find(l => l.code === code.toUpperCase().trim());
    if(!l){ setErr("League code not found. Check with your admin."); return; }
    if(l.members.includes(user.username)){ setErr("You're already in this league."); return; }
    const updated = {...l, members: [...l.members, user.username]};
    saveLeagues(leagues.map(x => x.code === l.code ? updated : x));
    await updateLeagueInDb(updated);
    onJoined(l.code);
  };

  return (
    <div style={{maxWidth:400, margin:"0 auto", textAlign:"center"}} className="fade">
      <div style={{fontSize:44, marginBottom:14}}>🏌️</div>
      <h3 style={{fontSize:18, fontWeight:700, color:"#f0fff0", marginBottom:8}}>Join a League</h3>
      <p style={{color:C.muted, fontSize:14, marginBottom:24, lineHeight:1.6}}>Enter the league code from your admin to get started.</p>
      <div style={{display:"flex", gap:10}}>
        <input placeholder="Enter league code e.g. ALPHA" value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key==="Enter" && join()} style={{textTransform:"uppercase", letterSpacing:"2px", fontWeight:600, textAlign:"center"}}/>
        <button className="btn-primary" style={{whiteSpace:"nowrap", flexShrink:0}} onClick={join}>Join</button>
      </div>
      {err && <p style={{color:C.danger, fontSize:13, marginTop:10}}>{err}</p>}
    </div>
  );
}

// ─── Standings Page ───────────────────────────────────────────────────────────
function StandingsPage({user, leagues, saveLeagues, updateLeagueInDb, picks, tournaments, rankings, activeLeagueCode, setActiveLeagueCode}){
  const myLeagues = leagues.filter(l => l.members.includes(user.username));
  const activeLeague = myLeagues.find(l => l.code === activeLeagueCode) || null;
  const tournament = activeLeague ? (tournaments[activeLeague.code] || DEFAULT_TOURNAMENT) : null;

  if(myLeagues.length === 0) return (
    <div className="fade">
      <div style={{marginBottom:28}}><div className="page-title">Standings</div></div>
      <JoinLeagueBox user={user} leagues={leagues} saveLeagues={saveLeagues} updateLeagueInDb={updateLeagueInDb} onJoined={setActiveLeagueCode}/>
    </div>
  );

  // field is the live ESPN snapshot — only meaningful during/after tournament
  const field   = tournament?.field || [];
  const cutLine = tournament?.cutLine;
  const members = activeLeague?.members || [];

  const scored = members.map(username => {
    const pickKey = `${activeLeague.code}:${username}`;
    const p = picks[pickKey];
    const {total, breakdown} = calcScore(p, field, cutLine);
    return {username, total, breakdown, picks:p};
  }).sort((a,b) => {
    if(a.total===null && b.total!==null) return 1;
    if(b.total===null && a.total!==null) return -1;
    if(a.total !== b.total) return (a.total||0) - (b.total||0);
    // Tiebreaker 1
    const ta = a.picks?.tiebreakers?.[0], tb = b.picks?.tiebreakers?.[0];
    if(ta && tb){
      const sa = getGolferScore(ta, field, cutLine).score;
      const sb = getGolferScore(tb, field, cutLine).score;
      if(sa !== null && sb !== null) return sa - sb;
    }
    return 0;
  });

  let rk = 1;
  const ranked = scored.map((p,i,arr) => {
    if(i > 0 && arr[i-1].total === p.total) return {...p, rank: arr[i-1].rank};
    const r = rk; rk = i+2; return {...p, rank:r};
  });

  return (
    <div className="fade">
      <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12}}>
        <div>
          <div className="page-title">Standings</div>
          <div className="page-sub">{activeLeague?.name} · {tournament?.name || "No tournament set up"}</div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"nowrap"}}>
          {myLeagues.length > 1 && (
            <select className="league-select" value={activeLeagueCode||""} onChange={e => setActiveLeagueCode(e.target.value)}>
              {myLeagues.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          )}
          <button className="btn-ghost" style={{fontSize:12, padding:"7px 12px", whiteSpace:"nowrap"}} onClick={() => window.alert(`League code: ${activeLeague?.code}`)}>Share Code</button>
        </div>
      </div>

      {!tournament?.name && (
        <div style={{background:"#3b2a00", border:`1px solid #92400e`, borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13, color:C.warning}}>
          No tournament configured for this league yet. Ask your admin to set one up.
        </div>
      )}
      {tournament?.name && field.length === 0 && (
        <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13, color:C.muted}}>
          Tournament hasn't started yet — scores will appear here once live data is fetched.
        </div>
      )}

      {ranked.length === 0
        ? <div className="empty-state"><p style={{color:C.muted}}>No picks submitted yet.</p></div>
        : <div style={{display:"flex", flexDirection:"column", gap:10}}>
            {ranked.map(p => <StandingsCard key={p.username} player={p} field={field} tournament={tournament} isCurrentUser={p.username===user.username}/>)}
          </div>
      }
      <div style={{marginTop:20, textAlign:"center"}}>
        <button className="btn-ghost" style={{fontSize:13}} onClick={async () => {
          const code = window.prompt("Enter a league code to join another league:");
          if(!code) return;
          const l = leagues.find(l => l.code === code.toUpperCase().trim());
          if(!l){ window.alert("League not found."); return; }
          if(l.members.includes(user.username)){ window.alert("You're already in this league."); return; }
          const updated = {...l, members:[...l.members, user.username]};
          saveLeagues(leagues.map(x => x.code===l.code ? updated : x));
          await updateLeagueInDb(updated);
          setActiveLeagueCode(l.code);
        }}>+ Join Another League</button>
      </div>
    </div>
  );
}

function StandingsCard({player, field, tournament, isCurrentUser}){
  const [open, setOpen] = useState(false);
  const has = player.picks?.mains?.length > 0;
  const medals = ["","🥇","🥈","🥉"];
  const cutLine = tournament?.cutLine;
  const hasLiveScores = field.length > 0;

  return (
    <div className="card" style={{cursor:"pointer", borderColor:open?C.accentDim:isCurrentUser?"#2a4a2a":C.border, transition:"border-color .2s"}} onClick={() => setOpen(o => !o)}>
      <div style={{display:"flex", alignItems:"center", gap:12}}>
        <div style={{width:32, height:32, borderRadius:"50%", background:player.rank<=3?"#1a2a0a":C.surface, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:player.rank<=3?18:13, color:player.rank<=3?C.accent:C.muted, flexShrink:0}}>
          {player.rank<=3 ? medals[player.rank] : player.rank}
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:600, fontSize:15, color:"#f0fff0", display:"flex", alignItems:"center", gap:8}}>
            {player.username}
            {isCurrentUser && <span className="badge b-blue">You</span>}
          </div>
          {has && <div style={{fontSize:12, color:C.muted, marginTop:2}}>{player.picks.mains.join(" · ")}</div>}
          {!has && <div style={{fontSize:12, color:C.muted}}>No picks submitted</div>}
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:22, fontWeight:700, color:has&&hasLiveScores?C.accent:C.muted, fontFamily:"'Playfair Display',serif"}}>
            {has && hasLiveScores && player.total !== null ? player.total : "–"}
          </div>
          <div style={{fontSize:11, color:C.muted}}>{hasLiveScores ? "total pos." : "awaiting"}</div>
        </div>
        <span style={{color:C.muted, fontSize:12, marginLeft:4}}>{open?"▲":"▼"}</span>
      </div>
      {open && has && (
        <div style={{marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:10}}>Picks & Positions</div>
          <div style={{display:"flex", flexWrap:"wrap", gap:8, marginBottom:10}}>
            {player.breakdown.map(b => (
              <div key={b.name} style={{display:"flex", alignItems:"center", gap:8, background:C.surface, border:`1px solid ${b.score>=(cutLine||65)&&!b.unmatched?C.danger:C.border}`, borderRadius:8, padding:"7px 12px", fontSize:13}}>
                <span style={{color:"#f0fff0"}}>{b.name}</span>
                <span style={{fontWeight:700, color:b.unmatched?C.warning:b.score>=(cutLine||65)?C.danger:C.accent}}>
                  {b.unmatched ? "?" : b.display.includes("MC") ? b.display : b.display !== "–" ? `#${b.display}` : "–"}
                </span>
              </div>
            ))}
          </div>
          {player.picks.tiebreakers?.length > 0 && (
            <><div style={{fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:8}}>Tiebreakers</div>
            <div style={{display:"flex", gap:8}}>
              {player.picks.tiebreakers.map((name,i) => (
                <div key={name} style={{display:"flex", alignItems:"center", gap:8, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"7px 12px", fontSize:13, opacity:.75}}>
                  <span style={{color:C.muted, fontSize:11}}>TB{i+1}</span>
                  <span style={{color:"#f0fff0"}}>{name}</span>
                </div>
              ))}
            </div></>
          )}
          {player.breakdown.some(b => b.unmatched) && (
            <p style={{fontSize:12, color:C.warning, marginTop:10}}>⚠ Players marked ? were not found in the live field — total score is withheld until all 4 are matched.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Leaderboard Page ─────────────────────────────────────────────────────────
function LeaderboardPage({activeLeague, activeTournament, myLeagues, activeLeagueCode, setActiveLeagueCode}){
  const [search, setSearch] = useState("");
  const tournament = activeTournament || DEFAULT_TOURNAMENT;
  const field = tournament.field || [];
  const hasField = field.length > 0;

  // Countdown to tournament start (date is YYYY-MM-DD, treat as 7am local)
  const countdown = useCountdown(tournament.date ? `${tournament.date}T07:00:00` : null);
  const isUpcoming = !hasField && tournament.status !== "complete";

  const sorted = [...field]
    .filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => { if(a.cut&&!b.cut)return 1; if(!a.cut&&b.cut)return -1; return (a.pos||999)-(b.pos||999); });

  if(myLeagues.length === 0) return (
    <div className="fade empty-state"><p style={{color:C.muted}}>Join a league first to see the leaderboard.</p></div>
  );

  return (
    <div className="fade">
      <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12}}>
        <div>
          <div className="page-title">Leaderboard</div>
          <div className="page-sub">
            {tournament.name || "No tournament active"}
            {hasField && ` · R${tournament.currentRound} of 4`}
          </div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"nowrap"}}>
          {myLeagues.length > 1 && (
            <select className="league-select" value={activeLeagueCode||""} onChange={e => setActiveLeagueCode(e.target.value)}>
              {myLeagues.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          )}
          {tournament.cutLine && <span className="badge b-amber" style={{whiteSpace:"nowrap"}}>Cut T{tournament.cutLine}</span>}
          {hasField && <input placeholder="Search golfer…" value={search} onChange={e => setSearch(e.target.value)} style={{width:160}}/>}
        </div>
      </div>

      {/* No tournament configured */}
      {!tournament.name && (
        <div className="empty-state">
          <div style={{fontSize:40, marginBottom:12}}>📋</div>
          <p style={{color:C.muted}}>No tournament configured for this league yet.</p>
        </div>
      )}

      {/* Pre-tournament countdown */}
      {tournament.name && isUpcoming && (
        <div style={{textAlign:"center", padding:"48px 24px"}}>
          <div style={{fontSize:48, marginBottom:16}}>⛳</div>
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, color:"#f0fff0", marginBottom:8}}>
            {tournament.name}
          </div>
          {tournament.course && <div style={{fontSize:14, color:C.muted, marginBottom:24}}>{tournament.course}</div>}
          {countdown ? (
            <div style={{display:"inline-block", background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 40px"}}>
              <div style={{fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"1px", marginBottom:8}}>Tournament starts in</div>
              <div style={{fontFamily:"'Playfair Display',serif", fontSize:40, fontWeight:700, color:C.accent, letterSpacing:"-1px"}}>{countdown}</div>
            </div>
          ) : (
            <p style={{color:C.muted, fontSize:14}}>Set a tournament date in Admin → Tournament Setup to see the countdown.</p>
          )}
          <div style={{marginTop:24, fontSize:13, color:C.muted}}>Leaderboard will appear here once live scores are fetched.</div>
        </div>
      )}

      {/* Live leaderboard */}
      {hasField && (
        <div className="card" style={{padding:0, overflow:"hidden"}}>
          <table>
            <thead>
              <tr><th style={{width:50}}>Pos</th><th>Golfer</th><th style={{width:80}}>Score</th><th style={{width:60}}>Thru</th><th style={{width:90}}>OWGR</th></tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={5} style={{textAlign:"center", color:C.muted, padding:28}}>No results for "{search}"</td></tr>
              )}
              {sorted.map(g => (
                <tr key={g.id}>
                  <td>{g.cut ? <span className="badge b-red">MC</span> : <span style={{fontWeight:700, color:g.pos<=3?C.gold:"#f0fff0"}}>{g.pos}</span>}</td>
                  <td style={{fontWeight:500, color:"#f0fff0"}}>
                    {g.name}
                    {isTop10(g.worldRank) && <span className="badge b-amber" style={{marginLeft:8}}>Top 10</span>}
                  </td>
                  <td style={{fontWeight:700, color:g.cut?C.muted:g.score<0?C.accent:g.score>0?C.danger:"#f0fff0"}}>
                    {g.cut ? "–" : g.score===0 ? "E" : g.score>0 ? `+${g.score}` : g.score}
                  </td>
                  <td style={{color:C.muted}}>{g.thru}</td>
                  <td style={{color:isTop10(g.worldRank)?C.gold:C.muted, fontWeight:isTop10(g.worldRank)?600:400}}>
                    {g.worldRank && g.worldRank < 999 ? `#${g.worldRank}` : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── World Rankings Page ──────────────────────────────────────────────────────
// Rankings come directly from the global rankings state (own Supabase table)
function RankingsPage({rankings}){
  const [search, setSearch] = useState("");
  const hasRankings = rankings.length > 0;
  const filtered = rankings.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const uploadedAt = rankings[0]?.uploaded_at
    ? new Date(rankings[0].uploaded_at).toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"})
    : null;

  return (
    <div className="fade">
      <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12}}>
        <div>
          <div className="page-title">World Rankings</div>
          <div className="page-sub">
            Official World Golf Ranking{uploadedAt ? ` · Uploaded ${uploadedAt}` : ""}
          </div>
        </div>
        {hasRankings && (
          <input placeholder="Search player…" value={search} onChange={e => setSearch(e.target.value)} style={{width:180}}/>
        )}
      </div>

      {!hasRankings && (
        <div style={{textAlign:"center", padding:"48px 24px"}}>
          <div style={{fontSize:40, marginBottom:16}}>📊</div>
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#f0fff0", marginBottom:8}}>Rankings not yet uploaded</div>
          <p style={{color:C.muted, fontSize:14, maxWidth:400, margin:"0 auto", lineHeight:1.65}}>
            Your admin needs to upload the OWGR CSV. Go to <strong style={{color:"#f0fff0"}}>owgr.com</strong>, download the rankings CSV, then upload it in <strong style={{color:"#f0fff0"}}>Admin → Live Data</strong>.
          </p>
        </div>
      )}

      {hasRankings && (
        <>
          <div style={{background:"#0c2744", border:"1px solid #1e4a7a", borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13, color:"#60a5fa", lineHeight:1.6}}>
            Players ranked <strong>1–10</strong> are flagged as Top 10. Each player may only include a maximum of <strong>2 top-10 ranked golfers</strong> in their main four picks.
          </div>
          <div className="card" style={{padding:0, overflow:"hidden"}}>
            <table>
              <thead>
                <tr><th style={{width:60}}>Rank</th><th>Player</th><th style={{width:110}}>Country</th><th style={{width:110}}>Avg Points</th><th style={{width:120}}>Pick Status</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{textAlign:"center", color:C.muted, padding:28}}>No results for "{search}"</td></tr>
                )}
                {filtered.map(r => (
                  <tr key={r.rank}>
                    <td><span style={{fontWeight:700, color:r.rank<=10?C.gold:"#f0fff0", fontSize:r.rank<=3?15:13}}>{r.rank<=3?["","🥇","🥈","🥉"][r.rank]:r.rank}</span></td>
                    <td style={{fontWeight:500, color:"#f0fff0"}}>{r.name}</td>
                    <td style={{color:C.muted}}>{r.country||"–"}</td>
                    <td style={{color:C.muted}}>{r.points}</td>
                    <td>{r.rank<=10 ? <span className="badge b-amber">Top 10 — limited</span> : <span className="badge b-gray">Unrestricted</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── My Picks Page ────────────────────────────────────────────────────────────
// Player list always comes from rankings table — never from the live field
function MyPicksPage({user, leagues, saveLeagues, updateLeagueInDb, picks, savePicks, tournaments, rankings, activeLeagueCode, setActiveLeagueCode}){
  const myLeagues = leagues.filter(l => l.members.includes(user.username));
  const activeLeague = myLeagues.find(l => l.code === activeLeagueCode) || null;
  const tournament = activeLeague ? (tournaments[activeLeague.code] || DEFAULT_TOURNAMENT) : null;
  const pickKey = activeLeague ? `${activeLeague.code}:${user.username}` : null;
  const myPicks = pickKey ? picks[pickKey] || {mains:[], tiebreakers:[]} : {mains:[], tiebreakers:[]};

  const [selected, setSelected] = useState(myPicks.mains || []);
  const [tbs,      setTbs]      = useState(myPicks.tiebreakers || []);
  const [search,   setSearch]   = useState("");
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    if(pickKey){
      const p = picks[pickKey] || {mains:[], tiebreakers:[]};
      setSelected(p.mains || []);
      setTbs(p.tiebreakers || []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeagueCode]);

  if(myLeagues.length === 0) return (
    <div className="fade">
      <div style={{marginBottom:28}}><div className="page-title">My Picks</div></div>
      <JoinLeagueBox user={user} leagues={leagues} saveLeagues={saveLeagues} updateLeagueInDb={updateLeagueInDb} onJoined={setActiveLeagueCode}/>
    </div>
  );

  const locked = tournament?.locked || false;
  const hasRankings = rankings.length > 0;

  // Player list: top 200 from global rankings table
  const playerPool = rankings
    .filter(r => r.rank <= 200)
    .map(r => ({name: r.name, worldRank: r.rank}));

  const top10Count = selected.filter(n => {
    const p = playerPool.find(r => r.name === n);
    return isTop10(p?.worldRank);
  }).length;

  const available = playerPool.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const canPickAsMain = name => {
    if(selected.includes(name)) return true;
    if(selected.length >= 4) return false;
    const p = playerPool.find(r => r.name === name);
    if(isTop10(p?.worldRank) && top10Count >= 2) return false;
    return true;
  };

  const toggleMain = name => {
    if(locked) return;
    if(selected.includes(name)){ setSelected(s => s.filter(x => x !== name)); return; }
    if(!canPickAsMain(name)) return;
    setSelected(s => [...s, name]);
  };

  const toggleTB = name => {
    if(locked || selected.includes(name)) return;
    if(tbs.includes(name)){ setTbs(t => t.filter(x => x !== name)); return; }
    if(tbs.length >= 2) return;
    setTbs(t => [...t, name]);
  };

  const handleSave = async () => {
    if(selected.length !== 4 || tbs.length !== 2) return;
    await savePicks({...picks, [pickKey]:{mains:selected, tiebreakers:tbs}});
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="fade">
      <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12}}>
        <div>
          <div className="page-title">My Picks</div>
          <div className="page-sub">{activeLeague?.name} · {tournament?.name || "No tournament yet"}</div>
        </div>
        {myLeagues.length > 1 && (
          <select className="league-select" value={activeLeagueCode||""} onChange={e => setActiveLeagueCode(e.target.value)}>
            {myLeagues.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        )}
      </div>

      {!tournament?.name && (
        <div style={{background:"#3b2a00", border:"1px solid #92400e", borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13, color:C.warning}}>
          No tournament set up for this league yet. Ask your admin to configure one.
        </div>
      )}
      {!hasRankings && (
        <div style={{background:"#3b2a00", border:"1px solid #92400e", borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13, color:C.warning}}>
          World rankings haven't been uploaded yet — ask your admin to upload the OWGR CSV before you can make picks.
        </div>
      )}
      {locked && (
        <div style={{background:"#451a03", border:"1px solid #92400e", borderRadius:10, padding:"12px 16px", marginBottom:20, display:"flex", alignItems:"center", gap:10}}>
          <span style={{fontSize:18}}>🔒</span>
          <span style={{color:C.gold, fontSize:14, fontWeight:500}}>Tournament has started — your picks are locked.</span>
        </div>
      )}

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20}}>
        <div className="card">
          <div style={{fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:8}}>Main Picks ({selected.length}/4)</div>
          <div style={{fontSize:12, color:C.muted, marginBottom:12}}>Top 10 world ranking: {top10Count}/2 used</div>
          {selected.length === 0 && <p style={{color:C.muted, fontSize:13}}>None selected yet</p>}
          <div style={{display:"flex", flexDirection:"column", gap:6}}>
            {selected.map(name => {
              const p = playerPool.find(r => r.name === name);
              return (
                <div key={name} style={{display:"flex", alignItems:"center", justifyContent:"space-between", background:C.surface, border:`1px solid ${isTop10(p?.worldRank)?C.gold:C.border}`, borderRadius:8, padding:"8px 12px", fontSize:13}}>
                  <span style={{color:"#f0fff0"}}>{name}{isTop10(p?.worldRank) && <span className="badge b-amber" style={{marginLeft:6}}>T10</span>}</span>
                  {!locked && <button style={{background:"none", border:"none", color:C.danger, cursor:"pointer", fontSize:18, lineHeight:1}} onClick={() => toggleMain(name)}>×</button>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div style={{fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:8}}>Tiebreakers ({tbs.length}/2)</div>
          <div style={{fontSize:12, color:C.muted, marginBottom:12}}>Used sequentially if scores are tied</div>
          {tbs.length === 0 && <p style={{color:C.muted, fontSize:13}}>None selected yet</p>}
          <div style={{display:"flex", flexDirection:"column", gap:6}}>
            {tbs.map((name,i) => (
              <div key={name} style={{display:"flex", alignItems:"center", justifyContent:"space-between", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", fontSize:13}}>
                <span style={{color:C.muted, fontSize:11, marginRight:8}}>TB{i+1}</span>
                <span style={{color:"#f0fff0", flex:1}}>{name}</span>
                {!locked && <button style={{background:"none", border:"none", color:C.danger, cursor:"pointer", fontSize:18, lineHeight:1}} onClick={() => toggleTB(name)}>×</button>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {hasRankings && !locked && (
        <>
          <div style={{display:"flex", gap:10, marginBottom:14, alignItems:"center", flexWrap:"wrap"}}>
            <input placeholder="Search player…" value={search} onChange={e => setSearch(e.target.value)} style={{maxWidth:260}}/>
            <span style={{fontSize:13, color:C.muted}}>Click a player to add as main pick · hold to add as tiebreaker</span>
          </div>
          <div className="card" style={{padding:0, overflow:"hidden", maxHeight:420, overflowY:"auto"}}>
            <table>
              <thead><tr><th style={{width:55}}>Rank</th><th>Player</th><th style={{width:110}}>Country</th><th style={{width:130}}>Action</th></tr></thead>
              <tbody>
                {available.map(p => {
                  const inMain = selected.includes(p.name);
                  const inTB   = tbs.includes(p.name);
                  const canMain = canPickAsMain(p.name);
                  const canTB  = !inMain && !inTB && tbs.length < 2;
                  return (
                    <tr key={p.name} style={{opacity: (!canMain && !inMain && !canTB) ? .4 : 1}}>
                      <td><span style={{fontWeight:700, color:isTop10(p.worldRank)?C.gold:"#f0fff0"}}>{p.worldRank}</span></td>
                      <td style={{fontWeight:500, color:"#f0fff0"}}>
                        {p.name}
                        {isTop10(p.worldRank) && <span className="badge b-amber" style={{marginLeft:6}}>T10</span>}
                      </td>
                      <td style={{color:C.muted}}>{rankings.find(r=>r.name===p.name)?.country||"–"}</td>
                      <td>
                        <div style={{display:"flex", gap:6}}>
                          <button
                            style={{background: inMain?"#7f1d1d":canMain?"#14532d":C.surface, color: inMain?C.danger:canMain?C.accent:C.muted, border:"none", borderRadius:6, padding:"4px 10px", fontSize:12, cursor:canMain||inMain?"pointer":"default"}}
                            onClick={() => toggleMain(p.name)}
                          >{inMain ? "Remove" : "Pick"}</button>
                          <button
                            style={{background: inTB?"#451a03":canTB?C.card:C.surface, color: inTB?C.gold:canTB?"#f0fff0":C.muted, border:`1px solid ${inTB?"#92400e":C.border}`, borderRadius:6, padding:"4px 10px", fontSize:12, cursor:canTB||inTB?"pointer":"default"}}
                            onClick={() => toggleTB(p.name)}
                          >{inTB ? "Remove TB" : "Tiebreaker"}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {hasRankings && !locked && (
        <div style={{marginTop:20, display:"flex", alignItems:"center", gap:14}}>
          <button className="btn-primary" onClick={handleSave} disabled={selected.length!==4||tbs.length!==2}>
            {saved ? "✓ Picks saved!" : "Save My Picks"}
          </button>
          {(selected.length!==4||tbs.length!==2) && (
            <span style={{fontSize:13, color:C.muted}}>Select 4 main picks and 2 tiebreakers to save.</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
function AdminPage({users, setUsers, leagues, saveLeagues, tournaments, updateTournament, rankings, updateRankings, picks, currentUser}){
  const [tab, setTab] = useState("leagues");
  const [selectedLeagueCode, setSelectedLeagueCode] = useState(leagues[0]?.code || "");
  const selectedLeague = leagues.find(l => l.code === selectedLeagueCode) || null;
  const selectedTournament = selectedLeague ? (tournaments[selectedLeague.code] || DEFAULT_TOURNAMENT) : null;
  const tabs = [{id:"leagues",label:"Leagues"},{id:"tournament",label:"Tournament Setup"},{id:"livedata",label:"Live Data & Rankings"},{id:"users",label:"Users"}];

  return (
    <div className="fade">
      <div style={{marginBottom:24}}>
        <div className="page-title">Admin Panel</div>
        <div className="page-sub">Manage leagues, tournaments, and data</div>
      </div>
      <div style={{display:"flex", gap:4, marginBottom:28, background:C.surface, borderRadius:10, padding:4, width:"fit-content", flexWrap:"wrap"}}>
        {tabs.map(t => (
          <button key={t.id} className={`admin-subtab${tab===t.id?" active":""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab==="leagues" && <LeaguesTab leagues={leagues} saveLeagues={saveLeagues} selectedLeagueCode={selectedLeagueCode} setSelectedLeagueCode={setSelectedLeagueCode} picks={picks} tournaments={tournaments} creatorUsername={currentUser?.username||""}/>}
      {(tab==="tournament"||tab==="livedata") && (
        leagues.length===0
          ? <div className="empty-state"><p style={{color:C.muted}}>Create a league first.</p></div>
          : <>
              <div style={{marginBottom:20}}>
                <label className="form-label">Managing league:</label>
                <select className="league-select" value={selectedLeagueCode||""} onChange={e => setSelectedLeagueCode(e.target.value)}>
                  {leagues.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>
              {tab==="tournament" && selectedLeague && <TournamentSetup league={selectedLeague} tournament={selectedTournament||DEFAULT_TOURNAMENT} onSave={async t => { await updateTournament(selectedLeague.code, t); }}/>}
              {tab==="livedata"   && selectedLeague && <LiveDataPanel league={selectedLeague} tournament={selectedTournament||DEFAULT_TOURNAMENT} rankings={rankings} onSaveTournament={async t => { await updateTournament(selectedLeague.code, t); }} onSaveRankings={async r => { await updateRankings(r); }}/>}
            </>
      )}
      {tab==="users" && <UsersTab users={users} setUsers={setUsers} leagues={leagues}/>}
    </div>
  );
}

// ─── Leagues Tab ──────────────────────────────────────────────────────────────
function LeaguesTab({leagues, saveLeagues, selectedLeagueCode, setSelectedLeagueCode, picks, tournaments, creatorUsername}){
  const [name,    setName]    = useState("");
  const [created, setCreated] = useState(null);

  const create = async () => {
    if(!name.trim()) return;
    const code = genCode();
    const l = {name: name.trim(), code, members:[creatorUsername]};
    await db.createLeague(l);
    saveLeagues([...leagues, l]);
    setSelectedLeagueCode(code);
    setName(""); setCreated(code);
    setTimeout(() => setCreated(null), 5000);
  };

  const deleteLeague = async code => {
    if(!window.confirm("Delete this league? This cannot be undone.")) return;
    await db.deleteLeague(code);
    saveLeagues(leagues.filter(l => l.code !== code));
  };

  return (
    <div>
      <div className="card" style={{marginBottom:20}}>
        <div style={{fontWeight:600, color:"#f0fff0", marginBottom:14}}>Create New League</div>
        <div style={{display:"flex", gap:10}}>
          <input placeholder="League name e.g. The Lads" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key==="Enter" && create()} style={{maxWidth:320}}/>
          <button className="btn-primary" style={{whiteSpace:"nowrap", flexShrink:0}} onClick={create} disabled={!name.trim()}>Create League</button>
        </div>
        {created && (
          <div style={{marginTop:14, padding:"12px 14px", background:"#0c2744", border:"1px solid #1e4a7a", borderRadius:8, display:"flex", alignItems:"center", gap:12}}>
            <span style={{fontSize:13, color:"#60a5fa"}}>League created! Share this code:</span>
            <span className="code-pill">{created}</span>
          </div>
        )}
      </div>
      {leagues.length === 0
        ? <div className="empty-state"><p style={{color:C.muted}}>No leagues yet. Create one above.</p></div>
        : <div style={{display:"flex", flexDirection:"column", gap:10}}>
            {leagues.map(l => {
              const t = tournaments[l.code] || DEFAULT_TOURNAMENT;
              const memberPicks = l.members.filter(m => picks[`${l.code}:${m}`]?.mains?.length > 0);
              return (
                <div key={l.code} className="card">
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10}}>
                    <div>
                      <div style={{fontWeight:600, fontSize:15, color:"#f0fff0", marginBottom:4, display:"flex", alignItems:"center", gap:10}}>
                        {l.name} <span className="code-pill">{l.code}</span>
                        {t.locked ? <span className="badge b-red">🔒 Locked</span> : t.name ? <span className="badge b-green">🔓 Open</span> : null}
                      </div>
                      <div style={{fontSize:13, color:C.muted, display:"flex", gap:16, flexWrap:"wrap"}}>
                        <span>{l.members.length} member{l.members.length!==1?"s":""}</span>
                        <span>{memberPicks.length}/{l.members.length} picks submitted</span>
                        <span>{t.name||"No tournament"}</span>
                      </div>
                    </div>
                    <div style={{display:"flex", gap:8}}>
                      <button className="btn-ghost" style={{fontSize:12, padding:"6px 12px"}} onClick={() => { navigator.clipboard?.writeText(l.code); window.alert(`Code copied: ${l.code}`); }}>Copy Code</button>
                      <button style={{background:"#7f1d1d", color:C.danger, border:"1px solid #991b1b", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer"}} onClick={() => deleteLeague(l.code)}>Delete</button>
                    </div>
                  </div>
                  {l.members.length > 0 && <div style={{marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}`, fontSize:12, color:C.muted}}>Members: {l.members.join(", ")}</div>}
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ─── Tournament Setup ─────────────────────────────────────────────────────────
function TournamentSetup({league, tournament, onSave}){
  const [form, setForm] = useState({
    majorId: tournament.majorId||"", course: tournament.course||"",
    date: tournament.date||"", status: tournament.status||"upcoming",
    currentRound: tournament.currentRound||1, cutLine: tournament.cutLine??""
  });
  const [locked,  setLocked]  = useState(tournament.locked||false);
  const [saved,   setSaved]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));
  const selectedMajor = MAJORS.find(m => m.id === form.majorId);

  const save = async () => {
    setSaving(true); setSaveErr("");
    try {
      await onSave({
        ...tournament, ...form,
        name: selectedMajor?.name || tournament.name,
        cutLine: form.cutLine === "" ? null : parseInt(form.cutLine),
        currentRound: parseInt(form.currentRound),
        locked,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch(e) {
      setSaveErr(e.message);
    }
    setSaving(false);
  };

  return (
    <div>
      <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", marginBottom:20, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <span style={{fontSize:13, color:C.muted}}>League:</span>
        <span style={{fontWeight:600, color:"#f0fff0"}}>{league.name}</span>
        <span className="code-pill">{league.code}</span>
        <span style={{marginLeft:"auto"}} className={`badge ${locked?"b-red":"b-green"}`}>{locked?"🔒 Picks locked":"🔓 Picks open"}</span>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:18, marginBottom:20}}>
        <div>
          <label className="form-label">Select Major</label>
          <select value={form.majorId} onChange={f("majorId")}>
            <option value="">— Choose a major —</option>
            {MAJORS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {selectedMajor && <p style={{fontSize:12, color:C.muted, marginTop:5}}>Default course: {selectedMajor.course}</p>}
        </div>
        <div><label className="form-label">Start Date</label><input type="date" value={form.date} onChange={f("date")}/></div>
        <div><label className="form-label">Course Name (optional override)</label><input placeholder={selectedMajor?.course||"Course name"} value={form.course} onChange={f("course")}/></div>
        <div>
          <label className="form-label">Status</label>
          <select value={form.status} onChange={f("status")}>
            <option value="upcoming">Upcoming</option>
            <option value="in_progress">In Progress</option>
            <option value="complete">Complete</option>
          </select>
        </div>
        <div>
          <label className="form-label">Current Round</label>
          <select value={form.currentRound} onChange={f("currentRound")}>
            {[1,2,3,4].map(r => <option key={r} value={r}>Round {r}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Cut Line <span style={{fontWeight:400, fontSize:11}}>(enter after cut Friday)</span></label>
          <input type="number" placeholder="e.g. 65 → missed cut = T65" value={form.cutLine} onChange={f("cutLine")} min={1} max={200}/>
          {form.cutLine && <p style={{fontSize:12, color:C.muted, marginTop:5}}>Missed-cut golfers score T{form.cutLine}</p>}
        </div>
      </div>
      <div style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 20px", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16}}>
        <div>
          <div style={{fontWeight:600, fontSize:14, color:"#f0fff0", marginBottom:4}}>Lock Player Picks</div>
          <div style={{fontSize:13, color:C.muted}}>Flip before the first tee shot Thursday. Players cannot change picks once locked.</div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:10, cursor:"pointer"}} onClick={() => setLocked(o => !o)}>
          <div className={`toggle-track${locked?" on":""}`}><div className="toggle-thumb"/></div>
          <span style={{fontSize:13, fontWeight:600, color:locked?C.accent:C.muted}}>{locked?"Locked":"Open"}</span>
        </div>
      </div>
      <div style={{display:"flex", alignItems:"center", gap:14, flexWrap:"wrap"}}>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Tournament Settings"}
        </button>
        {saveErr && <span style={{color:"#f87171", fontSize:13}}>⚠ {saveErr}</span>}
      </div>
    </div>
  );
}

// ─── Live Data & Rankings Panel ───────────────────────────────────────────────
function LiveDataPanel({league, tournament, rankings, onSaveTournament, onSaveRankings}){
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreMsg,     setScoreMsg]     = useState("");
  const [scoreError,   setScoreError]   = useState("");
  const [csvLoading,   setCsvLoading]   = useState(false);
  const [csvMsg,       setCsvMsg]       = useState("");
  const [csvError,     setCsvError]     = useState("");

  // Fetch live scores from ESPN
  const fetchScores = async () => {
    if(!tournament.majorId){ setScoreError("Select a major in Tournament Setup first."); return; }
    setScoreLoading(true); setScoreError(""); setScoreMsg("");
    try {
      const field = await fetchLiveData(tournament.majorId, rankings);
      await onSaveTournament({...tournament, field, lastUpdated: new Date().toISOString()});
      const top10inField = field.filter(p => p.worldRank <= 10).length;
      setScoreMsg(`✓ ${field.length} golfers loaded. ${top10inField} world top-10 players in field.`);
    } catch(e){ setScoreError(`Failed: ${e.message}`); }
    setScoreLoading(false);
  };

  // Upload OWGR CSV → save to rankings table
  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    setCsvLoading(true); setCsvError(""); setCsvMsg("");
    try {
      const text = await file.text();
      const parsed = parseOwgrCsv(text);
      await onSaveRankings(parsed);
      const top10 = parsed.filter(r => r.rank <= 10);
      setCsvMsg(`✓ ${parsed.length} players saved. Top 10: ${top10.map(r => r.name.split(" ").pop()).join(", ")}`);
      // If we have a live field, re-apply fresh rankings to it
      if(tournament.field?.length > 0){
        const updatedField = applyRankings(tournament.field, parsed);
        await onSaveTournament({...tournament, field: updatedField});
      }
    } catch(e){ setCsvError(`Failed: ${e.message}`); }
    setCsvLoading(false);
    e.target.value = "";
  };

  const rankingsUploadedAt = rankings[0]?.uploaded_at
    ? new Date(rankings[0].uploaded_at).toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"})
    : null;

  const stats = [
    {label:"Tournament",    value: tournament.name || "Not set"},
    {label:"Live field",    value: tournament.field?.length ? `${tournament.field.length} players` : "Not fetched"},
    {label:"Rankings",      value: rankings.length ? `${rankings.length} players` : "Not uploaded"},
    {label:"Last score fetch", value: tournament.lastUpdated ? new Date(tournament.lastUpdated).toLocaleTimeString() : "Never"},
  ];

  return (
    <div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20}}>
        {stats.map(s => (
          <div key={s.label} style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px"}}>
            <div style={{fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".6px", marginBottom:6}}>{s.label}</div>
            <div style={{fontSize:14, fontWeight:600, color:C.accent}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* OWGR rankings upload */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontWeight:600, color:"#f0fff0", marginBottom:6}}>
          Upload World Rankings (OWGR)
          {rankingsUploadedAt && <span style={{fontWeight:400, fontSize:12, color:C.muted, marginLeft:10}}>Last uploaded: {rankingsUploadedAt}</span>}
        </div>
        <p style={{fontSize:13, color:C.muted, marginBottom:10, lineHeight:1.65}}>
          Upload once before each major. Rankings are saved to their own table and shared across all leagues.
          Download from <strong style={{color:"#f0fff0"}}>owgr.com</strong> → Rankings → Download CSV. Updated every Monday.
        </p>
        {csvMsg   && <p style={{color:C.accent,  fontSize:13, marginBottom:10}}>✓ {csvMsg}</p>}
        {csvError && <p style={{color:C.danger,  fontSize:13, marginBottom:10}}>⚠ {csvError}</p>}
        <label style={{display:"inline-block", cursor: csvLoading?"not-allowed":"pointer", background:C.card, color:"#f0fff0", padding:"10px 18px", borderRadius:8, border:`1px solid #4a6a4a`, fontSize:14, fontWeight:500, opacity: csvLoading?0.5:1}}>
          {csvLoading ? "Processing…" : "📂 Choose OWGR CSV file"}
          <input type="file" accept=".csv" style={{display:"none"}} onChange={handleCsvUpload} disabled={csvLoading}/>
        </label>
      </div>

      {/* Live scores */}
      <div className="card">
        <div style={{fontWeight:600, color:"#f0fff0", marginBottom:6}}>Fetch Live Scores</div>
        <p style={{fontSize:13, color:C.muted, marginBottom:14, lineHeight:1.65}}>
          Pulls the live leaderboard from <strong style={{color:"#f0fff0"}}>ESPN</strong> — no API key needed.
          World rankings are cross-referenced automatically. Fetch manually every 30 mins during the tournament.
          The ESPN endpoint only goes live once the tournament has started.
        </p>
        {scoreMsg   && <p style={{color:C.accent,  fontSize:13, marginBottom:10}}>✓ {scoreMsg}</p>}
        {scoreError && <p style={{color:C.danger,  fontSize:13, marginBottom:10}}>⚠ {scoreError}</p>}
        <button className="btn-primary" onClick={fetchScores} disabled={scoreLoading}>
          {scoreLoading ? "Fetching…" : "Fetch Live Scores"}
        </button>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab({users, setUsers, leagues}){
  const promote = async username => {
    if(!window.confirm(`Promote ${username} to admin?`)) return;
    await db.updateUser(username, {role:"admin"});
    setUsers(users.map(u => u.username===username ? {...u, role:"admin"} : u));
  };
  const demote = async username => {
    const admins = users.filter(u => u.role==="admin");
    if(admins.length <= 1){ window.alert("Cannot remove the last admin."); return; }
    if(!window.confirm(`Remove admin from ${username}?`)) return;
    await db.updateUser(username, {role:"member"});
    setUsers(users.map(u => u.username===username ? {...u, role:"member"} : u));
  };
  const getUserLeagues = username => leagues.filter(l => l.members.includes(username)).map(l => l.name).join(", ") || "None";

  return (
    <div>
      <div style={{background:"#0c2744", border:"1px solid #1e4a7a", borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13, color:"#60a5fa", lineHeight:1.6}}>
        The first account created is automatically admin. Promote others here. At least one admin must always exist.
      </div>
      <div className="card" style={{padding:0, overflow:"hidden"}}>
        <table>
          <thead><tr><th>Username</th><th>Role</th><th>Leagues</th><th style={{width:130}}>Actions</th></tr></thead>
          <tbody>
            {users.length===0 && <tr><td colSpan={4} style={{textAlign:"center", color:C.muted, padding:28}}>No users yet.</td></tr>}
            {users.map(u => (
              <tr key={u.username}>
                <td style={{fontWeight:500, color:"#f0fff0"}}>{u.username}</td>
                <td>{u.role==="admin" ? <span className="badge b-amber">Admin</span> : <span className="badge b-gray">Member</span>}</td>
                <td style={{fontSize:12, color:C.muted}}>{getUserLeagues(u.username)}</td>
                <td>
                  {u.role==="admin"
                    ? <button style={{background:"#451a03", color:C.gold, border:"1px solid #92400e", borderRadius:6, padding:"4px 12px", fontSize:12, cursor:"pointer"}} onClick={() => demote(u.username)}>Remove Admin</button>
                    : <button style={{background:"#14532d", color:C.accent, border:"1px solid #166534", borderRadius:6, padding:"4px 12px", fontSize:12, cursor:"pointer"}} onClick={() => promote(u.username)}>Make Admin</button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
