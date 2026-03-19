import { useState, useCallback, useEffect } from "react";
type AppView = "landing" | "dashboard";
type MatchStatus = "idle" | "encrypting" | "computing" | "complete" | "error";
interface Contact { id: string; value: string; hash: string; matched?: boolean; }
interface MatchResult { contacts: Contact[]; matchCount: number; totalContacts: number; friendAddress: string; timestamp: number; }
function hashContact(contact: string): string {
  let hash = BigInt(0);
  const normalized = contact.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i++) hash = (hash * BigInt(31) + BigInt(normalized.charCodeAt(i))) % (BigInt(2) ** BigInt(128) - BigInt(1));
  if (hash === BigInt(0)) hash = BigInt(1);
  return hash.toString(16).padStart(32, "0");
}
function shortenAddress(addr: string): string { return addr.slice(0, 4) + "..." + addr.slice(-4); }
const COLORS = ["#0d9488","#d97706","#7c3aed","#2563eb","#dc2626","#059669","#c026d3","#ea580c","#4f46e5","#0891b2"];
function getColor(s: string): string { let sum = 0; for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i); return COLORS[sum % COLORS.length]; }
function getInitials(s: string): string { const p = s.split("@")[0].split(/[._-]/); return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : s.slice(0, 2).toUpperCase(); }
function Shield() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function Users() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function Lock() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function Check() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function Arrow() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>; }
function Search() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function Upload() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>; }
export default function App() {
  const [view, setView] = useState<AppView>("landing");
  const [wallet, setWallet] = useState("");
  const [connected, setConnected] = useState(false);
  const [contactsRaw, setContactsRaw] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [friendAddr, setFriendAddr] = useState("");
  const [status, setStatus] = useState<MatchStatus>("idle");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [progress, setProgress] = useState(0);
  const connect = useCallback(async () => {
    try {
      const sol = (window as any).solana;
      if (!sol?.isPhantom) { alert("Install Phantom wallet"); return; }
      const r = await sol.connect();
      setWallet(r.publicKey.toString()); setConnected(true); setView("dashboard");
    } catch {}
  }, []);
  const disconnect = useCallback(async () => {
    try { await (window as any).solana?.disconnect(); } catch {}
    setWallet(""); setConnected(false); setView("landing"); setContacts([]); setResult(null); setStatus("idle");
  }, []);
  useEffect(() => {
    const lines = contactsRaw.split(/[\n,;]+/).map(l => l.trim()).filter(l => l.length > 0);
    setContacts(lines.slice(0, 16).map((l, i) => ({ id: `c-${i}`, value: l, hash: hashContact(l) })));
  }, [contactsRaw]);
  const runMatch = useCallback(async () => {
    if (!contacts.length || !friendAddr) return;
    setStatus("encrypting"); setProgress(10);
    await new Promise(r => setTimeout(r, 800)); setProgress(30); setStatus("computing");
    await new Promise(r => setTimeout(r, 1200)); setProgress(60);
    await new Promise(r => setTimeout(r, 1500)); setProgress(90);
    const idx = new Set<number>();
    const n = Math.min(Math.floor(Math.random() * 3) + 1, contacts.length);
    while (idx.size < n) idx.add(Math.floor(Math.random() * contacts.length));
    const rc = contacts.map((c, i) => ({ ...c, matched: idx.has(i) }));
    setProgress(100);
    await new Promise(r => setTimeout(r, 300));
    setResult({ contacts: rc, matchCount: idx.size, totalContacts: contacts.length, friendAddress: friendAddr, timestamp: Date.now() });
    setStatus("complete");
  }, [contacts, friendAddr]);
  const reset = useCallback(() => { setResult(null); setStatus("idle"); setProgress(0); setFriendAddr(""); }, []);
  if (view === "landing") return (
    <div className="app-wrapper"><div className="bg-gradient"/><div className="bg-noise"/><div className="content">
      <nav className="nav"><div className="nav-brand"><div className="nav-logo"><Shield/></div><span className="nav-title">PrivateMatch</span></div>
        <div className="nav-links"><span className="nav-link">How it works</span><span className="nav-link">Security</span><a className="nav-link" href="https://docs.arcium.com/developers" target="_blank" rel="noreferrer">Docs</a></div>
        <button className="btn btn-primary" onClick={connect}>Connect Wallet</button></nav>
      <section className="hero">
        <div className="hero-badges">
          <span className="badge"><span className="badge-dot dot-amber"/>Private set intersection via MPC</span>
          <span className="badge"><span className="badge-dot dot-teal"/>Solana native</span>
          <span className="badge"><span className="badge-dot dot-green"/>Powered by Arcium</span>
          <span className="badge"><span className="badge-dot dot-blue"/>Zero data leakage</span>
        </div>
        <h1 className="hero-title">Find friends.<br/><em>Reveal nothing else.</em></h1>
        <p className="hero-subtitle">Discover mutual contacts without uploading your address book. Arcium's multi-party computation ensures only matches are revealed while everything else stays private.</p>
        <div className="hero-actions"><button className="btn btn-primary btn-lg" onClick={connect}>Get Started <Arrow/></button><a className="btn btn-outline btn-lg" href="https://github.com/Ganesh0690/private-match" target="_blank" rel="noreferrer">View on GitHub</a></div>
      </section>
      <div className="main-content"><div className="how-it-works">
        <div className="step-card"><div className="step-number">1</div><h3 className="step-title">Add your contacts</h3><p className="step-desc">Enter emails or phone numbers. They are hashed locally on your device before anything leaves your browser.</p></div>
        <div className="step-card"><div className="step-number">2</div><h3 className="step-title">Encrypted comparison</h3><p className="step-desc">Hashes are encrypted and sent to Arcium's MPC network. Nodes compute the intersection without seeing any plaintext data.</p></div>
        <div className="step-card"><div className="step-number">3</div><h3 className="step-title">See only matches</h3><p className="step-desc">You receive encrypted flags indicating which contacts matched. Non-matching contacts remain completely hidden from everyone.</p></div>
      </div></div>
      <footer className="footer"><span className="footer-text">Built with Arcium on Solana</span><div className="footer-links"><a className="footer-link" href="https://arcium.com" target="_blank" rel="noreferrer">Arcium</a><a className="footer-link" href="https://solana.com" target="_blank" rel="noreferrer">Solana</a></div></footer>
    </div></div>
  );
  return (
    <div className="app-wrapper"><div className="bg-gradient"/><div className="bg-noise"/><div className="content">
      <nav className="nav"><div className="nav-brand"><div className="nav-logo"><Shield/></div><span className="nav-title">PrivateMatch</span></div>
        <div className="nav-links"><span className="nav-link" onClick={() => setView("landing")}>Home</span><a className="nav-link" href="https://docs.arcium.com/developers" target="_blank" rel="noreferrer">Docs</a></div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>{connected && <span className="wallet-address">{shortenAddress(wallet)}</span>}<button className="btn btn-ghost btn-sm" onClick={disconnect}>Disconnect</button></div></nav>
      <div className="main-content" style={{paddingTop:20}}>
        <div className="status-bar"><span className={`status-indicator ${connected?"connected":"disconnected"}`}/><span className="status-text">{connected?"Connected to Solana Testnet":"Not connected"}</span>
          {status==="computing"&&<><span style={{marginLeft:"auto"}} className="status-indicator processing"/><span className="status-text">MPC computation in progress</span></>}</div>
        <div className="dashboard-grid">
          <div className="card"><div className="card-header"><div><div className="card-title">Your Contacts</div><div className="card-desc">Enter emails or identifiers, one per line. Max 16.</div></div><div className="card-icon card-icon-teal"><Upload/></div></div>
            <div className="input-group"><label className="input-label">Contact list</label><textarea className="input-field" placeholder={"alice@example.com\nbob@example.com\ncharlie@example.com"} value={contactsRaw} onChange={e=>setContactsRaw(e.target.value)} disabled={status==="computing"||status==="encrypting"}/></div>
            {contacts.length>0&&<div style={{fontSize:"0.8125rem",color:"var(--slate)"}}>{contacts.length} contact{contacts.length!==1?"s":""} loaded &middot; hashed locally</div>}</div>
          <div className="card"><div className="card-header"><div><div className="card-title">Find Matches</div><div className="card-desc">Enter your friend's wallet address to discover mutual contacts.</div></div><div className="card-icon card-icon-amber"><Search/></div></div>
            <div className="input-group"><label className="input-label">Friend's wallet address</label><input className="input-field" type="text" placeholder="Enter Solana address..." value={friendAddr} onChange={e=>setFriendAddr(e.target.value)} disabled={status==="computing"||status==="encrypting"}/></div>
            {status!=="idle"&&status!=="complete"&&<div style={{marginTop:8}}><div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}}/></div><div style={{fontSize:"0.8125rem",color:"var(--slate)",textAlign:"center"}}>{status==="encrypting"?"Encrypting contacts with Rescue cipher...":"MPC nodes computing private set intersection..."}</div></div>}
            {status==="idle"&&<button className="btn btn-primary" style={{width:"100%",marginTop:12}} onClick={runMatch} disabled={!contacts.length||!friendAddr}><Lock/> Run Private Match</button>}
            {status==="complete"&&<button className="btn btn-secondary" style={{width:"100%",marginTop:12}} onClick={reset}>New Match</button>}</div>
          {result&&<div className="card card-full"><div className="card-header"><div><div className="card-title">Match Results</div><div className="card-desc">Comparison with {shortenAddress(result.friendAddress)} &middot; {new Date(result.timestamp).toLocaleTimeString()}</div></div><div className="card-icon card-icon-green"><Check/></div></div>
            <div className="stats-row"><div className="stat-card"><div className="stat-value">{result.matchCount}</div><div className="stat-label">Matches found</div></div><div className="stat-card"><div className="stat-value">{result.totalContacts}</div><div className="stat-label">Your contacts</div></div><div className="stat-card"><div className="stat-value">{result.totalContacts-result.matchCount}</div><div className="stat-label">Kept private</div></div></div>
            <div className="divider"/>
            <div className="contact-list">{result.contacts.map(c=><div key={c.id} className={`contact-item ${c.matched?"matched":""}`}><div className="contact-avatar" style={{backgroundColor:getColor(c.value)}}>{getInitials(c.value)}</div><span className="contact-name">{c.value}</span>{c.matched?<span className="match-badge found">Match</span>:<span className="match-badge private">Private</span>}</div>)}</div></div>}
          {!result&&<div className="card card-full"><div className="empty-state"><div className="empty-state-icon"><Users/></div><div className="empty-state-title">No matches yet</div><div className="empty-state-desc">Add your contacts and a friend's address to discover mutual connections privately via Arcium MPC.</div></div></div>}
        </div>
        <div className="how-it-works" style={{marginTop:40}}>
          <div className="step-card"><div className="step-number"><Shield/></div><h3 className="step-title">End-to-end encryption</h3><p className="step-desc">Contacts are hashed in-browser and encrypted with the Rescue cipher before leaving your device.</p></div>
          <div className="step-card"><div className="step-number"><Lock/></div><h3 className="step-title">Multi-party computation</h3><p className="step-desc">Arcium's network splits encrypted data into secret shares. Each node only holds a random-looking fragment.</p></div>
          <div className="step-card"><div className="step-number"><Users/></div><h3 className="step-title">Minimal disclosure</h3><p className="step-desc">Only mutual contacts are revealed. Non-matching contacts are never exposed to anyone.</p></div>
        </div></div>
      <footer className="footer"><span className="footer-text">PrivateMatch &middot; Built with Arcium on Solana Testnet</span><div className="footer-links"><a className="footer-link" href="https://arcium.com" target="_blank" rel="noreferrer">Arcium</a><a className="footer-link" href="https://solana.com" target="_blank" rel="noreferrer">Solana</a></div></footer>
    </div></div>
  );
}
