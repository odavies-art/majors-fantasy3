import { useState, useEffect, useRef } from "react";

// ─── Storage ──────────────────────────────────────────────────────────────────
const SK = { USERS:"mf3_users", PICKS:"mf3_picks", LEAGUES:"mf3_leagues", TOURNAMENTS:"mf3_tournaments" };
const gs = (k,fb) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):fb; } catch { return fb; } };
const ss = (k,v)  => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} };

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_FIELD = [
  {id:1, name:"Scottie Scheffler", worldRank:1, pos:1, score:-18,thru:"F",cut:false},
  {id:2, name:"Rory McIlroy",      worldRank:2, pos:2, score:-14,thru:"F",cut:false},
  {id:3, name:"Xander Schauffele", worldRank:3, pos:3, score:-13,thru:"F",cut:false},
  {id:4, name:"Collin Morikawa",   worldRank:4, pos:4, score:-12,thru:"F",cut:false},
  {id:5, name:"Viktor Hovland",    worldRank:5, pos:5, score:-11,thru:"F",cut:false},
  {id:6, name:"Patrick Cantlay",   worldRank:6, pos:6, score:-10,thru:"F",cut:false},
  {id:7, name:"Wyndham Clark",     worldRank:7, pos:7, score:-9, thru:"F",cut:false},
  {id:8, name:"Jon Rahm",          worldRank:8, pos:8, score:-8, thru:"F",cut:false},
  {id:9, name:"Brian Harman",      worldRank:9, pos:9, score:-7, thru:"F",cut:false},
  {id:10,name:"Ludvig Åberg",      worldRank:10,pos:10,score:-6, thru:"F",cut:false},
  {id:11,name:"Tony Finau",        worldRank:15,pos:11,score:-5, thru:"F",cut:false},
  {id:12,name:"Shane Lowry",       worldRank:18,pos:12,score:-5, thru:"F",cut:false},
  {id:13,name:"Tommy Fleetwood",   worldRank:14,pos:13,score:-4, thru:"F",cut:false},
  {id:14,name:"Justin Thomas",     worldRank:20,pos:14,score:-4, thru:"F",cut:false},
  {id:15,name:"Max Homa",          worldRank:12,pos:15,score:-3, thru:"F",cut:false},
  {id:16,name:"Russell Henley",    worldRank:22,pos:16,score:-3, thru:"F",cut:false},
  {id:17,name:"Adam Scott",        worldRank:30,pos:17,score:-2, thru:"F",cut:false},
  {id:18,name:"Hideki Matsuyama",  worldRank:16,pos:18,score:-2, thru:"F",cut:false},
  {id:19,name:"Matt Fitzpatrick",  worldRank:11,pos:19,score:-1, thru:"F",cut:false},
  {id:20,name:"Cameron Young",     worldRank:25,pos:20,score:-1, thru:"F",cut:false},
  {id:21,name:"Sahith Theegala",   worldRank:19,pos:21,score:0,  thru:"F",cut:false},
  {id:22,name:"Tom Kim",           worldRank:23,pos:22,score:0,  thru:"F",cut:false},
  {id:23,name:"Keegan Bradley",    worldRank:35,pos:23,score:1,  thru:"F",cut:false},
  {id:24,name:"Jordan Spieth",     worldRank:28,pos:24,score:1,  thru:"F",cut:false},
  {id:25,name:"Billy Horschel",    worldRank:40,pos:25,score:2,  thru:"F",cut:false},
  {id:26,name:"Sungjae Im",        worldRank:32,pos:27,score:3,  thru:"F",cut:false},
  {id:27,name:"Sepp Straka",       worldRank:38,pos:28,score:3,  thru:"F",cut:false},
  {id:28,name:"Jason Day",         worldRank:60,pos:32,score:5,  thru:"F",cut:false},
  {id:29,name:"Harris English",    worldRank:65,pos:33,score:6,  thru:"F",cut:false},
  {id:30,name:"Phil Mickelson",    worldRank:110,pos:43,score:11,thru:"F",cut:false},
  {id:31,name:"Tiger Woods",       worldRank:120,pos:45,score:12,thru:"F",cut:false},
  {id:32,name:"Rickie Fowler",     worldRank:55,pos:44,score:11, thru:"F",cut:false},
  {id:33,name:"Ernie Els",         worldRank:300,pos:null,score:999,thru:"MC",cut:true},
  {id:34,name:"Vijay Singh",       worldRank:400,pos:null,score:999,thru:"MC",cut:true},
  {id:35,name:"Lee Westwood",      worldRank:350,pos:null,score:999,thru:"MC",cut:true},
];

const MOCK_RANKINGS = [
  {rank:1, name:"Scottie Scheffler",  country:"USA",   points:"24.15"},
  {rank:2, name:"Rory McIlroy",       country:"NIR",   points:"13.82"},
  {rank:3, name:"Xander Schauffele",  country:"USA",   points:"12.44"},
  {rank:4, name:"Collin Morikawa",    country:"USA",   points:"11.98"},
  {rank:5, name:"Viktor Hovland",     country:"NOR",   points:"11.23"},
  {rank:6, name:"Patrick Cantlay",    country:"USA",   points:"10.67"},
  {rank:7, name:"Wyndham Clark",      country:"USA",   points:"9.88"},
  {rank:8, name:"Jon Rahm",           country:"ESP",   points:"9.54"},
  {rank:9, name:"Brian Harman",       country:"USA",   points:"9.01"},
  {rank:10,name:"Ludvig Åberg",       country:"SWE",   points:"8.77"},
  {rank:11,name:"Matt Fitzpatrick",   country:"ENG",   points:"8.33"},
  {rank:12,name:"Max Homa",           country:"USA",   points:"8.12"},
  {rank:13,name:"Tommy Fleetwood",    country:"ENG",   points:"7.95"},
  {rank:14,name:"Tony Finau",         country:"USA",   points:"7.66"},
  {rank:15,name:"Shane Lowry",        country:"IRL",   points:"7.44"},
  {rank:16,name:"Hideki Matsuyama",   country:"JPN",   points:"7.21"},
  {rank:17,name:"Justin Thomas",      country:"USA",   points:"7.05"},
  {rank:18,name:"Sahith Theegala",    country:"USA",   points:"6.88"},
  {rank:19,name:"Tom Kim",            country:"KOR",   points:"6.71"},
  {rank:20,name:"Cameron Young",      country:"USA",   points:"6.55"},
  {rank:21,name:"Russell Henley",     country:"USA",   points:"6.40"},
  {rank:22,name:"Adam Scott",         country:"AUS",   points:"6.25"},
  {rank:23,name:"Jordan Spieth",      country:"USA",   points:"6.10"},
  {rank:24,name:"Sungjae Im",         country:"KOR",   points:"5.95"},
  {rank:25,name:"Sepp Straka",        country:"AUT",   points:"5.80"},
  {rank:26,name:"Keegan Bradley",     country:"USA",   points:"5.65"},
  {rank:27,name:"Billy Horschel",     country:"USA",   points:"5.50"},
  {rank:28,name:"Jason Day",          country:"AUS",   points:"5.35"},
  {rank:29,name:"Rickie Fowler",      country:"USA",   points:"5.20"},
  {rank:30,name:"Harris English",     country:"USA",   points:"5.05"},
];

const MAJORS = [
  {id:"masters",  name:"The Masters",           course:"Augusta National Golf Club"},
  {id:"pga",      name:"PGA Championship",       course:"TBD"},
  {id:"us_open",  name:"US Open",                course:"TBD"},
  {id:"open",     name:"The Open Championship",  course:"TBD"},
];

const DEFAULT_TOURNAMENT = {
  majorId:"",name:"",course:"",date:"",status:"upcoming",
  currentRound:1,cutLine:null,locked:false,apiKey:"",usingMock:true,lastUpdated:null,
  field:MOCK_FIELD,rankings:MOCK_RANKINGS,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genCode() {
  return Math.random().toString(36).substring(2,7).toUpperCase();
}
function isTop10(r){ return r&&r<=10; }
function getGolferScore(name,field,cutLine){
  const g=field.find(f=>f.name===name);
  if(!g) return {pos:null,score:0,display:"–"};
  if(g.cut){const p=cutLine||65;return{pos:p,score:p,display:`MC (T${p})`};}
  return{pos:g.pos,score:g.pos||0,display:g.pos?`${g.pos}`:"–"};
}
function calcScore(picks,field,cutLine){
  if(!picks?.mains?.length) return{total:null,breakdown:[]};
  const breakdown=picks.mains.map(name=>({name,...getGolferScore(name,field,cutLine)}));
  const total=breakdown.reduce((s,b)=>s+(b.score||0),0);
  return{total,breakdown};
}
async function fetchLiveData(apiKey,majorId){
  const res=await fetch(`https://golf-leaderboard-data.p.rapidapi.com/leaderboard/${majorId}`,{
    headers:{"X-RapidAPI-Key":apiKey,"X-RapidAPI-Host":"golf-leaderboard-data.p.rapidapi.com"},
  });
  if(!res.ok) throw new Error(`API ${res.status}`);
  const data=await res.json();
  return(data?.results?.leaderboard||[]).map((p,i)=>({
    id:p.player_id||i, name:`${p.first_name} ${p.last_name}`,
    worldRank:p.world_ranking||999, pos:p.position?parseInt(p.position):null,
    score:p.total_to_par||0, thru:p.thru||"–", cut:p.status==="cut",
  }));
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const C={
  bg:"#0d1a0d",surface:"#132013",card:"#192619",border:"#2a3d2a",
  accent:"#4ade80",accentDim:"#22c55e",gold:"#f59e0b",
  text:"#e8f5e8",muted:"#6b8f6b",danger:"#f87171",warning:"#fbbf24",
  navActive:"#4ade80",navText:"#f0fff0",navBg:"#1f3020",navBorder:"#4a6a4a",
};

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:${C.bg};color:${C.text};font-family:'DM Sans',sans-serif;min-height:100vh;}
input,select{background:${C.card};border:1px solid ${C.border};color:${C.text};padding:10px 14px;border-radius:8px;font-family:inherit;font-size:14px;width:100%;outline:none;transition:border .2s;}
input:focus,select:focus{border-color:${C.accentDim};}
input::placeholder{color:${C.muted};}
button{cursor:pointer;font-family:inherit;border:none;border-radius:8px;font-size:14px;font-weight:500;transition:all .15s;}
::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:${C.bg};}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}

.nav-tab{
  background:${C.navBg};
  color:${C.navText};
  padding:8px 18px;
  border-radius:20px;
  font-size:13px;
  font-weight:600;
  border:1px solid ${C.navBorder};
  transition:all .15s;
}
.nav-tab:hover{ background:#2a4a2a; border-color:#5a8a5a; }
.nav-tab.active{ background:${C.accent}; color:#061006; border-color:${C.accent}; }

.btn-primary{background:${C.accent};color:#061006;padding:11px 22px;font-weight:600;}
.btn-primary:hover:not(:disabled){background:#6ee7a0;}
.btn-primary:disabled{opacity:.35;cursor:not-allowed;}
.btn-secondary{background:${C.card};color:${C.text};padding:10px 18px;border:1px solid ${C.border};}
.btn-secondary:hover{border-color:${C.accentDim};}
.btn-ghost{background:transparent;color:${C.muted};padding:8px 14px;border:1px solid ${C.border};}
.btn-ghost:hover{color:${C.text};border-color:#3d5a3d;}

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

.page-title{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:${C.text};}
.page-sub{color:${C.muted};font-size:13px;margin-top:4px;}
.fade{animation:fi .25s ease;}
@keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}

.league-tab{
  padding:7px 16px;border-radius:16px;font-size:13px;font-weight:500;
  background:${C.surface};color:${C.navText};border:1px solid ${C.border};
  cursor:pointer;transition:all .15s;white-space:nowrap;
}
.league-tab:hover{background:${C.card};color:${C.text};}
.league-tab.active{background:#0c2744;color:#60a5fa;border-color:#1e4a7a;}

.toggle-track{width:44px;height:24px;border-radius:12px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0;}
.toggle-thumb{width:18px;height:18px;background:#fff;border-radius:50%;position:absolute;top:3px;left:3px;transition:transform .2s;}
.toggle-track.on{background:${C.accentDim};}
.toggle-track.on .toggle-thumb{transform:translateX(20px);}

.admin-subtab{padding:8px 16px;border-radius:8px;border:none;font-size:13px;cursor:pointer;font-family:inherit;font-weight:500;transition:all .15s;}
.admin-subtab.active{background:${C.card};color:${C.text};}
.admin-subtab:not(.active){background:transparent;color:${C.muted};}
.form-label{font-size:12px;color:${C.muted};display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.6px;}
.code-pill{font-family:monospace;background:#0c2744;color:#60a5fa;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:1px;}
.empty-state{text-align:center;padding:60px 20px;}
.empty-icon{font-size:44px;margin-bottom:14px;}
`;

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App(){
  const [users,      setUsers]      = useState(()=>gs(SK.USERS,[]));
  const [picks,      setPicks]      = useState(()=>gs(SK.PICKS,{}));
  const [leagues,    setLeagues]    = useState(()=>gs(SK.LEAGUES,[]));
  const [tournaments,setTournaments]= useState(()=>gs(SK.TOURNAMENTS,{}));
  const [currentUser,setCurrentUser]= useState(null);
  const [page,       setPage]       = useState("login");
  const [authMode,   setAuthMode]   = useState("login");
  const [activeLeagueCode, setActiveLeagueCode] = useState(null);

  const saveUsers       = u=>{setUsers(u);      ss(SK.USERS,u);};
  const savePicks       = p=>{setPicks(p);      ss(SK.PICKS,p);};
  const saveLeagues     = l=>{setLeagues(l);    ss(SK.LEAGUES,l);};
  const saveTournaments = t=>{setTournaments(t);ss(SK.TOURNAMENTS,t);};

  const isAdmin = currentUser?.role==="admin";
  const myLeagues = leagues.filter(l=>l.members.includes(currentUser?.username));

  // keep activeLeague in sync
  useEffect(()=>{
    if(myLeagues.length>0&&(!activeLeagueCode||!myLeagues.find(l=>l.code===activeLeagueCode))){
      setActiveLeagueCode(myLeagues[0].code);
    }
    if(myLeagues.length===0) setActiveLeagueCode(null);
  },[leagues,currentUser]);

  const activeLeague = leagues.find(l=>l.code===activeLeagueCode)||null;
  const activeTournament = activeLeague ? (tournaments[activeLeague.code]||DEFAULT_TOURNAMENT) : null;

  const updateTournament = (code,t)=>{
    const updated={...tournaments,[code]:t};
    saveTournaments(updated);
  };

  const logout=()=>{setCurrentUser(null);setPage("login");setActiveLeagueCode(null);};

  if(page==="login") return(
    <><style>{CSS}</style>
    <AuthPage users={users} saveUsers={saveUsers} authMode={authMode} setAuthMode={setAuthMode}
      onLogin={u=>{setCurrentUser(u);setPage("standings");}}
    /></>
  );

  return(
    <><style>{CSS}</style>
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <Header
        user={currentUser} isAdmin={isAdmin} page={page} setPage={setPage}
        onLogout={logout}
      />
      <main style={{flex:1,maxWidth:940,margin:"0 auto",width:"100%",padding:"24px 16px"}}>
        {page==="standings"&&
          <StandingsPage
            user={currentUser} leagues={leagues} saveLeagues={saveLeagues}
            picks={picks} tournaments={tournaments}
            activeLeagueCode={activeLeagueCode} setActiveLeagueCode={setActiveLeagueCode}
          />}
        {page==="leaderboard"&&
          <LeaderboardPage
            activeLeague={activeLeague} activeTournament={activeTournament}
            myLeagues={myLeagues} activeLeagueCode={activeLeagueCode} setActiveLeagueCode={setActiveLeagueCode}
          />}
        {page==="rankings"&&
          <RankingsPage activeLeague={activeLeague} activeTournament={activeTournament}/>}
        {page==="picks"&&!isAdmin&&
          <MyPicksPage
            user={currentUser} leagues={leagues} saveLeagues={saveLeagues}
            picks={picks} savePicks={savePicks} tournaments={tournaments}
            activeLeagueCode={activeLeagueCode} setActiveLeagueCode={setActiveLeagueCode}
          />}
        {page==="admin"&&isAdmin&&
          <AdminPage
            users={users} saveUsers={saveUsers}
            leagues={leagues} saveLeagues={saveLeagues}
            tournaments={tournaments} updateTournament={updateTournament}
            picks={picks}
          />}
      </main>
    </div></>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({user,isAdmin,page,setPage,onLogout}){
  const tabs=[
    {id:"standings",label:"Standings"},
    {id:"leaderboard",label:"Leaderboard"},
    {id:"rankings",label:"World Rankings"},
    {id:"picks",label:"My Picks",hideAdmin:true},
    {id:"admin",label:"Admin",adminOnly:true},
  ].filter(t=>t.adminOnly?isAdmin:t.hideAdmin?!isAdmin:true);

  return(
    <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100}}>
      <div style={{maxWidth:940,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:60,gap:12}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontWeight:900,fontSize:20,color:C.accent,flexShrink:0}}>⛳ Majors</span>
        <nav style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {tabs.map(t=>(
            <button key={t.id} className={`nav-tab${page===t.id?" active":""}`} onClick={()=>setPage(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <button className="btn-ghost" style={{padding:"6px 14px",fontSize:13,flexShrink:0}} onClick={onLogout}>
          {user?.username} · Sign out
        </button>
      </div>
    </header>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function AuthPage({users,saveUsers,authMode,setAuthMode,onLogin}){
  const [form,setForm]=useState({username:"",password:"",confirm:""});
  const [err,setErr]=useState("");
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  const handle=()=>{
    setErr("");
    if(authMode==="login"){
      const u=users.find(u=>u.username===form.username&&u.password===form.password);
      if(!u){setErr("Invalid username or password.");return;}
      onLogin(u);
    }else{
      if(!form.username.trim()||!form.password){setErr("All fields required.");return;}
      if(form.password!==form.confirm){setErr("Passwords don't match.");return;}
      if(users.find(u=>u.username===form.username)){setErr("Username already taken.");return;}
      // First user becomes admin automatically
      const role = users.length===0?"admin":"member";
      const nu={username:form.username.trim(),password:form.password,role};
      saveUsers([...users,nu]);
      onLogin(nu);
    }
  };

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:`radial-gradient(ellipse at 50% 0%,#162116 0%,${C.bg} 60%)`}}>
      <div style={{width:"100%",maxWidth:380}} className="fade">
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:52,marginBottom:10}}>⛳</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:900,color:C.text,letterSpacing:"-1px"}}>Majors Fantasy</h1>
          <p style={{color:C.muted,fontSize:14,marginTop:6}}>Pick your four, chase the glory</p>
        </div>
        <div className="card">
          {users.length===0&&authMode==="signup"&&(
            <div style={{background:"#0c2744",border:"1px solid #1e4a7a",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#60a5fa"}}>
              You're the first user — you'll be granted admin access automatically.
            </div>
          )}
          <div style={{display:"flex",marginBottom:20,background:C.surface,borderRadius:8,padding:4}}>
            {["login","signup"].map(m=>(
              <button key={m} onClick={()=>setAuthMode(m)} style={{flex:1,padding:"8px",borderRadius:6,background:authMode===m?C.card:"transparent",color:authMode===m?C.text:C.muted,border:"none",fontWeight:authMode===m?600:400,fontSize:13,cursor:"pointer"}}>
                {m==="login"?"Sign In":"Sign Up"}
              </button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <input placeholder="Username" value={form.username} onChange={f("username")} onKeyDown={e=>e.key==="Enter"&&handle()}/>
            <input type="password" placeholder="Password" value={form.password} onChange={f("password")} onKeyDown={e=>e.key==="Enter"&&handle()}/>
            {authMode==="signup"&&<input type="password" placeholder="Confirm password" value={form.confirm} onChange={f("confirm")} onKeyDown={e=>e.key==="Enter"&&handle()}/>}
            {err&&<p style={{color:C.danger,fontSize:13}}>{err}</p>}
            <button className="btn-primary" style={{width:"100%",marginTop:4}} onClick={handle}>
              {authMode==="login"?"Sign In":"Create Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── League switcher (shared) ─────────────────────────────────────────────────
function LeagueSwitcher({myLeagues,activeLeagueCode,setActiveLeagueCode,right}){
  if(myLeagues.length===0) return null;
  return(
    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",...(right?{justifyContent:"flex-end"}:{})}}>
      {myLeagues.map(l=>(
        <button key={l.code} className={`league-tab${activeLeagueCode===l.code?" active":""}`} onClick={()=>setActiveLeagueCode(l.code)}>
          {l.name}
        </button>
      ))}
    </div>
  );
}

// ─── Join League modal ────────────────────────────────────────────────────────
function JoinLeagueBox({user,leagues,saveLeagues,onJoined}){
  const [code,setCode]=useState("");
  const [err,setErr]=useState("");

  const join=()=>{
    setErr("");
    const l=leagues.find(l=>l.code===code.toUpperCase().trim());
    if(!l){setErr("League code not found. Check with your admin.");return;}
    if(l.members.includes(user.username)){setErr("You're already in this league.");return;}
    const updated=leagues.map(x=>x.code===l.code?{...x,members:[...x.members,user.username]}:x);
    saveLeagues(updated);
    onJoined(l.code);
  };

  return(
    <div style={{maxWidth:400,margin:"0 auto",textAlign:"center"}} className="fade">
      <div className="empty-icon">🏌️</div>
      <h3 style={{fontSize:18,fontWeight:700,marginBottom:8}}>Join a League</h3>
      <p style={{color:C.muted,fontSize:14,marginBottom:24,lineHeight:1.6}}>Enter the league code from your admin to get started.</p>
      <div style={{display:"flex",gap:10}}>
        <input
          placeholder="League code e.g. ALPHA"
          value={code}
          onChange={e=>setCode(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==="Enter"&&join()}
          style={{textTransform:"uppercase",letterSpacing:"2px",fontWeight:600,textAlign:"center"}}
        />
        <button className="btn-primary" style={{whiteSpace:"nowrap",flexShrink:0}} onClick={join}>Join</button>
      </div>
      {err&&<p style={{color:C.danger,fontSize:13,marginTop:10}}>{err}</p>}
    </div>
  );
}

// ─── Standings Page ───────────────────────────────────────────────────────────
function StandingsPage({user,leagues,saveLeagues,picks,tournaments,activeLeagueCode,setActiveLeagueCode}){
  const myLeagues=leagues.filter(l=>l.members.includes(user.username));
  const activeLeague=myLeagues.find(l=>l.code===activeLeagueCode)||null;
  const tournament=activeLeague?(tournaments[activeLeague.code]||DEFAULT_TOURNAMENT):null;

  if(myLeagues.length===0){
    return(
      <div className="fade">
        <div style={{marginBottom:28}}>
          <div className="page-title">Standings</div>
        </div>
        <JoinLeagueBox user={user} leagues={leagues} saveLeagues={saveLeagues} onJoined={setActiveLeagueCode}/>
      </div>
    );
  }

  const field=tournament?.field||MOCK_FIELD;
  const cutLine=tournament?.cutLine;

  // build scored list — only members of this league
  const members=activeLeague?.members||[];
  const scored=members.map(username=>{
    const pickKey=`${activeLeague.code}:${username}`;
    const p=picks[pickKey];
    const{total,breakdown}=calcScore(p,field,cutLine);
    return{username,total,breakdown,picks:p};
  }).sort((a,b)=>{
    if(a.total===null&&b.total!==null)return 1;
    if(b.total===null&&a.total!==null)return -1;
    if(a.total!==b.total)return(a.total||0)-(b.total||0);
    const ta=a.picks?.tiebreakers?.[0],tb=b.picks?.tiebreakers?.[0];
    if(ta&&tb)return getGolferScore(ta,field,cutLine).score-getGolferScore(tb,field,cutLine).score;
    return 0;
  });

  let rk=1;
  const ranked=scored.map((p,i,arr)=>{
    if(i>0&&arr[i-1].total===p.total)return{...p,rank:arr[i-1].rank};
    const r=rk;rk=i+2;return{...p,rank:r};
  });

  return(
    <div className="fade">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div className="page-title">Standings</div>
          <div className="page-sub">{activeLeague?.name} · {tournament?.name||"No tournament set up"}</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <LeagueSwitcher myLeagues={myLeagues} activeLeagueCode={activeLeagueCode} setActiveLeagueCode={setActiveLeagueCode}/>
          <button className="btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>{
            const l=leagues.find(l=>l.code===activeLeagueCode);
            if(l)alert(`League code: ${l.code}`);
          }}>Share Code</button>
        </div>
      </div>

      {!tournament?.name&&(
        <div style={{background:"#3b2a00",border:`1px solid #92400e`,borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:C.warning}}>
          No tournament configured for this league yet. Ask your admin to set one up.
        </div>
      )}

      {ranked.length===0
        ?<div className="empty-state"><div className="empty-icon">📋</div><p style={{color:C.muted}}>No picks submitted yet in this league.</p></div>
        :<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {ranked.map(p=><StandingsCard key={p.username} player={p} field={field} tournament={tournament} isCurrentUser={p.username===user.username}/>)}
        </div>
      }

      <div style={{marginTop:20,textAlign:"center"}}>
        <button className="btn-ghost" style={{fontSize:13}} onClick={()=>{
          const code=prompt("Enter a league code to join another league:");
          if(!code)return;
          const l=leagues.find(l=>l.code===code.toUpperCase().trim());
          if(!l){alert("League not found.");return;}
          if(l.members.includes(user.username)){alert("You're already in this league.");return;}
          saveLeagues(leagues.map(x=>x.code===l.code?{...x,members:[...x.members,user.username]}:x));
          setActiveLeagueCode(l.code);
        }}>+ Join Another League</button>
      </div>
    </div>
  );
}

function StandingsCard({player,field,tournament,isCurrentUser}){
  const [open,setOpen]=useState(false);
  const has=player.picks?.mains?.length>0;
  const medals=["","🥇","🥈","🥉"];
  const cutLine=tournament?.cutLine;
  return(
    <div className="card" style={{cursor:"pointer",borderColor:open?C.accentDim:isCurrentUser?"#2a4a2a":C.border,transition:"border-color .2s"}} onClick={()=>setOpen(o=>!o)}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:32,height:32,borderRadius:"50%",background:player.rank<=3?"#1a2a0a":C.surface,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:player.rank<=3?18:13,color:player.rank<=3?C.accent:C.muted,flexShrink:0}}>
          {player.rank<=3?medals[player.rank]:player.rank}
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:15,display:"flex",alignItems:"center",gap:8}}>
            {player.username}
            {isCurrentUser&&<span className="badge b-blue">You</span>}
          </div>
          {has&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>{player.picks.mains.join(" · ")}</div>}
          {!has&&<div style={{fontSize:12,color:C.muted}}>No picks submitted</div>}
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:22,fontWeight:700,color:has?C.accent:C.muted,fontFamily:"'Playfair Display',serif"}}>{has?player.total:"–"}</div>
          <div style={{fontSize:11,color:C.muted}}>total pos.</div>
        </div>
        <span style={{color:C.muted,fontSize:12,marginLeft:4}}>{open?"▲":"▼"}</span>
      </div>
      {open&&has&&(
        <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:10}}>Picks & Positions</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
            {player.breakdown.map(b=>(
              <div key={b.name} style={{display:"flex",alignItems:"center",gap:8,background:C.surface,border:`1px solid ${b.score>=(cutLine||65)?C.danger:C.border}`,borderRadius:8,padding:"7px 12px",fontSize:13}}>
                <span>{b.name}</span>
                <span style={{fontWeight:700,color:b.score>=(cutLine||65)?C.danger:C.accent}}>{b.display.includes("MC")?b.display:`#${b.display}`}</span>
              </div>
            ))}
          </div>
          {player.picks.tiebreakers?.length>0&&(
            <><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>Tiebreakers</div>
            <div style={{display:"flex",gap:8}}>
              {player.picks.tiebreakers.map((name,i)=>(
                <div key={name} style={{display:"flex",alignItems:"center",gap:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",fontSize:13,opacity:.75}}>
                  <span style={{color:C.muted,fontSize:11}}>TB{i+1}</span><span>{name}</span>
                </div>
              ))}
            </div></>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Leaderboard Page ─────────────────────────────────────────────────────────
function LeaderboardPage({activeLeague,activeTournament,myLeagues,activeLeagueCode,setActiveLeagueCode}){
  const [search,setSearch]=useState("");
  const tournament=activeTournament||DEFAULT_TOURNAMENT;
  const field=tournament.field||MOCK_FIELD;
  const sorted=[...field]
    .filter(g=>g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{if(a.cut&&!b.cut)return 1;if(!a.cut&&b.cut)return -1;return(a.pos||999)-(b.pos||999);});

  if(myLeagues.length===0) return(
    <div className="fade empty-state"><div className="empty-icon">⛳</div><p style={{color:C.muted}}>Join a league first to see the leaderboard.</p></div>
  );

  return(
    <div className="fade">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div className="page-title">Leaderboard</div>
          <div className="page-sub">{tournament.name||"No tournament active"} · R{tournament.currentRound} of 4</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <LeagueSwitcher myLeagues={myLeagues} activeLeagueCode={activeLeagueCode} setActiveLeagueCode={setActiveLeagueCode}/>
          {tournament.cutLine&&<span className="badge b-amber">Cut T{tournament.cutLine}</span>}
          {tournament.usingMock&&<span className="badge b-warn">Mock data</span>}
          <input placeholder="Search golfer…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:160}}/>
        </div>
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <table>
          <thead><tr><th style={{width:50}}>Pos</th><th>Golfer</th><th style={{width:80}}>Score</th><th style={{width:60}}>Thru</th><th style={{width:90}}>World Rank</th></tr></thead>
          <tbody>
            {sorted.map(g=>(
              <tr key={g.id}>
                <td>{g.cut?<span className="badge b-red">MC</span>:<span style={{fontWeight:700,color:g.pos<=3?C.gold:C.text}}>{g.pos}</span>}</td>
                <td style={{fontWeight:500}}>{g.name}{isTop10(g.worldRank)&&<span className="badge b-amber" style={{marginLeft:8}}>Top 10</span>}</td>
                <td style={{fontWeight:700,color:g.cut?C.muted:g.score<0?C.accent:g.score>0?C.danger:C.text}}>{g.cut?"–":g.score===0?"E":g.score>0?`+${g.score}`:g.score}</td>
                <td style={{color:C.muted}}>{g.thru}</td>
                <td style={{color:isTop10(g.worldRank)?C.gold:C.muted,fontWeight:isTop10(g.worldRank)?600:400}}>#{g.worldRank||"–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── World Rankings Page ──────────────────────────────────────────────────────
function RankingsPage({activeLeague,activeTournament}){
  const [search,setSearch]=useState("");
  const tournament=activeTournament||DEFAULT_TOURNAMENT;
  const rankings=tournament.rankings||MOCK_RANKINGS;
  const filtered=rankings.filter(r=>r.name.toLowerCase().includes(search.toLowerCase()));

  return(
    <div className="fade">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div className="page-title">World Rankings</div>
          <div className="page-sub">Official World Golf Ranking · {tournament.usingMock?"Mock data — connect API for live rankings":"Live data"}</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {tournament.usingMock&&<span className="badge b-warn">Mock data</span>}
          <input placeholder="Search player…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:180}}/>
        </div>
      </div>

      <div style={{background:"#0c2744",border:"1px solid #1e4a7a",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:"#60a5fa",lineHeight:1.6}}>
        Players ranked <strong>1–10</strong> are flagged as "Top 10" when making picks. Each player may only pick a maximum of 2 top-10 ranked golfers in their main four.
      </div>

      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <table>
          <thead>
            <tr>
              <th style={{width:60}}>Rank</th>
              <th>Player</th>
              <th style={{width:70}}>Country</th>
              <th style={{width:100}}>OWGR Points</th>
              <th style={{width:100}}>Pick Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r=>(
              <tr key={r.rank}>
                <td><span style={{fontWeight:700,color:r.rank<=10?C.gold:C.text,fontSize:r.rank<=3?15:13}}>{r.rank<=3?["","🥇","🥈","🥉"][r.rank]:r.rank}</span></td>
                <td style={{fontWeight:500}}>{r.name}</td>
                <td style={{color:C.muted}}>{r.country}</td>
                <td style={{color:C.muted}}>{r.points}</td>
                <td>{r.rank<=10
                  ?<span className="badge b-amber">Top 10 — limited</span>
                  :<span className="badge b-gray">Unrestricted</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── My Picks Page ────────────────────────────────────────────────────────────
function MyPicksPage({user,leagues,saveLeagues,picks,savePicks,tournaments,activeLeagueCode,setActiveLeagueCode}){
  const myLeagues=leagues.filter(l=>l.members.includes(user.username));
  const activeLeague=myLeagues.find(l=>l.code===activeLeagueCode)||null;
  const tournament=activeLeague?(tournaments[activeLeague.code]||DEFAULT_TOURNAMENT):null;
  const pickKey=activeLeague?`${activeLeague.code}:${user.username}`:null;
  const myPicks=pickKey?picks[pickKey]||{mains:[],tiebreakers:[]}:{mains:[],tiebreakers:[]};

  const [selected,setSelected]=useState(myPicks.mains||[]);
  const [tbs,setTbs]=useState(myPicks.tiebreakers||[]);
  const [search,setSearch]=useState("");
  const [saved,setSaved]=useState(false);

  // reset when league changes
  useEffect(()=>{
    if(pickKey){
      const p=picks[pickKey]||{mains:[],tiebreakers:[]};
      setSelected(p.mains||[]);
      setTbs(p.tiebreakers||[]);
    }
  },[activeLeagueCode]);

  if(myLeagues.length===0){
    return(
      <div className="fade">
        <div style={{marginBottom:28}}><div className="page-title">My Picks</div></div>
        <JoinLeagueBox user={user} leagues={leagues} saveLeagues={saveLeagues} onJoined={setActiveLeagueCode}/>
      </div>
    );
  }

  const locked=tournament?.locked||false;
  const field=tournament?.field||MOCK_FIELD;
  const top10Count=selected.filter(n=>{const g=field.find(f=>f.name===n);return isTop10(g?.worldRank);}).length;
  const available=field.filter(g=>!g.cut&&g.name.toLowerCase().includes(search.toLowerCase()));

  const canMain=name=>{
    if(selected.includes(name))return true;
    if(selected.length>=4)return false;
    const g=field.find(f=>f.name===name);
    if(isTop10(g?.worldRank)&&top10Count>=2)return false;
    return true;
  };
  const toggleMain=name=>{
    if(locked)return;
    if(selected.includes(name)){setSelected(s=>s.filter(x=>x!==name));return;}
    if(!canMain(name))return;
    setSelected(s=>[...s,name]);
  };
  const toggleTB=name=>{
    if(locked||selected.includes(name))return;
    if(tbs.includes(name)){setTbs(t=>t.filter(x=>x!==name));return;}
    if(tbs.length>=2)return;
    setTbs(t=>[...t,name]);
  };
  const handleSave=()=>{
    if(selected.length!==4||tbs.length!==2)return;
    savePicks({...picks,[pickKey]:{mains:selected,tiebreakers:tbs}});
    setSaved(true);setTimeout(()=>setSaved(false),2500);
  };

  return(
    <div className="fade">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div className="page-title">My Picks</div>
          <div className="page-sub">{activeLeague?.name} · {tournament?.name||"No tournament yet"}</div>
        </div>
        <LeagueSwitcher myLeagues={myLeagues} activeLeagueCode={activeLeagueCode} setActiveLeagueCode={setActiveLeagueCode}/>
      </div>

      {!tournament?.name&&(
        <div style={{background:"#3b2a00",border:"1px solid #92400e",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:C.warning}}>
          No tournament set up for this league yet. Ask your admin to configure one.
        </div>
      )}

      {locked&&(
        <div style={{background:"#451a03",border:"1px solid #92400e",borderRadius:10,padding:"12px 16px",marginBottom:20,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>🔒</span>
          <span style={{color:C.gold,fontSize:14,fontWeight:500}}>Tournament has started — your picks are locked.</span>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <div className="card">
          <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>Main Picks ({selected.length}/4)</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>Top 10 world ranking: {top10Count}/2 used</div>
          {selected.length===0&&<p style={{color:C.muted,fontSize:13}}>None selected yet</p>}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {selected.map(name=>{
              const g=field.find(f=>f.name===name);
              return(
                <div key={name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.surface,border:`1px solid ${isTop10(g?.worldRank)?C.gold:C.border}`,borderRadius:8,padding:"8px 12px",fontSize:13}}>
                  <span>{name}{isTop10(g?.worldRank)&&<span className="badge b-amber" style={{marginLeft:6}}>T10</span>}</span>
                  {!locked&&<button style={{background:"none",border:"none",color:C.danger,cursor:"pointer",fontSize:18,lineHeight:1}} onClick={()=>toggleMain(name)}>×</button>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>Tiebreakers ({tbs.length}/2)</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>No ranking restriction · only used if tied</div>
          {tbs.length===0&&<p style={{color:C.muted,fontSize:13}}>None selected yet</p>}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {tbs.map(name=>(
              <div key={name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,opacity:.85}}>
                <span>{name}</span>
                {!locked&&<button style={{background:"none",border:"none",color:C.danger,cursor:"pointer",fontSize:18,lineHeight:1}} onClick={()=>toggleTB(name)}>×</button>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {!locked&&tournament?.name&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
            <input placeholder="Search field…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:200}}/>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              {saved&&<span style={{color:C.accent,fontSize:13,fontWeight:500}}>✓ Picks saved!</span>}
              <button className="btn-primary" onClick={handleSave} disabled={selected.length!==4||tbs.length!==2}>
                {selected.length===4&&tbs.length===2?"Save Picks":`${4-selected.length} pick${4-selected.length!==1?"s":""} + ${2-tbs.length} TB needed`}
              </button>
            </div>
          </div>
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <table>
              <thead><tr><th>Golfer</th><th style={{width:90}}>World Rank</th><th style={{width:90,textAlign:"center"}}>Main Pick</th><th style={{width:90,textAlign:"center"}}>Tiebreaker</th></tr></thead>
              <tbody>
                {available.map(g=>{
                  const isMain=selected.includes(g.name),isTB=tbs.includes(g.name);
                  const okMain=canMain(g.name),okTB=!isMain&&(isTB||tbs.length<2);
                  return(
                    <tr key={g.id}>
                      <td style={{fontWeight:500}}>{g.name}{isTop10(g.worldRank)&&<span className="badge b-amber" style={{marginLeft:8}}>Top 10</span>}</td>
                      <td style={{color:isTop10(g.worldRank)?C.gold:C.muted,fontWeight:isTop10(g.worldRank)?600:400}}>#{g.worldRank||"–"}</td>
                      <td style={{textAlign:"center"}}>
                        <button onClick={()=>toggleMain(g.name)} style={{background:isMain?C.accent:C.surface,color:isMain?"#061006":okMain?C.text:C.muted,border:`1px solid ${isMain?C.accent:C.border}`,borderRadius:6,padding:"5px 14px",fontSize:12,cursor:okMain||isMain?"pointer":"not-allowed",opacity:!okMain&&!isMain?0.35:1}}>
                          {isMain?"✓ In":"Pick"}
                        </button>
                      </td>
                      <td style={{textAlign:"center"}}>
                        <button onClick={()=>toggleTB(g.name)} disabled={isMain} style={{background:isTB?"#854d0e":C.surface,color:isTB?C.gold:okTB?C.text:C.muted,border:`1px solid ${isTB?"#92400e":C.border}`,borderRadius:6,padding:"5px 14px",fontSize:12,cursor:okTB&&!isMain?"pointer":"not-allowed",opacity:(!okTB||isMain)&&!isTB?0.35:1}}>
                          {isTB?"✓ TB":"TB"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{marginTop:20,textAlign:"center"}}>
        <button className="btn-ghost" style={{fontSize:13}} onClick={()=>{
          const code=prompt("Enter a league code to join:");
          if(!code)return;
          const l=leagues.find(l=>l.code===code.toUpperCase().trim());
          if(!l){alert("League not found.");return;}
          if(l.members.includes(user.username)){alert("You're already in this league.");return;}
          saveLeagues(leagues.map(x=>x.code===l.code?{...x,members:[...x.members,user.username]}:x));
          setActiveLeagueCode(l.code);
        }}>+ Join Another League</button>
      </div>
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
function AdminPage({users,saveUsers,leagues,saveLeagues,tournaments,updateTournament,picks}){
  const [tab,setTab]=useState("leagues");
  const [selectedLeagueCode,setSelectedLeagueCode]=useState(leagues[0]?.code||null);
  const selectedLeague=leagues.find(l=>l.code===selectedLeagueCode)||null;
  const selectedTournament=selectedLeague?(tournaments[selectedLeague.code]||DEFAULT_TOURNAMENT):null;

  const tabs=[
    {id:"leagues",  label:"Leagues"},
    {id:"tournament",label:"Tournament Setup"},
    {id:"livedata", label:"Live Data & API"},
    {id:"users",    label:"Users"},
  ];

  return(
    <div className="fade">
      <div style={{marginBottom:24}}>
        <div className="page-title">Admin Panel</div>
        <div className="page-sub">Manage leagues, tournaments, and users</div>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:28,background:C.surface,borderRadius:10,padding:4,width:"fit-content",flexWrap:"wrap"}}>
        {tabs.map(t=>(
          <button key={t.id} className={`admin-subtab${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==="leagues"&&(
        <LeaguesTab leagues={leagues} saveLeagues={saveLeagues} selectedLeagueCode={selectedLeagueCode} setSelectedLeagueCode={setSelectedLeagueCode} picks={picks} tournaments={tournaments}/>
      )}
      {(tab==="tournament"||tab==="livedata")&&(
        <>
          {leagues.length===0
            ?<div className="empty-state"><div className="empty-icon">🏌️</div><p style={{color:C.muted}}>Create a league first before setting up a tournament.</p></div>
            :<>
              <div style={{marginBottom:20}}>
                <label className="form-label">Managing league:</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {leagues.map(l=>(
                    <button key={l.code} className={`league-tab${selectedLeagueCode===l.code?" active":""}`} onClick={()=>setSelectedLeagueCode(l.code)}>
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
              {tab==="tournament"&&selectedLeague&&(
                <TournamentSetup
                  league={selectedLeague} tournament={selectedTournament||DEFAULT_TOURNAMENT}
                  onSave={t=>updateTournament(selectedLeague.code,t)}
                />
              )}
              {tab==="livedata"&&selectedLeague&&(
                <LiveDataPanel
                  league={selectedLeague} tournament={selectedTournament||DEFAULT_TOURNAMENT}
                  onSave={t=>updateTournament(selectedLeague.code,t)}
                />
              )}
            </>
          }
        </>
      )}
      {tab==="users"&&(
        <UsersTab users={users} saveUsers={saveUsers} leagues={leagues}/>
      )}
    </div>
  );
}

function LeaguesTab({leagues,saveLeagues,selectedLeagueCode,setSelectedLeagueCode,picks,tournaments}){
  const [newName,setNewName]=useState("");
  const [created,setCreated]=useState(null);

  const createLeague=()=>{
    if(!newName.trim())return;
    const code=genCode();
    const league={name:newName.trim(),code,members:[],createdAt:new Date().toISOString()};
    saveLeagues([...leagues,league]);
    setSelectedLeagueCode(code);
    setCreated(code);
    setNewName("");
    setTimeout(()=>setCreated(null),4000);
  };

  const deleteLeague=code=>{
    if(!confirm("Delete this league? All picks for this league will be lost."))return;
    saveLeagues(leagues.filter(l=>l.code!==code));
    if(selectedLeagueCode===code) setSelectedLeagueCode(leagues[0]?.code||null);
  };

  return(
    <div>
      <div className="card" style={{marginBottom:20}}>
        <div style={{fontWeight:600,marginBottom:6}}>Create New League</div>
        <p style={{fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.6}}>Each league gets a unique code. Share the code with friends so they can join and submit picks.</p>
        <div style={{display:"flex",gap:10}}>
          <input placeholder="League name e.g. Work Mates, Family Cup…" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createLeague()} style={{flex:1}}/>
          <button className="btn-primary" style={{whiteSpace:"nowrap",flexShrink:0}} onClick={createLeague} disabled={!newName.trim()}>Create League</button>
        </div>
        {created&&(
          <div style={{marginTop:14,padding:"12px 14px",background:"#0c2744",border:"1px solid #1e4a7a",borderRadius:8,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:13,color:"#60a5fa"}}>League created! Share this code with your friends:</span>
            <span className="code-pill">{created}</span>
          </div>
        )}
      </div>

      {leagues.length===0
        ?<div className="empty-state"><div className="empty-icon">🏆</div><p style={{color:C.muted}}>No leagues yet. Create one above.</p></div>
        :<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {leagues.map(l=>{
            const t=tournaments[l.code]||DEFAULT_TOURNAMENT;
            const memberPicks=l.members.filter(m=>picks[`${l.code}:${m}`]?.mains?.length>0);
            return(
              <div key={l.code} className="card" style={{borderColor:selectedLeagueCode===l.code?C.accentDim:C.border}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:15,marginBottom:4,display:"flex",alignItems:"center",gap:10}}>
                      {l.name}
                      <span className="code-pill">{l.code}</span>
                      {t.locked&&<span className="badge b-red">🔒 Locked</span>}
                      {!t.locked&&t.name&&<span className="badge b-green">🔓 Open</span>}
                    </div>
                    <div style={{fontSize:13,color:C.muted,display:"flex",gap:16,flexWrap:"wrap"}}>
                      <span>{l.members.length} member{l.members.length!==1?"s":""}</span>
                      <span>{memberPicks.length}/{l.members.length} picks submitted</span>
                      <span>{t.name||"No tournament"}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>{navigator.clipboard?.writeText(l.code);alert(`Code copied: ${l.code}`);}}>Copy Code</button>
                    <button style={{background:"#7f1d1d",color:C.danger,border:"1px solid #991b1b",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer"}} onClick={()=>deleteLeague(l.code)}>Delete</button>
                  </div>
                </div>
                {l.members.length>0&&(
                  <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,fontSize:12,color:C.muted}}>
                    Members: {l.members.join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}

function TournamentSetup({league,tournament,onSave}){
  const [form,setForm]=useState({
    majorId:tournament.majorId||"",course:tournament.course||"",
    date:tournament.date||"",status:tournament.status||"upcoming",
    currentRound:tournament.currentRound||1,cutLine:tournament.cutLine??""
  });
  const [locked,setLocked]=useState(tournament.locked||false);
  const [saved,setSaved]=useState(false);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const selectedMajor=MAJORS.find(m=>m.id===form.majorId);

  const save=()=>{
    onSave({...tournament,...form,
      name:selectedMajor?.name||tournament.name,
      cutLine:form.cutLine===""?null:parseInt(form.cutLine),
      currentRound:parseInt(form.currentRound),locked,
    });
    setSaved(true);setTimeout(()=>setSaved(false),2000);
  };

  return(
    <div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",marginBottom:20,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:13,color:C.muted}}>League:</span>
        <span style={{fontWeight:600}}>{league.name}</span>
        <span className="code-pill">{league.code}</span>
        <span style={{marginLeft:"auto"}} className={`badge ${locked?"b-red":"b-green"}`}>{locked?"🔒 Picks locked":"🔓 Picks open"}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:20}}>
        <div>
          <label className="form-label">Select Major</label>
          <select value={form.majorId} onChange={f("majorId")}>
            <option value="">— Choose a major —</option>
            {MAJORS.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {selectedMajor&&<p style={{fontSize:12,color:C.muted,marginTop:5}}>Default: {selectedMajor.course}</p>}
        </div>
        <div><label className="form-label">Start Date</label><input type="date" value={form.date} onChange={f("date")}/></div>
        <div><label className="form-label">Course Name</label><input placeholder={selectedMajor?.course||"Course name"} value={form.course} onChange={f("course")}/></div>
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
            {[1,2,3,4].map(r=><option key={r} value={r}>Round {r}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Cut Line <span style={{fontWeight:400,fontSize:11}}>(enter after cut Friday)</span></label>
          <input type="number" placeholder="e.g. 65 → missed cut = T65" value={form.cutLine} onChange={f("cutLine")} min={1} max={200}/>
          {form.cutLine&&<p style={{fontSize:12,color:C.muted,marginTop:5}}>Missed-cut golfers score T{form.cutLine}</p>}
        </div>
      </div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 20px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
        <div>
          <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Lock Player Picks</div>
          <div style={{fontSize:13,color:C.muted,maxWidth:400}}>Flip before the first tee shot Thursday. Players cannot change picks once locked.</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setLocked(o=>!o)}>
          <div className={`toggle-track${locked?" on":""}`}><div className="toggle-thumb"/></div>
          <span style={{fontSize:13,fontWeight:600,color:locked?C.accent:C.muted}}>{locked?"Locked":"Open"}</span>
        </div>
      </div>
      <button className="btn-primary" onClick={save}>{saved?"✓ Saved!":"Save Tournament Settings"}</button>
    </div>
  );
}

function LiveDataPanel({league,tournament,onSave}){
  const [apiKey,setApiKey]=useState(tournament.apiKey||"");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [msg,setMsg]=useState("");

  const saveKey=()=>{
    onSave({...tournament,apiKey,usingMock:!apiKey});
    setMsg("Key saved.");setTimeout(()=>setMsg(""),2000);
  };
  const refresh=async()=>{
    if(!apiKey){setError("Paste your API key first.");return;}
    if(!tournament.majorId){setError("Select a major in Tournament Setup first.");return;}
    setLoading(true);setError("");setMsg("");
    try{
      const lf=await fetchLiveData(apiKey,tournament.majorId);
      onSave({...tournament,apiKey,usingMock:false,field:lf,lastUpdated:new Date().toISOString()});
      setMsg(`✓ ${lf.length} golfers loaded. World rankings included.`);
    }catch(e){setError(`Failed: ${e.message}`);}
    setLoading(false);
  };
  const useMock=()=>{
    onSave({...tournament,usingMock:true,field:MOCK_FIELD,rankings:MOCK_RANKINGS,lastUpdated:new Date().toISOString()});
    setMsg("Using mock data.");setTimeout(()=>setMsg(""),2000);
  };

  const stats=[
    {label:"Data source",  value:tournament.usingMock?"Mock":"Live API"},
    {label:"Golfers",      value:(tournament.field||MOCK_FIELD).length},
    {label:"Last updated", value:tournament.lastUpdated?new Date(tournament.lastUpdated).toLocaleTimeString():"Never"},
    {label:"Auto-refresh", value:tournament.apiKey&&tournament.status==="in_progress"&&!tournament.usingMock?"Every 3 min":"Off"},
  ];

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        {stats.map(s=>(
          <div key={s.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px"}}>
            <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".6px",marginBottom:6}}>{s.label}</div>
            <div style={{fontSize:16,fontWeight:600,color:C.accent}}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontWeight:600,marginBottom:6}}>RapidAPI Key</div>
        <p style={{fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.65}}>
          One API key covers both live scores and world rankings. Go to <strong style={{color:C.text}}>rapidapi.com</strong> → search <strong style={{color:C.text}}>"Golf Leaderboard Data"</strong> → subscribe (free tier) → copy your <code style={{background:C.surface,padding:"1px 6px",borderRadius:4,fontSize:12}}>X-RapidAPI-Key</code>.
        </p>
        <div style={{display:"flex",gap:10}}>
          <input type="password" placeholder="Paste RapidAPI key…" value={apiKey} onChange={e=>setApiKey(e.target.value)} style={{flex:1}}/>
          <button className="btn-primary" style={{whiteSpace:"nowrap",flexShrink:0}} onClick={saveKey}>Save Key</button>
        </div>
        {msg&&<p style={{color:C.accent,fontSize:13,marginTop:10}}>✓ {msg}</p>}
        {error&&<p style={{color:C.danger,fontSize:13,marginTop:10}}>⚠ {error}</p>}
      </div>
      <div className="card">
        <div style={{fontWeight:600,marginBottom:6}}>Refresh Scores</div>
        <p style={{fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.65}}>
          Fetches live scores and world rankings in a single call. Auto-refreshes every 3 minutes when a key is saved and tournament is In Progress.
        </p>
        <div style={{display:"flex",gap:10}}>
          <button className="btn-primary" onClick={refresh} disabled={loading||!apiKey}>{loading?"Fetching…":"Fetch Live Data Now"}</button>
          <button className="btn-secondary" onClick={useMock}>Use Mock Data</button>
        </div>
      </div>
    </div>
  );
}

function UsersTab({users,saveUsers,leagues}){
  const promote=username=>{
    if(!confirm(`Promote ${username} to admin?`))return;
    saveUsers(users.map(u=>u.username===username?{...u,role:"admin"}:u));
  };
  const demote=username=>{
    const admins=users.filter(u=>u.role==="admin");
    if(admins.length<=1){alert("Cannot remove the last admin.");return;}
    if(!confirm(`Remove admin from ${username}?`))return;
    saveUsers(users.map(u=>u.username===username?{...u,role:"member"}:u));
  };

  const getUserLeagues=username=>leagues.filter(l=>l.members.includes(username)).map(l=>l.name).join(", ")||"None";

  return(
    <div>
      <div style={{background:"#0c2744",border:"1px solid #1e4a7a",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:"#60a5fa",lineHeight:1.6}}>
        The first account created is automatically admin. Promote other users here. There must always be at least one admin.
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <table>
          <thead><tr><th>Username</th><th>Role</th><th>Leagues</th><th style={{width:130}}>Actions</th></tr></thead>
          <tbody>
            {users.length===0&&<tr><td colSpan={4} style={{textAlign:"center",color:C.muted,padding:28}}>No users yet.</td></tr>}
            {users.map(u=>(
              <tr key={u.username}>
                <td style={{fontWeight:500}}>{u.username}</td>
                <td>{u.role==="admin"?<span className="badge b-amber">Admin</span>:<span className="badge b-gray">Member</span>}</td>
                <td style={{fontSize:12,color:C.muted}}>{getUserLeagues(u.username)}</td>
                <td>
                  {u.role==="admin"
                    ?<button style={{background:"#451a03",color:C.gold,border:"1px solid #92400e",borderRadius:6,padding:"4px 12px",fontSize:12,cursor:"pointer"}} onClick={()=>demote(u.username)}>Remove Admin</button>
                    :<button style={{background:"#14532d",color:C.accent,border:"1px solid #166534",borderRadius:6,padding:"4px 12px",fontSize:12,cursor:"pointer"}} onClick={()=>promote(u.username)}>Make Admin</button>
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
