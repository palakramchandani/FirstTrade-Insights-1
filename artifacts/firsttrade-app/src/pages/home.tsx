import { useMemo, useState } from "react";
import {
  ArrowRight, BarChart3, Bell, Check, ChevronDown, ChevronRight,
  CircleAlert, FlaskConical, GitBranch, LayoutDashboard,
  MessageSquare, Search, Send, Settings2, SlidersHorizontal, 
  Sparkles, Target, UserRound, X, Zap
} from "lucide-react";

type Area = "Overview" | "Cohorts" | "Decisions" | "Policy Studio" | "Measurement" | "Simulator";
type Action = "Add Funds" | "Create Pre-order" | "Start MF Investing" | "Activate Segment" | "Take First Trade";
type Signals = { order: number; watchlist: number; mf: number; segment: number; funding: number };

const customers = [
  { id: "FT-20481", name: "Arjun Mehta", initials: "AM", cohort: "Research-led", state: "UCC Mapping", action: "Add Funds" as Action, why: "Pre-order started; funding is the next safe step.", channel: "In-app", score: 76, policy: "v1.0" },
  { id: "FT-20317", name: "Nisha Kulkarni", initials: "NK", cohort: "MF-first", state: "MF Account", action: "Start MF Investing" as Action, why: "Scheme detail and SIP calculator activity is strong.", channel: "WhatsApp", score: 81, policy: "v1.0" },
  { id: "FT-20188", name: "Rohit Sharma", initials: "RS", cohort: "Intent-rich", state: "Exchange Approval", action: "Take First Trade" as Action, why: "Approval is complete and instrument selection is recent.", channel: "In-app", score: 72, policy: "v1.0" },
  { id: "FT-19942", name: "Priya Iyer", initials: "PI", cohort: "New explorer", state: "KRA", action: "Complete KYC / KRA" as Action, why: "KRA was rejected; recovery is the only eligible path.", channel: "Push", score: 0, policy: "v1.0" },
];

const stageData = [
  { title: "KRA Stage", pending: "Pending externally", can: "Complete KYC / KRA", cohort: "New explorer", count: "1,204", picks: ["Complete KYC / KRA", "Resume account"] },
  { title: "UCC Mapping Stage", pending: "Pending externally", can: "Add Funds or create a pre-order", cohort: "Intent-rich", count: "846", picks: ["Add Funds", "Create Pre-order"] },
  { title: "MF Account Stage", pending: "Pending externally", can: "Start MF Investing", cohort: "MF-first", count: "429", picks: ["Start MF Investing", "Review scheme"] },
  { title: "Exchange Trading Approval Stage", pending: "Pending externally", can: "Take First Trade", cohort: "Research-led", count: "188", picks: ["Take First Trade", "Review watchlist"] },
];

const nav = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Cohorts", icon: GitBranch },
  { label: "Decisions", icon: Target }, { label: "Policy Studio", icon: Settings2 },
  { label: "Measurement", icon: BarChart3 }, { label: "Simulator", icon: FlaskConical },
] as const;

const weights: Record<Action, number[]> = {
  "Add Funds": [25, 25, 10, 10, 10], "Create Pre-order": [25, 20, 0, 0, 35],
  "Start MF Investing": [5, 5, 45, 0, 25], "Activate Segment": [10, 10, 0, 50, 10],
  "Take First Trade": [25, 20, 0, 0, 35],
};
const labels = ["Order-flow intent", "Watchlist / research", "MF intent", "F&O / Commodity intent", "Funding / pre-order readiness"];

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "green" | "red" | "slate" }) {
  const tones = {
    blue: "bg-primary/10 text-primary border-primary/20",
    green: "bg-[#18794E]/10 text-[#18794E] border-[#18794E]/20",
    red: "bg-destructive/10 text-destructive border-destructive/20",
    slate: "bg-background text-muted-foreground border-border"
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${tones[tone]}`}>{children}</span>;
}

function Button({ children, onClick, primary = false, disabled = false, "data-testid": testId }: any) {
  return (
    <button 
      data-testid={testId}
      disabled={disabled} 
      onClick={onClick} 
      className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${primary ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm' : 'bg-card text-foreground border-border hover:bg-background shadow-sm'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

function SectionTitle({ kicker, title, copy }: { kicker?: string; title: string; copy?: string }) {
  return (
    <div className="mb-6">
      {kicker && <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{kicker}</div>}
      <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
      {copy && <p className="text-muted-foreground mt-1 text-sm">{copy}</p>}
    </div>
  );
}

function scoreFor(action: Action, s: Signals, base = 20) {
  const vals = [s.order, s.watchlist, s.mf, s.segment, s.funding];
  return Math.round(base + vals.reduce((a, v, i) => a + v * weights[action][i], 0));
}

export default function Home() {
  const [area, setArea] = useState<Area>("Overview");
  const [selected, setSelected] = useState(customers[0]);
  const [search, setSearch] = useState("");
  const [studio, setStudio] = useState(false);
  const [published, setPublished] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [scenario, setScenarioState] = useState("Research-led account");
  const [signals, setSignals] = useState<Signals>({ order: .7, watchlist: .8, mf: .4, segment: .3, funding: .8 });
  const [states, setStates] = useState({ esign: true, kra: true, ucc: true, mf: false, exchange: false, a2t: false });
  const filtered = customers.filter(c => `${c.name} ${c.cohort} ${c.action}`.toLowerCase().includes(search.toLowerCase()));
  
  const simScores = useMemo(() => {
    const base = states.esign && states.kra && !states.a2t ? 20 : 0;
    return (Object.keys(weights) as Action[]).map(a => ({ action: a, score: scoreFor(a, signals, base) })).sort((a, b) => b.score - a.score);
  }, [signals, states.esign, states.kra, states.a2t]);
  
  const recommendation = states.kra === false ? "Complete KYC / KRA" : states.a2t ? "No recommendation" : simScores[0].score >= 60 ? simScores[0].action : "Resume account";

  const simulatorScenarios = [
    "Research-led account", "KRA rejected", "UCC pending", "MF-first customer", 
    "Exchange approved", "High intent F&O", "A2T achieved"
  ];

  const setScenario = (v: string) => {
    setScenarioState(v);
    if (v === "Research-led account") { setStates({ esign: true, kra: true, ucc: true, mf: false, exchange: false, a2t: false }); setSignals({ order: .7, watchlist: .8, mf: .4, segment: .3, funding: .8 }); }
    if (v === "KRA rejected") { setStates({ esign: true, kra: false, ucc: false, mf: false, exchange: false, a2t: false }); setSignals({ order: 0, watchlist: 0, mf: 0, segment: 0, funding: 0 }); }
    if (v === "UCC pending") { setStates({ esign: true, kra: true, ucc: false, mf: false, exchange: false, a2t: false }); setSignals({ order: .5, watchlist: .5, mf: .5, segment: .5, funding: .5 }); }
    if (v === "MF-first customer") { setStates({ esign: true, kra: true, ucc: true, mf: false, exchange: false, a2t: false }); setSignals({ order: 0, watchlist: .6, mf: 1, segment: .7, funding: .3 }); }
    if (v === "Exchange approved") { setStates({ esign: true, kra: true, ucc: true, mf: true, exchange: true, a2t: false }); setSignals({ order: 1, watchlist: 1, mf: .7, segment: 1, funding: .8 }); }
    if (v === "High intent F&O") { setStates({ esign: true, kra: true, ucc: true, mf: false, exchange: false, a2t: false }); setSignals({ order: .9, watchlist: .9, mf: 0, segment: 1, funding: .5 }); }
    if (v === "A2T achieved") { setStates({ esign: true, kra: true, ucc: true, mf: true, exchange: true, a2t: true }); }
  };

  const overview = (
    <>
      <SectionTitle title="FirstTrade Decision Centre" copy="Turn account activation status and customer behaviour into the most relevant next action." />
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Customers requiring a next action</div>
          <div className="text-2xl font-bold text-foreground" data-testid="metric-1">2,667</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">A2T achieved through pre-order or MF</div>
          <div className="text-2xl font-bold text-foreground" data-testid="metric-2">1,184</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Cohort defaults overridden by FirstTrade</div>
          <div className="text-2xl font-bold text-foreground" data-testid="metric-3">318</div>
        </div>
      </div>
      
      <div className="bg-card border border-border rounded-lg shadow-sm mt-6">
        <div className="p-4 border-b border-border flex justify-between items-end">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">ACTIVATION FLOW</div>
            <h2 className="text-lg font-bold text-foreground">Where customers pause</h2>
          </div>
          <span className="text-sm text-muted-foreground">Last 7 days · 8,412 accounts</span>
        </div>
        <div className="p-6 flex items-start justify-between relative">
          {["Post e-sign", "KRA", "UCC Mapping", "MF Account", "Exchange Approval", "A2T"].map((x, i) => (
            <div className="flex flex-col flex-1 items-center relative z-10" key={x}>
              <div className="text-xl font-bold text-foreground mb-2">{[8412, 7901, 6540, 4862, 3274, 1184][i].toLocaleString()}</div>
              <div className="w-full px-2 mb-3">
                <div className="h-2 bg-background border border-border rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${100 - i * 12}%` }} />
                </div>
              </div>
              <span className="text-xs font-medium text-muted-foreground text-center">{x}</span>
            </div>
          ))}
          <div className="absolute top-[3.25rem] left-0 w-full flex justify-between px-[8%] pointer-events-none text-border">
            {[1,2,3,4,5].map(i => <ArrowRight key={i} size={16} />)}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm mt-6">
        <div className="p-4 border-b border-border flex justify-between items-center bg-background">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">QUEUE · 2,667 OPEN</div>
            <h2 className="text-lg font-bold text-foreground">Priority Decisions</h2>
          </div>
          <Button onClick={() => setArea("Decisions")} data-testid="button-open-decision-queue">Open decision queue <ArrowRight size={14} /></Button>
        </div>
        <DecisionTable onSelect={c => { setSelected(c); setArea("Decisions"); }} />
      </div>
    </>
  );

  const cohorts = (
    <>
      <SectionTitle title="Cohorts" copy="Understand the externally pending step, then choose the safest customer action still available." />
      <div className="space-y-4">
        {stageData.map((s, i) => (
          <div className="bg-card border border-border rounded-lg shadow-sm p-5 flex gap-6 relative" key={s.title}>
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-xs font-bold text-foreground mb-2">{i + 1}</div>
              {i !== stageData.length - 1 && <div className="w-px bg-border flex-1" />}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">STAGE {i + 1}</div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                    {s.title}
                    <Badge tone="slate">{s.pending}</Badge>
                  </h2>
                </div>
                <Button onClick={() => setArea("Decisions")} data-testid={`button-view-customers-${i}`}>View customers <ArrowRight size={14} /></Button>
              </div>
              
              <div className="grid grid-cols-4 gap-6 bg-background border border-border rounded p-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Customer can still do</div>
                  <div className="font-semibold text-foreground">{s.can}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Default cohort action</div>
                  <div className="font-semibold text-primary">{s.picks[0]}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Customers here</div>
                  <div className="font-semibold text-foreground text-lg">{s.count}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-2">Top selected actions</div>
                  <div className="space-y-2">
                    {s.picks.map((p, j) => (
                      <div key={p} className="flex justify-between items-center text-xs border-b border-border/50 pb-1 last:border-0 last:pb-0">
                        <span className="font-medium text-foreground">{p}</span>
                        <span className="text-muted-foreground">{[38, 24][j]}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
        <CircleAlert size={18} className="text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 text-destructive">
          <b className="block mb-1">KRA / KYC rejected is recovery-only</b>
          <p className="text-sm opacity-90">FirstTrade does not score or recommend trading actions here. The only eligible path is Complete Re-KYC / Re-KRA.</p>
        </div>
        <Button onClick={() => setScenario("KRA rejected")} data-testid="button-view-recovery-cohort">View recovery cohort</Button>
      </div>
    </>
  );

  const decisions = (
    <div className="flex flex-col h-full animate-in fade-in duration-200">
      <SectionTitle title="Decisions" copy="A deterministic queue for deciding the next activation action, with customer-safe reasoning." />
      <div className="flex gap-6 flex-1 min-h-0">
        <div className="w-80 bg-card border border-border rounded-lg shadow-sm flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-border flex items-center gap-2 bg-background">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-2 text-muted-foreground" />
              <input 
                data-testid="input-search-customers"
                className="w-full bg-card border border-border rounded text-sm py-1.5 pl-8 pr-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search customer or cohort" 
              />
            </div>
            <button className="p-1.5 text-muted-foreground hover:bg-border/50 rounded transition-colors"><SlidersHorizontal size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map(c => (
              <button 
                data-testid={`button-queue-item-${c.id}`}
                className={`w-full text-left p-3 border-b border-border flex items-center gap-3 transition-colors ${selected.id === c.id ? 'bg-background border-l-2 border-l-primary' : 'hover:bg-background border-l-2 border-l-transparent'}`}
                onClick={() => setSelected(c)} 
                key={c.id}
              >
                <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-xs font-bold text-foreground shrink-0">{c.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.cohort} · {c.state}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-foreground leading-none">{c.score}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">fit</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">No customers found.</div>
            )}
          </div>
        </div>
        <div className="flex-1">
          <Detail customer={selected} expanded={expanded} setExpanded={setExpanded} onStudio={() => setStudio(true)} />
        </div>
      </div>
    </div>
  );

  const policy = (
    <div className="animate-in fade-in duration-200">
      <SectionTitle title="Policy Studio" copy="Shape the decision policy locally, preview its impact, and publish a simulated version." />
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg shadow-sm p-6 flex flex-col gap-6">
          <div className="flex justify-between items-start border-b border-border pb-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">DRAFT POLICY</div>
              <h2 className="text-xl font-bold text-foreground">Version 1.1 · Not published</h2>
            </div>
            <Badge tone="green">Current live · v1.0</Badge>
          </div>
          
          <div>
            <label className="flex items-center justify-between text-sm font-semibold text-foreground mb-4">
              Selection threshold 
              <input data-testid="input-threshold" className="w-16 bg-background border border-border rounded px-2 py-1 text-center font-normal focus:outline-none focus:border-primary" type="number" defaultValue={60} />
            </label>
            
            <div className="space-y-4">
              {(Object.keys(weights) as Action[]).map(a => (
                <div className="text-sm" key={a}>
                  <b className="block text-foreground mb-2">{a}</b>
                  <div className="flex gap-2">
                    {weights[a].map((w, i) => (
                      <label key={i} className="flex-1 flex flex-col gap-1 text-[10px] font-semibold text-muted-foreground uppercase text-center">
                        <span className="truncate" title={labels[i]}>{labels[i].split(" ")[0]}</span>
                        <input data-testid={`input-weight-${a}-${i}`} defaultValue={w} type="number" className="w-full bg-background border border-border rounded px-1 py-1 text-center font-normal text-foreground focus:outline-none focus:border-primary" />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
            <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
              Push timing
              <select data-testid="select-push-timing" className="bg-background border border-border rounded px-2 py-1.5 font-normal focus:outline-none focus:border-primary" defaultValue="Within 24 hours">
                <option>Within 24 hours</option><option>Next active session</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
              WhatsApp timing
              <select data-testid="select-wa-timing" className="bg-background border border-border rounded px-2 py-1.5 font-normal focus:outline-none focus:border-primary" defaultValue="After 48 hours">
                <option>After 48 hours</option><option>Never</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
              Max ignored pushes
              <input data-testid="input-max-pushes" className="bg-background border border-border rounded px-2 py-1.5 font-normal focus:outline-none focus:border-primary" defaultValue="2" type="number" />
            </label>
          </div>
          
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button onClick={() => setPublished(false)} data-testid="button-preview-customers">Preview affected customers</Button>
            <Button primary onClick={() => setPublished(true)} data-testid="button-publish-policy">Publish v1.1</Button>
          </div>
          
          {published && (
            <div className="bg-[#18794E]/10 text-[#18794E] border border-[#18794E]/20 p-3 rounded flex items-center gap-2 text-sm font-medium animate-in fade-in">
              <Check size={16} /> Draft published as simulated Version 1.1
            </div>
          )}
        </div>
        
        <div className="bg-background border border-border rounded-lg p-6 flex flex-col gap-6">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">CHANGE REVIEW</div>
            <h2 className="text-lg font-bold text-foreground">Before / after recommendations</h2>
          </div>
          
          <div className="space-y-3 flex-1">
            <div className="bg-card border border-border p-3 rounded text-sm flex items-center justify-between shadow-sm">
              <span className="font-semibold text-foreground w-32 truncate">Arjun Mehta</span>
              <b className="text-muted-foreground font-medium w-40 text-center">Add Funds</b>
              <ArrowRight size={14} className="text-border" />
              <b className="text-primary w-40 text-right">Create Pre-order</b>
            </div>
            <div className="bg-card border border-border p-3 rounded text-sm flex items-center justify-between shadow-sm">
              <span className="font-semibold text-foreground w-32 truncate">Nisha Kulkarni</span>
              <b className="text-muted-foreground font-medium w-40 text-center">Start MF Investing</b>
              <ArrowRight size={14} className="text-border" />
              <b className="text-primary w-40 text-right">Start MF Investing</b>
            </div>
          </div>
          
          <div className="border-t border-border pt-4">
            <h3 className="font-bold text-foreground mb-3 text-sm">Version history</h3>
            <div className="space-y-2 text-sm">
              <p className="flex justify-between text-foreground"><b className="font-semibold">v1.0</b> <span className="text-muted-foreground">Live · 06 Feb 2025</span></p>
              <p className="flex justify-between text-muted-foreground opacity-75"><b className="font-semibold">v0.9</b> <span>Archived · 28 Jan 2025</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const measurement = (
    <div className="animate-in fade-in duration-200">
      <SectionTitle title="Measurement" copy="Instrument the activation decision without pretending the outcome is already known." />
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-0" />
          <div className="relative z-10">
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">EXPERIMENT BRIEF</div>
            <h2 className="text-2xl font-bold text-foreground mb-3">Hypothesis</h2>
            <p className="text-foreground text-lg font-medium leading-relaxed mb-8">
              If FirstTrade selects a customer-safe next action from account state and behaviour, more customers will reach A2T without increasing unwanted contact or repeated nudges.
            </p>
            
            <div className="space-y-4">
              {[["Control","Cohort default action"],["Treatment","FirstTrade recommended action"],["Primary metric","A2T through pre-order or MF order"],["Success events","pre_order_submitted · mf_order_submitted · first_trade"],["Guardrails","nudge_dismissed · opt_out · contact_frequency_exceeded"]].map(x => (
                <div className="flex border-b border-border pb-3 last:border-0 text-sm" key={x[0]}>
                  <span className="w-1/3 text-muted-foreground">{x[0]}</span>
                  <b className="flex-1 font-semibold text-foreground">{x[1]}</b>
                </div>
              ))}
            </div>
            
            <div className="mt-6 bg-[#18794E]/10 text-[#18794E] border border-[#18794E]/20 p-3 rounded flex items-center justify-center gap-2 text-sm font-bold">
              <Check size={16} /> Experiment ready
            </div>
          </div>
        </div>
        
        <div className="bg-background border border-border rounded-lg p-6">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">EVENT TRAIL</div>
          <h2 className="text-xl font-bold text-foreground mb-6">What will be recorded</h2>
          
          <div className="space-y-4">
            {["decision_created", "nudge_previewed", "deep_link_opened", "pre_order_submitted", "mf_order_submitted", "a2t_achieved"].map((x, i) => (
              <div className="flex items-center gap-4 bg-card border border-border p-3 rounded shadow-sm" key={x}>
                <span className="w-6 h-6 rounded-full bg-background border border-border text-muted-foreground flex items-center justify-center text-xs font-bold">{i + 1}</span>
                <b className="flex-1 text-foreground font-mono text-sm">{x}</b>
                <span className="text-xs font-medium text-muted-foreground">Synthetic event schema</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const simulator = (
    <div className="animate-in fade-in duration-200">
      <SectionTitle title="Simulator" copy="Change account states and signals to see the policy respond in the same session." />
      
      <div className="bg-card border border-border rounded-lg shadow-sm mb-6 flex overflow-hidden">
        <div className="w-1/2 p-6 border-r border-border bg-background flex flex-col">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">DEMO SCENARIO</span>
          <div className="flex flex-wrap gap-2">
            {simulatorScenarios.map(s => (
              <button 
                data-testid={`button-scenario-${s.replace(/\s+/g, '-')}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${scenario === s ? 'bg-foreground text-card border-foreground' : 'bg-card text-muted-foreground border-border hover:border-muted-foreground/50'}`} 
                onClick={() => setScenario(s)} 
                key={s}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="w-1/2 p-6 flex flex-col justify-center items-start">
          <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">SELECTED RECOMMENDATION</div>
          <h2 className="text-3xl font-bold text-foreground mb-3">{recommendation}</h2>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded font-bold text-sm">
              {states.kra === false ? "Recovery only" : states.a2t ? "A2T achieved" : `${simScores[0].score} Action Fit Score`}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {states.kra === false ? "KRA was rejected. No score is calculated." : "Based on the highest eligible score under the current policy."}
          </p>
          <Button primary onClick={() => setStudio(true)} data-testid="button-open-studio-simulator">Open Nudge Studio <ArrowRight size={14} /></Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg shadow-sm">
          <div className="p-4 border-b border-border flex justify-between items-center bg-background">
            <h2 className="font-bold text-foreground">Account states</h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Editable</span>
          </div>
          <div className="p-4 space-y-1">
            {Object.entries(states).map(([k, v]) => (
              <label className="flex items-center justify-between p-2 hover:bg-background rounded cursor-pointer transition-colors" key={k}>
                <span className="text-sm font-medium text-foreground">
                  {k.replace("esign", "Post e-sign").replace("kra", "KRA approved").replace("ucc", "UCC Mapping").replace("mf", "MF Account").replace("exchange", "Exchange Approval").replace("a2t", "A2T achieved")}
                </span>
                <input 
                  data-testid={`checkbox-state-${k}`}
                  type="checkbox" 
                  checked={v} 
                  onChange={e => setStates({ ...states, [k]: e.target.checked })} 
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
              </label>
            ))}
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-lg shadow-sm">
          <div className="p-4 border-b border-border flex justify-between items-center bg-background">
            <h2 className="font-bold text-foreground">Signal categories</h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">0 to 1 normalized</span>
          </div>
          <div className="p-4 space-y-4">
            {labels.map((l, i) => { 
              const k = ["order", "watchlist", "mf", "segment", "funding"][i] as keyof Signals; 
              return (
                <label className="flex items-center gap-4" key={l}>
                  <span className="w-1/3 text-sm font-medium text-foreground truncate">{l}</span>
                  <input 
                    data-testid={`slider-signal-${k}`}
                    type="range" 
                    min="0" max="1" step=".05" 
                    value={signals[k]} 
                    onChange={e => setSignals({ ...signals, [k]: Number(e.target.value) })} 
                    className="flex-1 accent-primary cursor-pointer"
                  />
                  <b className="w-10 text-right text-sm font-semibold text-primary">{signals[k].toFixed(2)}</b>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden selection:bg-primary/20">
      <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-primary text-primary-foreground flex items-center justify-center shadow-sm"><Zap size={16} fill="currentColor" /></div>
          <div><div className="font-bold text-sm text-foreground leading-tight">FirstTrade</div><div className="text-xs font-medium text-muted-foreground">Decision centre</div></div>
        </div>
        <div className="p-4 border-b border-border flex items-center gap-3 cursor-pointer hover:bg-background transition-colors">
          <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-xs font-bold text-foreground">PM</div>
          <div className="flex-1 min-w-0"><div className="font-semibold text-sm text-foreground leading-tight truncate">Activation pod</div><div className="text-xs font-medium text-muted-foreground truncate">India · Production</div></div>
          <ChevronDown size={14} className="text-muted-foreground" />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ label, icon: Icon }) => (
            <button 
              key={label} 
              data-testid={`nav-${label.replace(/\s+/g, '-')}`}
              onClick={() => setArea(label)} 
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${area === label ? 'bg-background text-primary' : 'text-muted-foreground hover:bg-background hover:text-foreground'}`}
            >
              <Icon size={16} className={area === label ? 'text-primary' : 'text-muted-foreground'} />
              {label}
              {label === "Decisions" && <span className="ml-auto bg-card border border-border text-foreground font-semibold text-[10px] py-0.5 px-2 rounded-full">2.6k</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border text-xs font-medium text-muted-foreground space-y-2 bg-background/50">
          <div className="flex items-center gap-2"><CircleAlert size={14} /> Policy v1.0</div>
          <div className="flex items-center gap-2"><UserRound size={14} /> PM workspace</div>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-muted-foreground">Activation</span> <span className="text-border">/</span> <span className="text-foreground">{area}</span>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-background border border-border px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#18794E]" /> All systems synthetic
            </div>
            <button className="text-muted-foreground hover:text-foreground transition-colors"><Bell size={18} /></button>
            <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-xs font-bold text-foreground">AR</div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-5xl mx-auto space-y-6 pb-12">
            {area === "Overview" ? overview : area === "Cohorts" ? cohorts : area === "Decisions" ? decisions : area === "Policy Studio" ? policy : area === "Measurement" ? measurement : simulator}
          </div>
        </div>
      </main>
      
      {studio && <NudgeStudio customer={selected} onClose={() => setStudio(false)} onApprove={() => { setPublished(true); setStudio(false); }} />}
    </div>
  );
}

function DecisionTable({ onSelect }: { onSelect: (c: typeof customers[number]) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="bg-background border-b border-border text-muted-foreground font-semibold text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 font-semibold">Customer</th>
            <th className="px-4 py-3 font-semibold">Cohort</th>
            <th className="px-4 py-3 font-semibold">Recommended next action</th>
            <th className="px-4 py-3 font-semibold">Why</th>
            <th className="px-4 py-3 font-semibold">Channel</th>
            <th className="px-4 py-3 font-semibold">Policy</th>
            <th className="px-4 py-3 font-semibold"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {customers.slice(0, 3).map(c => (
            <tr key={c.id} className="hover:bg-background/50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-bold text-foreground">{c.name}</div>
                <div className="text-xs font-medium text-muted-foreground mt-0.5">{c.id}</div>
              </td>
              <td className="px-4 py-3 text-foreground font-medium">{c.cohort}</td>
              <td className="px-4 py-3"><Badge>{c.action}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground whitespace-normal min-w-[200px] text-sm leading-snug">{c.why}</td>
              <td className="px-4 py-3 text-foreground font-medium">{c.channel}</td>
              <td className="px-4 py-3 text-muted-foreground font-medium">{c.policy}</td>
              <td className="px-4 py-3 text-right">
                <button 
                  data-testid={`link-view-decision-${c.id}`}
                  className="inline-flex items-center gap-1 text-primary font-semibold hover:underline" 
                  onClick={() => onSelect(c)}
                >
                  View decision <ChevronRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detail({ customer, expanded, setExpanded, onStudio }: { customer: typeof customers[number]; expanded: boolean; setExpanded: (x: boolean) => void; onStudio: () => void }) { 
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm h-full flex flex-col">
      <div className="p-6 border-b border-border flex justify-between items-start bg-background">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center text-lg font-bold text-foreground shadow-sm">{customer.initials}</div>
          <div>
            <h2 className="text-xl font-bold text-foreground leading-tight">{customer.name}</h2>
            <p className="text-sm font-medium text-muted-foreground mt-1">{customer.id} · {customer.cohort} · {customer.state}</p>
          </div>
        </div>
        <Button onClick={onStudio} data-testid="button-open-nudge-studio"><Sparkles size={14} className="text-primary" /> Open Nudge Studio</Button>
      </div>
      
      <div className="p-6 border-b border-border bg-card">
        <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">RECOMMENDED NEXT ACTION</div>
        <h1 className="text-3xl font-bold text-foreground mb-2">{customer.action}</h1>
        <p className="text-muted-foreground font-medium">{customer.why}</p>
      </div>
      
      <div className="grid grid-cols-2 gap-8 p-6 flex-1 min-h-0 overflow-y-auto">
        <div>
          <h3 className="font-bold text-foreground mb-5">Decision rationale</h3>
          <div className="relative pl-5 space-y-5 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
            <div className="relative text-sm">
              <span className="absolute left-[-24px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
              <p className="text-foreground leading-relaxed"><b className="font-semibold text-muted-foreground block mb-0.5">Today · 10:42</b>Decision created from latest account state</p>
            </div>
            <div className="relative text-sm">
              <span className="absolute left-[-23px] top-1.5 w-2 h-2 rounded-full bg-border" />
              <p className="text-foreground leading-relaxed"><b className="font-semibold text-muted-foreground block mb-0.5">Yesterday · 18:20</b>Instrument selected in research</p>
            </div>
            <div className="relative text-sm">
              <span className="absolute left-[-23px] top-1.5 w-2 h-2 rounded-full bg-border" />
              <p className="text-foreground leading-relaxed"><b className="font-semibold text-muted-foreground block mb-0.5">03 Feb · 09:12</b>Post e-sign completed</p>
            </div>
          </div>
          
          <div className="mt-8 bg-background border border-border rounded-lg p-4 text-sm">
            <div className="text-muted-foreground font-medium mb-1">Default action</div>
            <div className="font-bold text-foreground mb-4">Create Pre-order</div>
            <div className="text-muted-foreground font-medium mb-1">Retained / replaced</div>
            <div className="font-bold text-primary">Replaced by Add Funds because funding flow is already in progress.</div>
          </div>
        </div>
        
        <div>
          <h3 className="font-bold text-foreground mb-1 flex items-baseline gap-2">
            Action Fit Score <strong className="text-2xl text-primary">{customer.score}</strong>
          </h3>
          <p className="text-sm font-medium text-muted-foreground mb-6">Supporting evidence under Policy v1.0</p>
          
          <div className="space-y-4 mb-5">
            {labels.map((x, i) => (
              <div key={x} className="flex items-center gap-3 text-sm">
                <span className="w-1/3 text-muted-foreground font-medium truncate">{x}</span>
                <div className="flex-1 h-2 bg-background border border-border rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${[70, 80, 40, 30, 80][i]}%` }} />
                </div>
                <b className="w-8 text-right text-foreground font-bold">{[.7, .8, .4, .3, .8][i].toFixed(2)}</b>
              </div>
            ))}
          </div>
          
          <button 
            data-testid="button-toggle-calculation"
            className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase tracking-wider" 
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide score calculation" : "Show score calculation"} 
            <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          
          {expanded && (
            <div className="mt-4 text-sm bg-primary/5 text-primary p-4 rounded-lg border border-primary/20 leading-relaxed font-medium">
              Base 20 + weighted signals 56 = <b>76</b>. Completed actions removed before selection; threshold is 60.
            </div>
          )}
        </div>
      </div>
      
      <div className="p-5 border-t border-border bg-background flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground text-sm mb-1">Customer-safe nudge preview</h3>
          <p className="text-sm text-foreground italic my-1 font-medium">“Your account is ready for the next step. Add funds to continue when you’re ready.”</p>
          <span className="text-xs font-medium text-muted-foreground">In-app · next active session · suppress after 2 ignored pushes</span>
        </div>
        <Button onClick={onStudio} data-testid="button-edit-workflow-bottom">Edit workflow <ArrowRight size={14} /></Button>
      </div>
    </div>
  );
}

function NudgeStudio({ customer, onClose, onApprove }: { customer: typeof customers[number]; onClose: () => void; onApprove: () => void }) { 
  const [copy, setCopy] = useState("Your account is ready for the next step. Add funds to continue when you’re ready."); 
  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-4xl max-h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border flex justify-between items-start bg-background">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">NUDGE STUDIO · LOCAL DRAFT</div>
            <h2 className="text-2xl font-bold text-foreground">{customer.action}</h2>
          </div>
          <button data-testid="button-close-studio" className="p-2 text-muted-foreground hover:bg-border/50 rounded-lg transition-colors" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-2 gap-10 mb-10">
            <div>
              <h3 className="font-bold text-foreground mb-3 text-lg">Rationale & delivery logic</h3>
              <p className="text-sm font-medium text-muted-foreground mb-6 leading-relaxed">Selected because the customer has started a funding flow and has no completed A2T action.</p>
              
              <div className="space-y-4 text-sm bg-background border border-border rounded-lg p-4">
                <div className="flex"><b className="w-1/3 text-foreground font-semibold">Deep-link</b><span className="flex-1 text-muted-foreground font-mono text-xs mt-0.5">/activate/add-funds</span></div>
                <div className="flex"><b className="w-1/3 text-foreground font-semibold">Primary channel</b><span className="flex-1 text-muted-foreground">In-app, next active session</span></div>
                <div className="flex"><b className="w-1/3 text-foreground font-semibold">Fallback</b><span className="flex-1 text-muted-foreground">Push after 24 hours; WhatsApp after 48 hours</span></div>
                <div className="flex"><b className="w-1/3 text-foreground font-semibold">Suppression</b><span className="flex-1 text-muted-foreground">Stop on A2T, opt-out, or two ignored pushes</span></div>
              </div>
            </div>
            
            <div className="bg-background border border-border rounded-xl p-6 flex flex-col items-center justify-center">
              <div className="flex gap-6 mb-6 text-sm w-full justify-center">
                <b className="text-foreground border-b-2 border-foreground pb-1">In-app</b>
                <span className="text-muted-foreground font-medium pb-1">Push</span>
                <span className="text-muted-foreground font-medium pb-1">WhatsApp</span>
              </div>
              <div className="bg-card border border-border rounded-xl shadow-md p-5 w-full max-w-[280px]">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <MessageSquare size={18} />
                </div>
                <b className="block text-foreground mb-2 text-sm font-bold">One useful next step</b>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{copy}</p>
                <button className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm">Continue</button>
              </div>
            </div>
          </div>
          
          <div className="mb-8 border-t border-border pt-8">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2 text-lg">
              <Sparkles size={18} className="text-primary" />
              Safe local mock AI variants
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {["Your account is ready for the next step. Add funds to continue when you’re ready.", "You’ve started setting up your account. Add funds whenever it suits you.", "A small next step is ready: add funds to keep your activation moving."].map((v, i) => (
                <button 
                  data-testid={`button-variant-${i}`}
                  key={v} 
                  onClick={() => setCopy(v)}
                  className={`text-left p-4 rounded-lg text-sm transition-all border ${copy === v ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-muted-foreground bg-card shadow-sm'}`}
                >
                  <span className="block text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">Variant {i + 1}</span>
                  <span className="text-foreground leading-relaxed font-medium">{v}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-foreground mb-2">PM-approved copy</label>
            <textarea 
              data-testid="textarea-nudge-copy"
              className="w-full bg-card border border-border rounded-lg p-4 text-sm font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none transition-all shadow-sm" 
              rows={3} 
              value={copy} 
              onChange={e => setCopy(e.target.value)} 
            />
          </div>
        </div>
        
        <div className="p-5 border-t border-border bg-background flex justify-end gap-3">
          <Button onClick={onClose} data-testid="button-save-draft">Save draft</Button>
          <Button primary onClick={onApprove} data-testid="button-approve-workflow"><Send size={14} /> Approve workflow</Button>
        </div>
      </div>
    </div>
  );
}