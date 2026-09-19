import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  GitBranch,
  Info,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  ACTIONS,
  type Action,
  type Channel,
  createDecision,
  CUSTOMER_PROFILES,
  DEFAULT_POLICY,
  decisionsFor,
  type Decision,
  type DecisionAction,
  type Policy,
  profileFromSimulator,
  RECOVERY_ACTION,
  type SignalKey,
  SIGNAL_KEYS,
  SIGNAL_LABELS,
  SCENARIO_PRESETS,
  SIMULATOR_SCENARIOS,
  stageData,
  type SimulatorScenario,
  type SimulatorState,
} from "@/lib/firsttrade";

type Area = "Overview" | "Cohorts" | "Decisions" | "Policy Studio" | "Measurement";
type Tone = "blue" | "green" | "red" | "slate";
type SimulatorField = keyof SimulatorState | "scenario";
type ActionFilter = "All actions" | DecisionAction;

const nav = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Cohorts", icon: GitBranch },
  { label: "Decisions", icon: Target },
  { label: "Policy Studio", icon: Settings2 },
  { label: "Measurement", icon: BarChart3 },
] as const;

function Badge({ children, tone = "blue" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    blue: "bg-primary/10 text-primary border-primary/20",
    green: "bg-[#18794E]/10 text-[#18794E] border-[#18794E]/20",
    red: "bg-destructive/10 text-destructive border-destructive/20",
    slate: "bg-background text-muted-foreground border-border",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${tones[tone]}`}>{children}</span>;
}

function TooltipHint({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        data-testid={`button-tooltip-${label.toLowerCase().replace(/\s+/g, "-")}`}
        aria-label={label}
        className="ml-1 text-muted-foreground hover:text-primary transition-colors duration-150"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Info size={13} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="tooltip"
            className="absolute left-0 top-5 z-30 w-56 rounded-md border border-border bg-card p-2 text-left text-xs font-medium leading-relaxed text-muted-foreground shadow-lg"
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function Button({
  children,
  onClick,
  primary = false,
  disabled = false,
  testId,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 border active:translate-y-px ${primary ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm" : "bg-card text-foreground border-border hover:bg-background shadow-sm"} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
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

function AnimatedMetric({ value, reducedMotion }: { value: number; reducedMotion: boolean }) {
  const [displayValue, setDisplayValue] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value);
      return undefined;
    }
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 720);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, value]);

  return <span>{displayValue.toLocaleString()}</span>;
}

function actionTone(action: DecisionAction): Tone {
  if (action === RECOVERY_ACTION) return "red";
  if (action === "No recommendation") return "slate";
  return "blue";
}

function clonePolicy(policy: Policy): Policy {
  return {
    ...policy,
    weights: ACTIONS.reduce((weights, action) => {
      weights[action] = { ...policy.weights[action] };
      return weights;
    }, {} as Policy["weights"]),
    channelPlan: { ...policy.channelPlan },
    suppressionRules: [...policy.suppressionRules],
  };
}

function policyWeightTotal(policy: Policy, action: Action) {
  return SIGNAL_KEYS.reduce((total, key) => total + policy.weights[action][key], 0);
}

type PolicyChange = {
  id: string;
  name: string;
  before: DecisionAction;
  after: DecisionAction;
};

type PolicyPreview = {
  changed: PolicyChange[];
  evaluatedCount: number;
};

export default function Home() {
  const reducedMotion = Boolean(useReducedMotion());
  const [area, setArea] = useState<Area>("Overview");
  const [selectedId, setSelectedId] = useState(CUSTOMER_PROFILES[0].id);
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("All actions");
  const [decisionFilterOpen, setDecisionFilterOpen] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [studioTarget, setStudioTarget] = useState<{ id: string } | null>(null);
  const [copyOverrides, setCopyOverrides] = useState<Record<string, string>>({});
  const [workflowStatuses, setWorkflowStatuses] = useState<Record<string, "Draft" | "Approved">>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const [livePolicy, setLivePolicy] = useState<Policy>(() => clonePolicy(DEFAULT_POLICY));
  const [draftPolicy, setDraftPolicy] = useState<Policy>(() => ({ ...clonePolicy(DEFAULT_POLICY), version: "1.1" }));
  const [policyDirty, setPolicyDirty] = useState(false);
  const [policyPreview, setPolicyPreview] = useState<PolicyPreview | null>(null);
  const [policyNotice, setPolicyNotice] = useState("");

  const decisions = useMemo(() => decisionsFor(livePolicy), [livePolicy]);
  const decisionsById = useMemo(() => new Map(decisions.map((decision) => [decision.customer.id, decision])), [decisions]);

  const filteredDecisions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return decisions.filter((decision) => {
      const matchesCohort = !cohortFilter || decision.cohort === cohortFilter;
      const matchesAction = actionFilter === "All actions" || decision.selectedAction === actionFilter;
      const searchable = `${decision.customer.name} ${decision.customer.id} ${decision.cohort} ${decision.selectedAction} ${decision.stateLabel}`.toLowerCase();
      return matchesCohort && matchesAction && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
  }, [actionFilter, cohortFilter, decisions, search]);

  const selectedDecision = decisionsById.get(selectedId) ?? decisions[0];
  const visibleSelectedDecision = filteredDecisions.find((decision) => decision.customer.id === selectedId) ?? filteredDecisions[0] ?? null;
  const studioDecision = studioTarget
    ? decisionsById.get(studioTarget.id) ?? selectedDecision
    : null;

  const draftDecisions = useMemo(() => decisionsFor(draftPolicy), [draftPolicy]);
  const policyValid = draftPolicy.threshold >= 0
    && draftPolicy.threshold <= 100
    && ACTIONS.every((action) => policyWeightTotal(draftPolicy, action) === 80);

  useEffect(() => {
    if (filteredDecisions.length > 0 && !filteredDecisions.some((decision) => decision.customer.id === selectedId)) {
      setSelectedId(filteredDecisions[0].customer.id);
    }
  }, [filteredDecisions, selectedId]);

  useEffect(() => {
    if (window.localStorage.getItem("firsttrade-signal-tour-complete") !== "true") {
      setTourOpen(true);
    }
  }, []);

  const openCustomerDecision = (id: string, nextArea: Area = "Decisions") => {
    setSelectedId(id);
    setArea(nextArea);
    setExpandedCustomerId(null);
  };

  const openCohort = (cohort: string) => {
    const match = decisions.find((decision) => decision.cohort === cohort);
    setCohortFilter(cohort);
    setSearch("");
    setActionFilter("All actions");
    setDecisionFilterOpen(false);
    if (match) setSelectedId(match.customer.id);
    setArea("Decisions");
    setMobileMenuOpen(false);
  };

  const openStudio = (decision: Decision) => {
    setStudioTarget({ id: decision.customer.id });
  };

  const updateDraftThreshold = (value: number) => {
    setDraftPolicy((current) => ({ ...current, threshold: value }));
    setPolicyDirty(true);
    setPolicyPreview(null);
  };

  const updateDraftWeight = (action: Action, key: SignalKey, value: number) => {
    setDraftPolicy((current) => ({
      ...current,
      weights: {
        ...current.weights,
        [action]: { ...current.weights[action], [key]: Math.max(0, Number.isFinite(value) ? value : 0) },
      },
    }));
    setPolicyDirty(true);
    setPolicyPreview(null);
  };

  const previewPolicy = () => {
    if (!policyValid) return;
    const before = decisionsFor(livePolicy);
    const after = draftDecisions;
    const changed = after.flatMap((decision) => {
      const previous = before.find((candidate) => candidate.customer.id === decision.customer.id);
      return previous && previous.selectedAction !== decision.selectedAction
        ? [{ id: decision.customer.id, name: decision.customer.name, before: previous.selectedAction, after: decision.selectedAction }]
        : [];
    });
    setPolicyPreview({ changed, evaluatedCount: after.length });
  };

  const publishPolicy = () => {
    if (!policyValid) return;
    const nextPolicy = { ...clonePolicy(draftPolicy), version: "1.1" };
    setLivePolicy(nextPolicy);
    setDraftPolicy(clonePolicy(nextPolicy));
    setPolicyDirty(false);
    setPolicyPreview(null);
    setPolicyNotice("Live simulated v1.1");
    window.setTimeout(() => setPolicyNotice(""), 2200);
  };

  const saveNudgeDraft = (decisionId: string, copy: string) => {
    setCopyOverrides((current) => ({ ...current, [decisionId]: copy }));
  };

  const approveWorkflow = (decisionId: string) => {
    setWorkflowStatuses((current) => ({ ...current, [decisionId]: "Approved" }));
  };

  const updateActionFilter = (nextFilter: ActionFilter) => {
    setActionFilter(nextFilter);
    if (nextFilter !== "All actions") setCohortFilter(null);
  };

  const navigate = (nextArea: Area) => {
    setArea(nextArea);
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
  };

  const dismissTour = () => {
    window.localStorage.setItem("firsttrade-signal-tour-complete", "true");
    setTourOpen(false);
  };

  const advanceTour = () => {
    const areas: Area[] = ["Overview", "Decisions", "Policy Studio"];
    if (tourStep >= areas.length - 1) {
      dismissTour();
      return;
    }
    const nextStep = tourStep + 1;
    setTourStep(nextStep);
    navigate(areas[nextStep]);
  };

  const page = area === "Overview"
    ? <OverviewPage decisions={decisions} onOpenQueue={() => setArea("Decisions")} onSelect={openCustomerDecision} reducedMotion={reducedMotion} />
    : area === "Cohorts"
      ? <CohortsPage onOpenCohort={openCohort} onRecovery={() => openCohort("New explorer")} reducedMotion={reducedMotion} />
      : area === "Decisions"
        ? (
          <DecisionsPage
            decisions={filteredDecisions}
            selected={visibleSelectedDecision}
            selectedId={selectedId}
            search={search}
            cohortFilter={cohortFilter}
            actionFilter={actionFilter}
            filterOpen={decisionFilterOpen}
            expanded={expandedCustomerId === selectedId}
            onSearch={setSearch}
            onClearFilter={() => setCohortFilter(null)}
            onActionFilter={updateActionFilter}
            onToggleFilter={() => setDecisionFilterOpen((current) => !current)}
            onSelect={(id) => openCustomerDecision(id)}
            onToggleExpanded={() => setExpandedCustomerId((current) => current === selectedId ? null : selectedId)}
            onStudio={openStudio}
            reducedMotion={reducedMotion}
          />
        )
        : area === "Policy Studio"
          ? (
            <PolicyStudioPage
              livePolicy={livePolicy}
              draftPolicy={draftPolicy}
              dirty={policyDirty}
              valid={policyValid}
              preview={policyPreview}
              notice={policyNotice}
              onThreshold={updateDraftThreshold}
              onWeight={updateDraftWeight}
              onPreview={previewPolicy}
              onPublish={publishPolicy}
              reducedMotion={reducedMotion}
            />
          )
          : <MeasurementPage decision={selectedDecision} reducedMotion={reducedMotion} />;

  return (
    <div className="app-shell flex h-screen w-full bg-background text-foreground font-sans overflow-hidden selection:bg-primary/20">
      <div className="ambient-layer" aria-hidden="true">
        <motion.span className="ambient-orb ambient-orb-one" animate={reducedMotion ? undefined : { y: [0, -26, 0], x: [0, 14, 0], rotate: [0, 8, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />
        <motion.span className="ambient-orb ambient-orb-two" animate={reducedMotion ? undefined : { y: [0, 30, 0], x: [0, -18, 0], rotate: [0, -12, 0] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }} />
        <motion.span className="ambient-orb ambient-orb-three" animate={reducedMotion ? undefined : { y: [0, -18, 0], scale: [1, 1.08, 1] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
        <span className="ambient-grid" />
      </div>
      <aside className="aurora-sidebar hidden lg:flex w-64 border-r border-border bg-card flex-col shrink-0 z-10">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="brand-mark w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm"><Zap size={16} fill="currentColor" /></div>
          <div><div className="font-bold text-sm text-foreground leading-tight tracking-tight">FirstTrade</div><div className="text-xs font-medium text-muted-foreground">Decision orbit</div></div>
        </div>
        <div className="p-4 border-b border-border flex items-center gap-3 cursor-pointer hover:bg-background transition-colors">
          <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-xs font-bold text-foreground">PM</div>
          <div className="flex-1 min-w-0"><div className="font-semibold text-sm text-foreground leading-tight truncate">Activation pod</div><div className="text-xs font-medium text-muted-foreground truncate">India · Production</div></div>
          <ChevronDown size={14} className="text-muted-foreground" />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ label, icon: Icon }) => (
            <button
              type="button"
              key={label}
              data-testid={`nav-${label.replace(/\s+/g, "-")}`}
              onClick={() => navigate(label)}
              className={`nav-orbit-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${area === label ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
            >
              <Icon size={16} className={area === label ? "text-primary" : "text-muted-foreground"} />
              {label}
              {label === "Decisions" && <span className="ml-auto bg-card border border-border text-foreground font-semibold text-[10px] py-0.5 px-2 rounded-full">{decisions.length}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border text-xs font-medium text-muted-foreground space-y-2 bg-background/50">
          <div className="flex items-center gap-2"><CircleAlert size={14} /> Policy v{livePolicy.version}</div>
          <div className="flex items-center gap-2"><UserRound size={14} /> PM workspace</div>
        </div>
      </aside>

      <main className="app-content flex-1 flex flex-col min-w-0 relative z-10">
        <header className="topbar-glass h-16 border-b border-border bg-card px-4 sm:px-6 flex items-center justify-between shrink-0 relative">
          <div className="flex items-center gap-2 text-sm font-medium min-w-0">
            <button type="button" data-testid="button-mobile-menu" aria-label="Open navigation menu" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground transition-colors">
              <Menu size={18} />
            </button>
            <span className="text-muted-foreground">Activation</span> <span className="text-border">/</span> <span className="text-foreground">{area}</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground bg-background border border-border px-2 py-1 rounded-full">
              <span className="status-pulse w-1.5 h-1.5 rounded-full bg-[#4DFFD2]" /> All systems synthetic
            </div>
            <button type="button" data-testid="button-replay-tour" aria-label="Replay signal tour" onClick={() => { setTourStep(0); setTourOpen(true); navigate("Overview"); }} className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
              <Sparkles size={14} /> Guide
            </button>
            <div className="relative">
              <button type="button" data-testid="button-notifications" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((current) => !current)} className="text-muted-foreground hover:text-foreground transition-colors"><Bell size={18} /></button>
              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div initial={reducedMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reducedMotion ? 0 : 0.15, ease: "easeOut" }} role="dialog" aria-label="Notifications" data-testid="panel-notifications" className="absolute right-0 top-8 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-3"><b className="text-sm text-foreground">Notifications</b><Badge tone="green">Synthetic</Badge></div>
                    <div className="space-y-3 text-xs">
                      {["Policy v" + livePolicy.version + " is live across " + decisions.length + " decisions.", "UCC pending cohort has a safe product exploration path.", "A2T suppression is active after completed actions."].map((notification) => <div className="border-t border-border pt-3 first:border-0 first:pt-0 text-muted-foreground" key={notification}>{notification}</div>)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-xs font-bold text-foreground">AR</div>
          </div>
        </header>

        <div className="app-scroll flex-1 overflow-y-auto p-4 sm:p-8 relative">
          <div className="max-w-5xl mx-auto space-y-6 pb-12">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={area}
                initial={reducedMotion ? false : { y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { y: -3 }}
                transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }}
              >
                {page}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.button type="button" aria-label="Close navigation menu" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reducedMotion ? undefined : { opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" />
            <motion.aside initial={reducedMotion ? false : { x: -280 }} animate={{ x: 0 }} exit={reducedMotion ? undefined : { x: -280 }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }} className="aurora-sidebar fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] flex-col border-r border-border bg-card shadow-2xl lg:hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="w-7 h-7 rounded bg-primary text-primary-foreground flex items-center justify-center"><Zap size={16} fill="currentColor" /></div><div><div className="font-bold text-sm text-foreground">FirstTrade</div><div className="text-xs text-muted-foreground">Decision centre</div></div></div>
                <button type="button" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {nav.map(({ label, icon: Icon }) => <button type="button" key={label} data-testid={`mobile-nav-${label.replace(/\s+/g, "-")}`} onClick={() => navigate(label)} className={`nav-orbit-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${area === label ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}><Icon size={16} />{label}{label === "Decisions" && <span className="ml-auto bg-card border border-border text-foreground font-semibold text-[10px] py-0.5 px-2 rounded-full">{decisions.length}</span>}</button>)}
              </nav>
              <div className="p-4 border-t border-border text-xs font-medium text-muted-foreground space-y-2"><div className="flex items-center gap-2"><CircleAlert size={14} /> Policy v{livePolicy.version}</div><div className="flex items-center gap-2"><UserRound size={14} /> PM workspace</div></div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {studioDecision && (
          <NudgeStudio
            key={`${studioDecision.customer.id}-${studioDecision.selectedAction}`}
            decision={studioDecision}
            initialCopy={copyOverrides[studioDecision.customer.id] ?? studioDecision.copyVariants[0] ?? "No customer-facing copy is available for this state."}
            workflowStatus={workflowStatuses[studioDecision.customer.id] ?? "Draft"}
            onClose={() => setStudioTarget(null)}
            onSaveDraft={(copy) => saveNudgeDraft(studioDecision.customer.id, copy)}
            onApprove={() => approveWorkflow(studioDecision.customer.id)}
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tourOpen && <CoachmarkTour step={tourStep} onAdvance={advanceTour} onDismiss={dismissTour} reducedMotion={reducedMotion} />}
      </AnimatePresence>
    </div>
  );
}

function OverviewPage({
  decisions,
  onOpenQueue,
  onSelect,
  reducedMotion,
}: {
  decisions: Decision[];
  onOpenQueue: () => void;
  onSelect: (id: string) => void;
  reducedMotion: boolean;
}) {
  const priority = decisions.filter((decision) => decision.selectedAction !== "No recommendation").slice(0, 3);
  return (
    <>
      <section className="orbital-hero overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="eyebrow-chip mb-5"><span className="live-dot" /> LIVE ACTIVATION INTELLIGENCE</div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.05em] text-foreground leading-[0.98]">Make every <span className="hero-gradient-text">next move</span> feel obvious.</h1>
          <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-muted-foreground">FirstTrade turns activation signals into a single, customer-safe action—so momentum never quietly disappears from the journey.</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button primary onClick={onOpenQueue} testId="button-open-decision-queue-hero" className="hero-primary-button"><Zap size={15} fill="currentColor" /> Enter decision queue <ArrowRight size={15} /></Button>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-3 py-2 rounded-full border border-border bg-background/50"><span className="status-pulse w-2 h-2 rounded-full bg-[#4DFFD2]" /> 98.4% signal coverage</div>
          </div>
        </div>
        <div className="hero-orbit-scene" aria-hidden="true">
          <motion.div className="orbit-ring orbit-ring-one" animate={reducedMotion ? undefined : { rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} />
          <motion.div className="orbit-ring orbit-ring-two" animate={reducedMotion ? undefined : { rotate: -360 }} transition={{ duration: 22, repeat: Infinity, ease: "linear" }} />
          <motion.div className="orbit-node orbit-node-cyan" animate={reducedMotion ? undefined : { y: [0, -10, 0], x: [0, 8, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}><Target size={18} /></motion.div>
          <motion.div className="orbit-node orbit-node-violet" animate={reducedMotion ? undefined : { y: [0, 10, 0], x: [0, -6, 0] }} transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}><Sparkles size={18} /></motion.div>
          <motion.div className="signal-core" animate={reducedMotion ? undefined : { scale: [1, 1.1, 1], boxShadow: ["0 0 0 0 rgba(105,234,255,0.25)", "0 0 0 18px rgba(105,234,255,0)", "0 0 0 0 rgba(105,234,255,0)"] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}><Zap size={26} fill="currentColor" /></motion.div>
          <div className="orbit-readout"><span>PRIMARY SIGNAL</span><b>Funding intent</b><em>+ 0.80</em></div>
        </div>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {[
          ["Customers ready for a next action", 2667, "metric-1", "cyan"],
          ["A2T successes this journey", 1184, "metric-2", "violet"],
          ["Better-than-default decisions", 318, "metric-3", "lime"],
        ].map(([label, value, testId]) => (
          <motion.div
            key={label}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}
            whileHover={reducedMotion ? undefined : { y: -5, scale: 1.01 }}
            className={`metric-card metric-card--${testId === "metric-1" ? "cyan" : testId === "metric-2" ? "violet" : "lime"} border border-border p-5 rounded-2xl shadow-sm`}
          >
            <div className="metric-card__shine" />
            <div className="relative z-10 text-sm text-muted-foreground mb-2">{label}</div>
            <div className="relative z-10 text-3xl font-bold tracking-tight text-foreground" data-testid={testId}><AnimatedMetric value={value as number} reducedMotion={reducedMotion} /></div>
            <div className="relative z-10 mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><span className="metric-trend">↗</span> {testId === "metric-1" ? "12% since last week" : testId === "metric-2" ? "14.8% conversion" : "trusted policy overrides"}</div>
          </motion.div>
        ))}
      </div>

      <div className="hud-panel bg-card border border-border rounded-2xl shadow-sm mt-6">
        <div className="p-4 border-b border-border flex justify-between items-end">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">ACTIVATION FLOW</div>
            <h2 className="text-lg font-bold text-foreground">Where customers pause</h2>
          </div>
          <span className="text-sm text-muted-foreground">Last 7 days · 8,412 accounts</span>
        </div>
        <div className="p-6 grid grid-cols-2 gap-6 sm:flex sm:items-start sm:justify-between relative overflow-hidden">
          <motion.div
            aria-hidden="true"
            initial={reducedMotion ? { left: "8%" } : { left: "8%", opacity: 0 }}
            animate={reducedMotion ? { left: "8%", opacity: 0 } : { left: "92%", opacity: [0, 1, 1, 0] }}
            transition={{ duration: reducedMotion ? 0 : 1.05, delay: reducedMotion ? 0 : 0.15, ease: "easeInOut", times: [0, 0.12, 0.82, 1] }}
            className="absolute top-[3.55rem] z-20 hidden h-2 w-2 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(23,105,224,0.12)] sm:block"
          />
          {["Post e-sign", "KRA", "UCC Mapping", "MF Account", "Exchange Approval", "A2T"].map((label, index) => (
            <div className="flex flex-col items-center relative z-10 sm:flex-1" key={label}>
              <div className="text-xl font-bold text-foreground mb-2">{[8412, 7901, 6540, 4862, 3274, 1184][index].toLocaleString()}</div>
              <div className="w-full px-2 mb-3">
                <div className="h-2 bg-background border border-border rounded-full overflow-hidden">
                  <motion.div
                    initial={reducedMotion ? false : { width: 0 }}
                    animate={{ width: `${100 - index * 12}%` }}
                    transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : index * 0.04, ease: "easeOut" }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
              </div>
              <span className="text-xs font-medium text-muted-foreground text-center">{label}</span>
            </div>
          ))}
          <div className="absolute top-[3.25rem] left-0 hidden w-full justify-between px-[8%] pointer-events-none text-border sm:flex">
            {[1, 2, 3, 4, 5].map((index) => <ArrowRight key={index} size={16} />)}
          </div>
        </div>
      </div>

      <div className="hud-panel bg-card border border-border rounded-2xl shadow-sm mt-6">
        <div className="p-4 border-b border-border flex justify-between items-center bg-background">
          <div>
           <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">QUEUE · {decisions.length} DECISIONS</div>
            <h2 className="text-lg font-bold text-foreground">Priority Decisions</h2>
          </div>
          <Button onClick={onOpenQueue} testId="button-open-decision-queue">Open decision queue <ArrowRight size={14} /></Button>
        </div>
         <DecisionTable decisions={priority} onSelect={onSelect} reducedMotion={reducedMotion} animateRows />
      </div>
    </>
  );
}

function CohortsPage({
  onOpenCohort,
  onRecovery,
  reducedMotion,
}: {
  onOpenCohort: (cohort: string) => void;
  onRecovery: () => void;
  reducedMotion: boolean;
}) {
  return (
    <>
      <SectionTitle title="Cohorts" copy="Understand the externally pending step, then choose the safest customer action still available." />
      <div className="space-y-4">
        {stageData.map((stage, index) => (
          <motion.div
            key={stage.title}
            initial={reducedMotion ? false : { opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, delay: reducedMotion ? 0 : index * 0.07, ease: "easeOut" }}
            whileHover={reducedMotion ? undefined : { y: -2 }}
            className="group bg-card border border-border rounded-lg shadow-sm p-5 flex gap-6 relative transition-shadow hover:shadow-md"
          >
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-xs font-bold text-foreground mb-2">{index + 1}</div>
              {index !== stageData.length - 1 && (
                <motion.div
                  initial={reducedMotion ? false : { scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: reducedMotion ? 0 : 0.45, ease: "easeOut" }}
                  className="w-px bg-border flex-1 origin-top"
                />
              )}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-4 gap-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">STAGE {index + 1}</div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-3 flex-wrap">
                    {stage.title}
                    <Badge tone="slate">{stage.pending}</Badge>
                  </h2>
                </div>
                <Button
                  onClick={() => onOpenCohort(stage.cohort)}
                  testId={`button-view-customers-${index}`}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
                >
                  View customers <ArrowRight size={14} />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-background border border-border rounded p-4 text-sm">
                <div><div className="text-muted-foreground mb-1">Customer can still do</div><div className="font-semibold text-foreground">{stage.can}</div></div>
                <div><div className="text-muted-foreground mb-1">Default cohort action</div><div className="font-semibold text-primary">{stage.picks[0]}</div></div>
                <div><div className="text-muted-foreground mb-1">Customers here</div><div className="font-semibold text-foreground text-lg">{stage.count}</div></div>
                <div>
                  <div className="text-muted-foreground mb-2">Top selected actions</div>
                  <div className="space-y-2">
                    {stage.picks.map((pick, pickIndex) => (
                      <div key={pick} className="flex justify-between items-center text-xs border-b border-border/50 pb-1 last:border-0 last:pb-0">
                        <span className="font-medium text-foreground">{pick}</span><span className="text-muted-foreground">{[38, 24][pickIndex]}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-6 bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
        <CircleAlert size={18} className="text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 text-destructive">
          <b className="block mb-1">KRA / KYC rejected is recovery-only</b>
          <p className="text-sm opacity-90">FirstTrade does not score or recommend trading actions here. The only eligible path is Complete Re-KYC / Re-KRA.</p>
        </div>
        <Button onClick={onRecovery} testId="button-view-recovery-cohort">View recovery cohort</Button>
      </div>
    </>
  );
}

function DecisionsPage({
  decisions,
  selected,
  selectedId,
  search,
  cohortFilter,
  actionFilter,
  filterOpen,
  expanded,
  onSearch,
  onClearFilter,
  onActionFilter,
  onToggleFilter,
  onSelect,
  onToggleExpanded,
  onStudio,
  reducedMotion,
}: {
  decisions: Decision[];
  selected: Decision | null;
  selectedId: string;
  search: string;
  cohortFilter: string | null;
  actionFilter: ActionFilter;
  filterOpen: boolean;
  expanded: boolean;
  onSearch: (value: string) => void;
  onClearFilter: () => void;
  onActionFilter: (value: ActionFilter) => void;
  onToggleFilter: () => void;
  onSelect: (id: string) => void;
  onToggleExpanded: () => void;
  onStudio: (decision: Decision) => void;
  reducedMotion: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      <SectionTitle title="Decisions" copy="A deterministic queue for deciding the next activation action, with customer-safe reasoning." />
      {cohortFilter && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Visible cohort filter:</span>
          <Badge>{cohortFilter}</Badge>
          <button type="button" data-testid="button-clear-cohort-filter" onClick={onClearFilter} className="text-primary font-semibold hover:underline">Clear</button>
        </div>
      )}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        <div className="w-full lg:w-80 bg-card border border-border rounded-lg shadow-sm flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-border flex items-center gap-2 bg-background relative">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-2 text-muted-foreground" />
              <input data-testid="input-search-customers" aria-label="Search customer or cohort" className="w-full bg-card border border-border rounded text-sm py-1.5 pl-8 pr-2 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search customer or cohort" />
            </div>
            <button type="button" data-testid="button-filter-decisions" aria-label="Decision filters" aria-expanded={filterOpen} onClick={onToggleFilter} className={`p-1.5 rounded transition-colors ${filterOpen || actionFilter !== "All actions" ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-border/50"}`}><SlidersHorizontal size={16} /></button>
            <AnimatePresence>
              {filterOpen && (
                <motion.div initial={reducedMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reducedMotion ? 0 : 0.15, ease: "easeOut" }} className="absolute right-3 top-12 z-30 w-56 rounded-lg border border-border bg-card p-3 shadow-xl">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended action<select data-testid="select-decision-action-filter" className="mt-2 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={actionFilter} onChange={(event) => onActionFilter(event.target.value as ActionFilter)}><option>All actions</option>{ACTIONS.map((action) => <option key={action}>{action}</option>)}<option>{RECOVERY_ACTION}</option><option>No recommendation</option><option>Resume account</option></select></label>
                  <button type="button" data-testid="button-clear-decision-filter" onClick={() => onActionFilter("All actions")} className="mt-3 text-xs font-semibold text-primary hover:underline">Clear action filter</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1 overflow-y-auto">
            {decisions.map((decision) => (
              <button
                type="button"
                data-testid={`button-queue-item-${decision.customer.id}`}
                className={`w-full text-left p-3 border-b border-border flex items-center gap-3 transition-colors ${selectedId === decision.customer.id ? "bg-background border-l-2 border-l-primary" : "hover:bg-background border-l-2 border-l-transparent"}`}
                onClick={() => onSelect(decision.customer.id)}
                key={decision.customer.id}
              >
                <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-xs font-bold text-foreground shrink-0">{decision.customer.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{decision.customer.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{decision.cohort} · {decision.stateLabel}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-foreground leading-none">{decision.selectedScore ?? "—"}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">{decision.selectedScore === null ? "safe" : "fit"}</div>
                </div>
              </button>
            ))}
            {decisions.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No customers found.</div>}
          </div>
        </div>
         <div className="flex-1 min-w-0 min-h-[32rem]">
           {selected ? (
             <AnimatePresence mode="wait" initial={false}>
               <motion.div
                 key={selected.customer.id}
                 initial={reducedMotion ? false : { opacity: 0, x: 18 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={reducedMotion ? undefined : { opacity: 0, x: -8 }}
                 transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}
                 className="h-full"
               >
                 <Detail decision={selected} expanded={expanded} onToggleExpanded={onToggleExpanded} onStudio={() => onStudio(selected)} reducedMotion={reducedMotion} />
               </motion.div>
             </AnimatePresence>
           ) : (
             <div className="h-full min-h-[32rem] rounded-lg border border-dashed border-border bg-card flex items-center justify-center p-8 text-center">
               <div><div className="font-bold text-foreground">No matching decisions</div><p className="mt-1 text-sm text-muted-foreground">Clear the search or action filter to restore the visible decision set.</p></div>
             </div>
           )}
         </div>
      </div>
    </div>
  );
}

function DecisionTable({ decisions, onSelect, reducedMotion, animateRows = false }: { decisions: Decision[]; onSelect: (id: string) => void; reducedMotion: boolean; animateRows?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="bg-background border-b border-border text-muted-foreground font-semibold text-xs uppercase tracking-wider">
          <tr>{["Customer", "Cohort", "Recommended next action", "Why", "Channel", "Policy", ""].map((heading) => <th className="px-4 py-3 font-semibold" key={heading}>{heading}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
           {decisions.map((decision, index) => (
             <motion.tr
               key={decision.customer.id}
               initial={animateRows && !reducedMotion ? { opacity: 0, y: 6 } : false}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: reducedMotion ? 0 : 0.2, delay: animateRows && !reducedMotion ? index * 0.06 : 0, ease: "easeOut" }}
               className="hover:bg-background/50 transition-colors"
             >
              <td className="px-4 py-3"><div className="font-bold text-foreground">{decision.customer.name}</div><div className="text-xs font-medium text-muted-foreground mt-0.5">{decision.customer.id}</div></td>
              <td className="px-4 py-3 text-foreground font-medium">{decision.cohort}</td>
              <td className="px-4 py-3"><Badge tone={actionTone(decision.selectedAction)}>{decision.selectedAction}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground whitespace-normal min-w-[220px] text-sm leading-snug">{decision.rationale}</td>
              <td className="px-4 py-3 text-foreground font-medium">{decision.channelPlan.primary}</td>
              <td className="px-4 py-3 text-muted-foreground font-medium">v{decision.policyVersion}</td>
              <td className="px-4 py-3 text-right">
                <button type="button" data-testid={`link-view-decision-${decision.customer.id}`} className="inline-flex items-center gap-1 text-primary font-semibold hover:underline" onClick={() => onSelect(decision.customer.id)}>View decision <ChevronRight size={14} /></button>
              </td>
             </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detail({
  decision,
  expanded,
  onToggleExpanded,
  onStudio,
  reducedMotion,
}: {
  decision: Decision;
  expanded: boolean;
  onToggleExpanded: () => void;
  onStudio: () => void;
  reducedMotion: boolean;
}) {
  const weightedSignals = decision.scoreBreakdown.reduce((total, item) => total + item.contribution, 0);
  const canOpenStudio = decision.selectedAction !== "No recommendation" && decision.selectedAction !== "Resume account";
  const highestRawScore = ACTIONS
    .map((action) => ({ action, score: decision.candidateScores[action] }))
    .filter((item): item is { action: Action; score: number } => item.score !== null)
    .sort((left, right) => right.score - left.score)[0];
  const suppressedActions = ACTIONS.filter((action) => decision.candidateScores[action] === null);
  const hasPriorityOverride = Boolean(highestRawScore && highestRawScore.action !== decision.selectedAction);
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm h-full flex flex-col">
       <div className="p-6 border-b border-border flex flex-wrap justify-between items-start bg-background gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center text-lg font-bold text-foreground shadow-sm">{decision.customer.initials}</div>
          <div><h2 className="text-xl font-bold text-foreground leading-tight">{decision.customer.name}</h2><p className="text-sm font-medium text-muted-foreground mt-1">{decision.customer.id} · {decision.cohort} · {decision.stateLabel}</p></div>
        </div>
        <Button disabled={!canOpenStudio} onClick={onStudio} testId="button-open-nudge-studio"><Sparkles size={14} className="text-primary" /> Open Nudge Studio</Button>
      </div>

      <div className="p-6 border-b border-border bg-card">
        <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">RECOMMENDED NEXT ACTION</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.h1 key={decision.selectedAction} initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -5 }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }} className="text-3xl font-bold text-foreground mb-2">{decision.selectedAction}</motion.h1>
        </AnimatePresence>
        <p className="text-muted-foreground font-medium">{decision.rationale}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={actionTone(decision.selectedAction)}>{decision.selectedScore === null ? "No score calculated" : `${decision.selectedScore} Action Fit Score`}</Badge>
          {decision.a2tStatus !== "Not achieved" && <Badge tone="green">{decision.a2tStatus}</Badge>}
          {highestRawScore && <Badge tone="slate">Highest raw score · {highestRawScore.action} ({highestRawScore.score})</Badge>}
        </div>
        {hasPriorityOverride && highestRawScore && (
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
            <b className="block text-primary mb-1">Policy / lifecycle priority override</b>
            Selected by lifecycle priority: {decision.replacementRationale}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 flex-1 min-h-0 overflow-y-auto">
        <div>
          <h3 className="font-bold text-foreground mb-5">Decision rationale</h3>
          <div className="relative pl-5 space-y-5 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
            <div className="relative text-sm"><span className="absolute left-[-24px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" /><p className="text-foreground leading-relaxed"><b className="font-semibold text-muted-foreground block mb-0.5">Current account state</b>{decision.stateLabel} · KRA: {decision.accountState.kraStatus} · UCC: {decision.accountState.uccStatus} · Segment activation: {decision.accountState.segmentStatus === "Activated" ? "Complete" : "Incomplete"}</p></div>
            <div className="relative text-sm"><span className="absolute left-[-23px] top-1.5 w-2 h-2 rounded-full bg-border" /><p className="text-foreground leading-relaxed"><b className="font-semibold text-muted-foreground block mb-0.5">Completed actions</b>{decision.completedActions.length ? decision.completedActions.join(" · ") : "None recorded"}</p></div>
            <div className="relative text-sm"><span className="absolute left-[-23px] top-1.5 w-2 h-2 rounded-full bg-border" /><p className="text-foreground leading-relaxed"><b className="font-semibold text-muted-foreground block mb-0.5">Customer-owned context</b>{decision.customerOwnedDeepLinkContext}</p></div>
          </div>
          <div className="mt-8 bg-background border border-border rounded-lg p-4 text-sm">
            <div className="text-muted-foreground font-medium mb-1">Default cohort action</div>
            <div className="font-bold text-foreground mb-4">{decision.cohortDefault}</div>
            <div className="text-muted-foreground font-medium mb-1">Retained / replaced</div>
            <div className="font-bold text-primary">{decision.replacementRationale}</div>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-foreground mb-1 flex items-baseline gap-2">Action Fit Score <TooltipHint label="Score definition" text="A deterministic fit score from account state and five normalized intent signals. Completed actions are removed before selection." /> <strong className="text-2xl text-primary">{decision.selectedScore ?? "—"}</strong></h3>
          <p className="text-sm font-medium text-muted-foreground mb-6">Supporting evidence under Policy v{decision.policyVersion}</p>
           <div className="space-y-3 mb-5">
            {decision.scoreBreakdown.length === 0
               ? <div className="bg-background border border-border rounded-lg p-4 text-sm text-muted-foreground">{decision.accountState.kraStatus === "Rejected" ? "KRA / KYC rejection is recovery-only. No product score is calculated." : decision.a2tStatus !== "Not achieved" ? "A2T is already achieved. No repeat product score is calculated." : "No product score is calculated for this state."}</div>
              : decision.scoreBreakdown.map((item, index) => (
                <div className="flex items-center gap-3 text-sm" key={item.key}>
                  <span className="w-1/3 text-muted-foreground font-medium truncate">{item.label}</span>
                  <div className="flex-1 h-2 bg-background border border-border rounded-full overflow-hidden">
                    <motion.div initial={expanded && !reducedMotion ? { width: 0 } : false} animate={{ width: `${item.value * 100}%` }} transition={{ duration: reducedMotion ? 0 : 0.28, delay: reducedMotion ? 0 : index * 0.035, ease: "easeOut" }} className="h-full bg-primary rounded-full" />
                  </div>
                  <b className="w-8 text-right text-foreground font-bold">{item.value.toFixed(2)}</b>
                </div>
              ))}
          </div>
           {suppressedActions.length > 0 && <div className="mb-5 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground"><b className="text-foreground">Suppressed actions</b><div className="mt-1 flex flex-wrap gap-1.5">{suppressedActions.map((action) => <span className="rounded border border-border px-1.5 py-0.5" key={action}>{action}</span>)}</div></div>}
          <button type="button" data-testid="button-toggle-calculation" className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase tracking-wider" onClick={onToggleExpanded}>
            {expanded ? "Hide score calculation" : "Show score calculation"} <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div initial={reducedMotion ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reducedMotion ? undefined : { height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }} className="overflow-hidden">
                <div className="mt-4 text-sm bg-primary/5 text-primary p-4 rounded-lg border border-primary/20 leading-relaxed font-medium">
                  {decision.selectedScore === null ? "No score is calculated for this state." : `Base 20 + weighted signals ${weightedSignals} = ${decision.selectedScore}. Completed actions are removed before selection; threshold is ${decision.selectionThreshold}.`}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-5 border-t border-border bg-background flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-bold text-foreground text-sm mb-1">Customer-safe nudge preview</h3>
          <p className="text-sm text-foreground italic my-1 font-medium truncate">{decision.copyVariants[0] ?? "No nudge is sent for this state."}</p>
          <span className="text-xs font-medium text-muted-foreground">{decision.channelPlan.primary} · {decision.channelPlan.inApp} · {decision.suppressionRules[2]}</span>
        </div>
        <Button disabled={!canOpenStudio} onClick={onStudio} testId="button-edit-workflow-bottom">Edit workflow <ArrowRight size={14} /></Button>
      </div>
    </div>
  );
}

function PolicyStudioPage({
  livePolicy,
  draftPolicy,
  dirty,
  valid,
  preview,
  notice,
  onThreshold,
  onWeight,
  onPreview,
  onPublish,
  reducedMotion,
}: {
  livePolicy: Policy;
  draftPolicy: Policy;
  dirty: boolean;
  valid: boolean;
  preview: PolicyPreview | null;
  notice: string;
  onThreshold: (value: number) => void;
  onWeight: (action: Action, key: SignalKey, value: number) => void;
  onPreview: () => void;
  onPublish: () => void;
  reducedMotion: boolean;
}) {
  return (
    <div>
      <SectionTitle title="Policy Studio" copy="Shape the decision policy locally, preview its impact, and publish a simulated version." />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg shadow-sm p-6 flex flex-col gap-6">
          <div className="flex justify-between items-start border-b border-border pb-4 gap-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">DRAFT POLICY</div>
              <h2 className="text-xl font-bold text-foreground">Version {draftPolicy.version} · {dirty ? "Unsaved changes" : "Ready to preview"}</h2>
            </div>
            <Badge tone="green">Current live · v{livePolicy.version}</Badge>
          </div>
          <label className="flex items-center justify-between text-sm font-semibold text-foreground">
            Selection threshold
            <input data-testid="input-threshold" aria-label="Selection threshold" className="w-16 bg-background border border-border rounded px-2 py-1 text-center font-normal focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" type="number" min={0} max={100} value={draftPolicy.threshold} onChange={(event) => onThreshold(Number(event.target.value))} />
          </label>

          <div className="space-y-4">
            {ACTIONS.map((action) => {
              const total = policyWeightTotal(draftPolicy, action);
              return (
                <div className="text-sm" key={action}>
                  <div className="flex items-center justify-between mb-2">
                    <b className="text-foreground">{action}</b>
                    <span className={total === 80 ? "text-[#18794E] text-xs font-semibold" : "text-destructive text-xs font-semibold"}>{total}/80 weight points</span>
                  </div>
                  <div className="flex gap-2">
                    {SIGNAL_KEYS.map((key) => (
                      <label key={key} className="flex-1 flex flex-col gap-1 text-[10px] font-semibold text-muted-foreground uppercase text-center">
                        <span className="truncate" title={SIGNAL_LABELS[key]}>{SIGNAL_LABELS[key].split(" ")[0]}</span>
                        <input data-testid={`input-weight-${action}-${key}`} aria-label={`${action} ${SIGNAL_LABELS[key]} weight`} value={draftPolicy.weights[action][key]} type="number" min={0} className="w-full bg-background border border-border rounded px-1 py-1 text-center font-normal text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" onChange={(event) => onWeight(action, key, Number(event.target.value))} />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-sm font-semibold text-foreground">Shared delivery policy <TooltipHint label="Compliance note" text="Delivery is synthetic preview logic only. Suppress after completion, opt-out, or two ignored pushes in seven days." /></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-background border border-border rounded p-3"><b>In-app</b><span className="block text-muted-foreground mt-1">{draftPolicy.channelPlan.inApp}</span></div>
              <div className="bg-background border border-border rounded p-3"><b>Push</b><span className="block text-muted-foreground mt-1">{draftPolicy.channelPlan.push}</span></div>
              <div className="bg-background border border-border rounded p-3"><b>WhatsApp</b><span className="block text-muted-foreground mt-1">{draftPolicy.channelPlan.whatsapp}</span></div>
            </div>
            {!valid && <div className="text-sm text-destructive flex items-center gap-2"><CircleAlert size={15} /> Each action must total exactly 80 weight points and the threshold must be between 0 and 100.</div>}
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button disabled={!valid} onClick={onPreview} testId="button-preview-customers">Preview affected customers</Button>
            <Button primary disabled={!valid || !dirty} onClick={onPublish} testId="button-publish-policy">Publish simulated version</Button>
          </div>
          <AnimatePresence>
            {notice && <motion.div initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0 }} className="bg-[#18794E]/10 text-[#18794E] border border-[#18794E]/20 p-3 rounded flex items-center gap-2 text-sm font-medium"><Check size={16} /> Draft v1.1 → {notice}</motion.div>}
          </AnimatePresence>
        </div>

        <div className="bg-background border border-border rounded-lg p-6 flex flex-col gap-6">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">CHANGE REVIEW</div>
            <h2 className="text-lg font-bold text-foreground">Before / after recommendations</h2>
            <p className="text-sm text-muted-foreground mt-1">{preview ? `${preview.changed.length} changed customers across ${preview.evaluatedCount} synthetic decisions.` : "Preview the draft to recalculate recommendations."}</p>
          </div>
          <div className="space-y-3 flex-1">
            {preview?.changed.length
              ? preview.changed.map((change) => (
                <motion.div key={change.id} initial={reducedMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="bg-card border border-border p-3 rounded text-sm flex items-center justify-between gap-3 shadow-sm">
                  <span className="font-semibold text-foreground min-w-0 truncate">{change.name}</span>
                  <b className="text-muted-foreground font-medium text-right">{change.before}</b>
                  <ArrowRight size={14} className="text-border shrink-0" />
                  <b className={`text-right ${change.after === "No recommendation" || change.after === "Resume account" ? "text-muted-foreground" : "text-primary"}`}>{change.after}</b>
                </motion.div>
              ))
              : <div className="bg-card border border-border rounded p-4 text-sm text-muted-foreground">{preview ? "No selected recommendations changed under this draft." : "No preview calculated yet."}</div>}
          </div>
          <div className="border-t border-border pt-4">
            <h3 className="font-bold text-foreground mb-3 text-sm">Version history</h3>
            <div className="space-y-2 text-sm">
              <p className="flex justify-between text-foreground"><b className="font-semibold">v{livePolicy.version}</b><span className="text-muted-foreground">Live simulated</span></p>
              <p className="flex justify-between text-muted-foreground opacity-75"><b className="font-semibold">v0.9</b><span>Archived</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MeasurementPage({ decision, reducedMotion }: { decision: Decision; reducedMotion: boolean }) {
  const events = ["decision_created", "nudge_previewed", "deep_link_opened", "pre_order_submitted", "mf_order_submitted", "first_trade_placed", "a2t_achieved"];
  return (
    <div>
      <SectionTitle title="Measurement" copy="Instrument the activation decision without pretending the outcome is already known." />
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <Badge>Selected treatment action · {decision.selectedAction}</Badge>
        <span className="text-muted-foreground">Decision {decision.customer.id} · Policy v{decision.policyVersion}</span>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">EXPERIMENT BRIEF</div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Hypothesis</h2>
          <p className="text-foreground text-lg font-medium leading-relaxed mb-8">If FirstTrade selects a customer-safe next action from account state and behaviour, more customers will reach A2T without increasing unwanted contact or repeated nudges.</p>
          <div className="space-y-4">
            {[
              ["Control", "Existing static cohort journey including completed-action suppression"],
              ["Treatment", `Existing journey plus ${decision.selectedAction}`],
              ["Primary metric", "A2T success within seven days of e-sign"],
              ["Success events", "Pre-order submitted, MF order submitted, or first trade placed"],
              ["Guardrails", "Nudge dismissed · opt-out · contact frequency exceeded"],
            ].map(([label, value]) => <div className="flex border-b border-border pb-3 last:border-0 text-sm" key={label}><span className="w-1/3 text-muted-foreground">{label}</span><b className="flex-1 font-semibold text-foreground">{value}</b></div>)}
          </div>
          <div className="mt-6 bg-[#18794E]/10 text-[#18794E] border border-[#18794E]/20 p-3 rounded flex items-center justify-center gap-2 text-sm font-bold"><Check size={16} /> Experiment ready</div>
        </div>

        <div className="bg-background border border-border rounded-lg p-6">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">JOURNEY ALIGNMENT</div>
          <h2 className="text-xl font-bold text-foreground mb-5">Same A2T outcome, different treatment</h2>
          <div className="space-y-4 mb-8">
            {["Control · cohort default", "Treatment · FirstTrade action"].map((label, index) => (
              <div key={label}>
                <div className="flex items-center justify-between text-sm mb-2"><span className="font-semibold text-foreground">{label}</span><span className="text-muted-foreground">A2T</span></div>
                <div className="h-2 rounded-full bg-card border border-border overflow-hidden"><motion.div initial={reducedMotion ? false : { width: 0 }} animate={{ width: "100%" }} transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : index * 0.1, ease: "easeOut" }} className={`h-full ${index === 0 ? "bg-muted-foreground/50" : "bg-primary"}`} /></div>
              </div>
            ))}
          </div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">EVENT TRAIL</div>
          <h2 className="text-xl font-bold text-foreground mb-6">What will be recorded</h2>
          <div className="space-y-4">
            {events.map((event, index) => (
              <motion.div key={event} initial={reducedMotion ? false : { opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : index * 0.04, ease: "easeOut" }} className="flex items-center gap-4 bg-card border border-border p-3 rounded shadow-sm">
                <span className="w-6 h-6 rounded-full bg-background border border-border text-muted-foreground flex items-center justify-center text-xs font-bold">{index + 1}</span>
                <b className="flex-1 text-foreground font-mono text-sm">{event}</b>
                <span className="text-xs font-medium text-muted-foreground">Synthetic event schema</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CoachmarkTour({
  step,
  onAdvance,
  onDismiss,
  reducedMotion,
}: {
  step: number;
  onAdvance: () => void;
  onDismiss: () => void;
  reducedMotion: boolean;
}) {
  const steps = [
    {
      eyebrow: "WELCOME TO DECISION ORBIT",
      title: "Your activation system has a pulse.",
      copy: "Start here to see the live signal moving from account activation to a customer-safe next step.",
      label: "Overview signal map",
      action: "Show the decision queue",
      icon: Zap,
    },
    {
      eyebrow: "FOLLOW THE SIGNAL",
      title: "Every decision comes with a reason.",
      copy: "The queue turns customer context, score evidence, and safety rules into one useful action—not another dashboard to decode.",
      label: "Decision queue",
      action: "Show policy impact",
      icon: Target,
    },
    {
      eyebrow: "MAKE CHANGE SAFELY",
      title: "Preview the impact before you publish.",
      copy: "Policy Studio lets you tune the decision engine locally and see which recommendations would change before anything goes live.",
      label: "Policy Studio",
      action: "Start exploring",
      icon: Settings2,
    },
  ];
  const active = steps[step] ?? steps[0];
  const Icon = active.icon;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center sm:p-8"
    >
      <button type="button" aria-label="Skip product tour" onClick={onDismiss} className="absolute inset-0 cursor-default bg-[#020616]/55 backdrop-blur-[3px]" />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="signal-tour-title"
        initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="coachmark-card relative w-full max-w-md overflow-hidden rounded-[1.5rem] border border-border p-6 sm:p-7"
      >
        <motion.div className="coachmark-glow" animate={reducedMotion ? undefined : { x: [0, 40, 0], y: [0, -16, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="coachmark-icon"><Icon size={21} /></div>
          <button type="button" onClick={onDismiss} className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">Skip tour</button>
        </div>
        <div className="relative z-10 mt-7">
          <div className="text-[11px] font-bold tracking-[0.16em] text-primary">{active.eyebrow}</div>
          <h2 id="signal-tour-title" className="mt-3 text-3xl font-bold leading-[1.02] tracking-[-0.04em] text-foreground">{active.title}</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{active.copy}</p>
          <div className="tour-location mt-5"><Sparkles size={14} /> Now exploring: {active.label}</div>
        </div>
        <div className="relative z-10 mt-7 flex items-center justify-between gap-4">
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
            {steps.map((tourStep, index) => <span key={tourStep.label} className={`h-1.5 rounded-full transition-all ${index === step ? "w-8 bg-primary" : "w-1.5 bg-border"}`} />)}
          </div>
          <Button primary onClick={onAdvance} testId="button-advance-signal-tour" className="coachmark-cta">{active.action} <ArrowRight size={15} /></Button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function SimulatorPage({
  scenario,
  state,
  decision,
  changedField,
  changedScoreActions,
  recommendationNotice,
  calculationOpen,
  onScenario,
  onChange,
  onOpenStudio,
  onToggleCalculation,
  reducedMotion,
}: {
  scenario: SimulatorScenario | "Manual controls";
  state: SimulatorState;
  decision: Decision;
  changedField: SimulatorField | null;
  changedScoreActions: Action[];
  recommendationNotice: string;
  calculationOpen: boolean;
  onScenario: (scenario: SimulatorScenario) => void;
  onChange: <K extends keyof SimulatorState>(field: K, value: SimulatorState[K]) => void;
  onOpenStudio: () => void;
  onToggleCalculation: () => void;
  reducedMotion: boolean;
}) {
  const controlClass = (field: SimulatorField) => `w-full bg-card border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${changedField === field ? "ring-2 ring-primary/30 bg-primary/5" : ""}`;
  const selectValue = (field: keyof SimulatorState) => String(state[field]);
  const selectChange = <K extends keyof SimulatorState>(field: K, value: string) => onChange(field, value as SimulatorState[K]);
  return (
    <div>
      <SectionTitle title="Simulator" copy="Change product states and customer-owned context to see the policy respond in the same session." />
      <div className="bg-card border border-border rounded-lg shadow-sm mb-6 flex flex-col lg:flex-row overflow-hidden">
        <div className="lg:w-1/2 p-6 border-r border-border bg-background flex flex-col">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">DEMO SCENARIO</span>
          <div className="flex flex-wrap gap-2">
            {SIMULATOR_SCENARIOS.map((preset) => (
              <button type="button" data-testid={`button-scenario-${preset.replace(/\s+/g, "-")}`} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 border ${scenario === preset ? "bg-foreground text-card border-foreground" : "bg-card text-muted-foreground border-border hover:border-muted-foreground/50"}`} onClick={() => onScenario(preset)} key={preset}>{preset}</button>
            ))}
          </div>
          {scenario === "Manual controls" && <div className="mt-4 text-xs text-primary font-semibold">Manual product-state controls active</div>}
        </div>
        <div className="lg:w-1/2 p-6 flex flex-col justify-center items-start">
          <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">SELECTED RECOMMENDATION</div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2 key={decision.selectedAction} initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -5 }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }} className="text-3xl font-bold text-foreground mb-3">{decision.selectedAction}</motion.h2>
          </AnimatePresence>
          <div className="flex items-center gap-3 mb-2"><Badge tone={actionTone(decision.selectedAction)}>{decision.selectedScore === null ? (decision.a2tStatus !== "Not achieved" ? "A2T achieved" : decision.selectedAction === RECOVERY_ACTION ? "Recovery only" : "No score") : `${decision.selectedScore} Action Fit Score`}</Badge></div>
          <p className="text-sm text-muted-foreground mb-4">{decision.rationale}</p>
          <div className="flex items-center gap-3">
            <Button primary disabled={decision.selectedAction === "No recommendation" || decision.selectedAction === "Resume account"} onClick={onOpenStudio} testId="button-open-studio-simulator">Open Nudge Studio <ArrowRight size={14} /></Button>
            <AnimatePresence>
              {recommendationNotice && <motion.span initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reducedMotion ? undefined : { opacity: 0 }} className="text-xs font-semibold text-primary">{recommendationNotice}</motion.span>}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg shadow-sm">
          <div className="p-4 border-b border-border flex justify-between items-center bg-background"><h2 className="font-bold text-foreground">Product-state controls</h2><span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Editable</span></div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className={`text-sm font-medium text-foreground transition-colors ${changedField === "kraStatus" ? "text-primary" : ""}`}>KRA status<select data-testid="select-kra-status" className={controlClass("kraStatus")} value={state.kraStatus} onChange={(event) => selectChange("kraStatus", event.target.value)}><option>Approved</option><option>Pending</option><option>Rejected</option></select></label>
            <label className={`text-sm font-medium text-foreground transition-colors ${changedField === "uccStatus" ? "text-primary" : ""}`}>UCC mapping<select data-testid="select-ucc-status" className={controlClass("uccStatus")} value={state.uccStatus} onChange={(event) => selectChange("uccStatus", event.target.value)}><option>Complete</option><option>Pending</option><option>Not started</option></select></label>
            <label className={`text-sm font-medium text-foreground transition-colors ${changedField === "mfAccountStatus" ? "text-primary" : ""}`}>MF account<select data-testid="select-mf-account" className={controlClass("mfAccountStatus")} value={state.mfAccountStatus} onChange={(event) => selectChange("mfAccountStatus", event.target.value)}><option>Not started</option><option>Active</option></select></label>
            <label className={`text-sm font-medium text-foreground transition-colors ${changedField === "exchangeStatus" ? "text-primary" : ""}`}>Exchange approval<select data-testid="select-exchange-status" className={controlClass("exchangeStatus")} value={state.exchangeStatus} onChange={(event) => selectChange("exchangeStatus", event.target.value)}><option>Not approved</option><option>Approved</option></select></label>
            <label className={`text-sm font-medium text-foreground transition-colors ${changedField === "fundingStatus" ? "text-primary" : ""}`}>Funding flow<select data-testid="select-funding-status" className={controlClass("fundingStatus")} value={state.fundingStatus} onChange={(event) => selectChange("fundingStatus", event.target.value)}><option>Not started</option><option>In progress</option><option>Ready</option><option>Complete</option></select></label>
            <label className={`text-sm font-medium text-foreground transition-colors ${changedField === "selectedInstrument" ? "text-primary" : ""}`}>Selected instrument<select data-testid="select-selected-instrument" className={controlClass("selectedInstrument")} value={state.selectedInstrument} onChange={(event) => selectChange("selectedInstrument", event.target.value)}><option>None</option><option>NIFTY 50 ETF</option><option>NIFTY 50</option><option>Balanced Advantage Fund</option><option>F&O segment</option></select></label>
            <label className={`text-sm font-medium text-foreground transition-colors ${changedField === "preOrderStatus" ? "text-primary" : ""}`}>Pre-order<select data-testid="select-pre-order-status" className={controlClass("preOrderStatus")} value={state.preOrderStatus} onChange={(event) => selectChange("preOrderStatus", event.target.value)}><option>Not started</option><option>Started</option><option>Submitted</option></select></label>
            <label className={`text-sm font-medium text-foreground transition-colors ${changedField === "mfOrderStatus" ? "text-primary" : ""}`}>MF order<select data-testid="select-mf-order-status" className={controlClass("mfOrderStatus")} value={state.mfOrderStatus} onChange={(event) => selectChange("mfOrderStatus", event.target.value)}><option>Not submitted</option><option>Submitted</option></select></label>
            <label className={`text-sm font-medium text-foreground transition-colors ${changedField === "a2tStatus" ? "text-primary" : ""}`}>A2T outcome<select data-testid="select-a2t-status" className={controlClass("a2tStatus")} value={state.a2tStatus} onChange={(event) => selectChange("a2tStatus", event.target.value)}><option>Not achieved</option><option>Achieved through pre-order</option><option>Achieved through MF order</option><option>Achieved through first trade</option></select></label>
            <label className={`md:col-span-2 flex items-center justify-between gap-3 p-3 rounded border border-border text-sm font-medium text-foreground transition-colors ${changedField === "savedWatchlist" ? "ring-2 ring-primary/30 bg-primary/5" : "bg-background"}`}><span>Saved watchlist context</span><input data-testid="checkbox-saved-watchlist" type="checkbox" checked={state.savedWatchlist} onChange={(event) => onChange("savedWatchlist", event.target.checked)} className="w-4 h-4 accent-primary" /></label>
            <label className={`md:col-span-2 flex items-center justify-between gap-3 p-3 rounded border border-border text-sm font-medium text-foreground transition-colors ${changedField === "sipCalculatorUsed" ? "ring-2 ring-primary/30 bg-primary/5" : "bg-background"}`}><span>SIP calculator activity</span><input data-testid="checkbox-sip-calculator" type="checkbox" checked={state.sipCalculatorUsed} onChange={(event) => onChange("sipCalculatorUsed", event.target.checked)} className="w-4 h-4 accent-primary" /></label>
            <label className={`md:col-span-2 flex items-center justify-between gap-3 p-3 rounded border border-border text-sm font-medium text-foreground transition-colors ${changedField === "segmentInterest" ? "ring-2 ring-primary/30 bg-primary/5" : "bg-background"}`}><span>F&O / commodity segment interest</span><input data-testid="checkbox-segment-interest" type="checkbox" checked={state.segmentInterest} onChange={(event) => onChange("segmentInterest", event.target.checked)} className="w-4 h-4 accent-primary" /></label>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg shadow-sm">
          <div className="p-4 border-b border-border flex justify-between items-center bg-background"><h2 className="font-bold text-foreground">Candidate actions</h2><span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Changed scores only</span></div>
          <div className="p-4 space-y-2">
            {ACTIONS.map((action) => {
              const score = decision.candidateScores[action];
              const changed = changedScoreActions.includes(action);
              return (
                <motion.div key={action} animate={changed && !reducedMotion ? { backgroundColor: ["rgba(23,105,224,0.08)", "rgba(23,105,224,0)"] } : undefined} transition={{ duration: reducedMotion ? 0 : 0.45, ease: "easeOut" }} className={`flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0 px-2 py-1 rounded ${decision.selectedAction === action ? "bg-primary/5" : ""}`}>
                  <span className={`text-sm font-medium ${decision.selectedAction === action ? "text-primary" : "text-foreground"}`}>{action}</span>
                  <span className={score === null ? "text-xs text-muted-foreground" : "text-sm font-bold text-foreground"}>{score === null ? "Suppressed" : `${score} fit`}</span>
                </motion.div>
              );
            })}
          </div>
          <div className="mx-4 mb-4 border-t border-border pt-4">
            <button type="button" data-testid="button-toggle-simulator-calculation" onClick={onToggleCalculation} className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 uppercase tracking-wider">{calculationOpen ? "Hide calculation detail" : "Show calculation detail"}<ChevronDown size={14} className={calculationOpen ? "rotate-180" : ""} /></button>
            <AnimatePresence initial={false}>
              {calculationOpen && (
                <motion.div initial={reducedMotion ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reducedMotion ? undefined : { height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }} className="overflow-hidden">
                  <div className="mt-3 bg-background border border-border rounded p-3 space-y-2">
                    <div className="text-xs text-muted-foreground">Normalised signals are shown only here for policy inspection.</div>
                    {SIGNAL_KEYS.map((key) => {
                      const breakdown = decision.scoreBreakdown.find((item) => item.key === key);
                      return <div className="flex items-center justify-between text-xs" key={key}><span>{SIGNAL_LABELS[key]}</span><b>{decision.signals[key].toFixed(2)}{breakdown ? ` · +${breakdown.contribution}` : " · not scored"}</b></div>;
                    })}
                    {decision.scoreBreakdown.length === 0 && <div className="text-xs text-muted-foreground">No action score is calculated for this state.</div>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function NudgeStudio({
  decision,
  initialCopy,
  workflowStatus,
  onClose,
  onSaveDraft,
  onApprove,
  reducedMotion,
}: {
  decision: Decision;
  initialCopy: string;
  workflowStatus: "Draft" | "Approved";
  onClose: () => void;
  onSaveDraft: (copy: string) => void;
  onApprove: () => void;
  reducedMotion: boolean;
}) {
  const [channel, setChannel] = useState<Channel>(decision.channelPlan.primary);
  const [copy, setCopy] = useState(initialCopy);
  const [draftSaved, setDraftSaved] = useState(false);
  const [approved, setApproved] = useState(workflowStatus === "Approved");
  const edited = copy !== initialCopy;

  useEffect(() => {
    setChannel(decision.channelPlan.primary);
    setCopy(initialCopy);
    setDraftSaved(false);
    setApproved(workflowStatus === "Approved");
  }, [decision.channelPlan.primary, decision.customer.id, decision.selectedAction, initialCopy, workflowStatus]);

  const channelDescription = channel === "In-app"
    ? decision.channelPlan.inApp
    : channel === "Push"
      ? decision.channelPlan.push
      : decision.channelPlan.whatsapp;

  const saveDraft = () => {
    onSaveDraft(copy);
    setDraftSaved(true);
  };

  const approve = () => {
    onApprove();
    setApproved(true);
  };

  return (
    <motion.div initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reducedMotion ? undefined : { opacity: 0 }} className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <motion.div role="dialog" aria-modal="true" aria-labelledby="nudge-studio-title" initial={reducedMotion ? false : { opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, scale: 0.98, y: 8 }} transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }} className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-4xl max-h-full flex flex-col overflow-hidden">
        <div className="p-5 border-b border-border flex justify-between items-start bg-background">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">NUDGE STUDIO · {approved ? "APPROVED WORKFLOW" : "LOCAL DRAFT"}</div>
             <h2 id="nudge-studio-title" className="text-2xl font-bold text-foreground">{decision.selectedAction}</h2>
          </div>
          <button type="button" data-testid="button-close-studio" aria-label="Close Nudge Studio" className="p-2 text-muted-foreground hover:bg-border/50 rounded-lg transition-colors" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
            <div>
              <h3 className="font-bold text-foreground mb-3 text-lg">Rationale & delivery logic</h3>
              <p className="text-sm font-medium text-muted-foreground mb-6 leading-relaxed">{decision.rationale}</p>
              <div className="space-y-4 text-sm bg-background border border-border rounded-lg p-4">
                <div className="flex"><b className="w-1/3 text-foreground font-semibold">Deep-link</b><span className="flex-1 text-muted-foreground font-mono text-xs mt-0.5 break-all">{decision.customerOwnedDeepLinkContext}</span></div>
                <div className="flex"><b className="w-1/3 text-foreground font-semibold">Primary channel</b><span className="flex-1 text-muted-foreground">{decision.channelPlan.primary}</span></div>
                <div className="flex"><b className="w-1/3 text-foreground font-semibold">Delivery</b><span className="flex-1 text-muted-foreground">{channelDescription}</span></div>
                <div className="flex"><b className="w-1/3 text-foreground font-semibold">Suppression</b><span className="flex-1 text-muted-foreground">{decision.suppressionRules.join("; ")}</span></div>
              </div>
            </div>

            <div className="bg-background border border-border rounded-xl p-6 flex flex-col items-center justify-center">
              <div className="flex gap-6 mb-6 text-sm w-full justify-center border-b border-border">
                {(["In-app", "Push", "WhatsApp"] as Channel[]).map((option) => (
                  <button type="button" data-testid={`tab-nudge-${option}`} onClick={() => setChannel(option)} key={option} className={`relative pb-2 font-medium ${channel === option ? "text-foreground" : "text-muted-foreground"}`}>
                    {option}
                    {channel === option && <motion.span layoutId="nudge-active-underline" className="absolute left-0 right-0 bottom-[-1px] h-0.5 bg-primary" transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }} />}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={`${decision.selectedAction}-${channel}`} initial={reducedMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? undefined : { opacity: 0, x: -8 }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }} className="bg-card border border-border rounded-xl shadow-md p-5 w-full max-w-[280px]">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4"><MessageSquare size={18} /></div>
                  <b className="block text-foreground mb-2 text-sm font-bold">{channel === "In-app" ? "One useful next step" : channel === "Push" ? "A reminder when useful" : "A helpful follow-up"}</b>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{copy}</p>
                  <div className="text-xs text-muted-foreground border-t border-border pt-3">{channelDescription}</div>
                  <button type="button" className="w-full mt-4 bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm">Continue</button>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="mb-8 border-t border-border pt-8">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2 text-lg"><Sparkles size={18} className="text-primary" /> Safe local mock AI variants</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {decision.copyVariants.map((variant, index) => (
                <button type="button" data-testid={`button-variant-${index}`} key={variant} onClick={() => { setCopy(variant); setDraftSaved(false); }} className={`text-left p-4 rounded-lg text-sm transition-all border ${copy === variant ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-muted-foreground bg-card shadow-sm"}`}>
                  <span className="flex items-center justify-between text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">Variant {index + 1}{copy === variant && <Check size={13} className="text-primary" />}</span>
                  <span className="text-foreground leading-relaxed font-medium">{variant}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-foreground mb-2" htmlFor="textarea-nudge-copy">PM-approved copy {edited && <span className="text-primary font-medium">· Edited by PM</span>}</label>
            <textarea data-testid="textarea-nudge-copy" id="textarea-nudge-copy" className="w-full bg-card border border-border rounded-lg p-4 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none transition-all shadow-sm" rows={3} value={copy} onChange={(event) => { setCopy(event.target.value); setDraftSaved(false); }} />
          </div>
          <AnimatePresence>
            {draftSaved && <motion.div initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0 }} className="mt-3 text-sm font-semibold text-[#18794E] flex items-center gap-2"><Check size={15} /> Draft saved locally</motion.div>}
          </AnimatePresence>
        </div>

        <div className="p-5 border-t border-border bg-background flex justify-end gap-3">
          <Button disabled={!edited} onClick={saveDraft} testId="button-save-draft">Save draft</Button>
          <Button primary disabled={approved || !copy.trim()} onClick={approve} testId="button-approve-workflow">{approved ? <><Check size={14} /> Approved workflow</> : <><Send size={14} /> Approve workflow</>}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
