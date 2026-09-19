export const ACTIONS = [
  "Add Funds",
  "Create Pre-order",
  "Start MF Investing",
  "Activate Segment",
  "Take First Trade",
] as const;

export type Action = (typeof ACTIONS)[number];
export const RECOVERY_ACTION = "Complete Re-KYC / Re-KRA" as const;
export const NO_RECOMMENDATION = "No recommendation" as const;
export const RESUME_ACTION = "Resume account" as const;
export type DecisionAction = Action | typeof RECOVERY_ACTION | typeof NO_RECOMMENDATION | typeof RESUME_ACTION;

export const SIGNAL_KEYS = ["order", "watchlist", "mf", "segment", "funding"] as const;
export type SignalKey = (typeof SIGNAL_KEYS)[number];
export type Signals = Record<SignalKey, number>;

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  order: "Order-flow intent",
  watchlist: "Watchlist / research",
  mf: "MF intent",
  segment: "F&O / Commodity intent",
  funding: "Funding / pre-order readiness",
};

export type KRAStatus = "Approved" | "Pending" | "Rejected";
export type UCCStatus = "Complete" | "Pending" | "Not started";
export type MFAccountStatus = "Active" | "Not started";
export type ExchangeStatus = "Approved" | "Not approved";
export type FundingStatus = "Ready" | "In progress" | "Not started" | "Complete";
export type PreOrderStatus = "Not started" | "Started" | "Submitted";
export type MFOrderStatus = "Not submitted" | "Submitted";
export type FirstTradeStatus = "Not placed" | "Placed";
export type SegmentStatus = "Not activated" | "Activated";
export type A2TStatus =
  | "Not achieved"
  | "Achieved through pre-order"
  | "Achieved through MF order"
  | "Achieved through first trade";

export type AccountState = {
  eSignComplete: boolean;
  kraStatus: KRAStatus;
  uccStatus: UCCStatus;
  mfAccountStatus: MFAccountStatus;
  exchangeStatus: ExchangeStatus;
  fundingStatus: FundingStatus;
  preOrderStatus: PreOrderStatus;
  mfOrderStatus: MFOrderStatus;
  firstTradeStatus: FirstTradeStatus;
  segmentStatus: SegmentStatus;
  a2tStatus: A2TStatus;
  optOut: boolean;
  ignoredPushes: number;
};

export type Channel = "In-app" | "Push" | "WhatsApp";
export type ChannelPlan = {
  primary: Channel;
  inApp: string;
  push: string;
  whatsapp: string;
  consentEligible: boolean;
};

export type Policy = {
  version: string;
  threshold: number;
  weights: Record<Action, Signals>;
  channelPlan: ChannelPlan;
  suppressionRules: string[];
};

export type CustomerProfile = {
  id: string;
  name: string;
  initials: string;
  cohort: string;
  stateLabel: string;
  cohortDefault: DecisionAction;
  accountState: AccountState;
  completedActionKeys: Action[];
  selectedInstrument: string;
  savedWatchlist: boolean;
  sipCalculatorUsed: boolean;
  segmentInterest: boolean;
  primaryChannel: Channel;
  rationaleByAction: Partial<Record<Action | typeof RECOVERY_ACTION, string>>;
  replacementRationale: string;
  deepLinkContext: string;
  signals: Signals;
};

export type ScoreBreakdown = {
  key: SignalKey;
  label: string;
  value: number;
  contribution: number;
};

export type Decision = {
  customer: Pick<CustomerProfile, "id" | "name" | "initials">;
  cohort: string;
  accountState: AccountState;
  eligibleActions: DecisionAction[];
  candidateScores: Record<Action, number | null>;
  selectedAction: DecisionAction;
  selectedScore: number | null;
  cohortDefault: DecisionAction;
  replacementRationale: string;
  completedActions: string[];
  customerOwnedDeepLinkContext: string;
  channelPlan: ChannelPlan;
  suppressionRules: string[];
  copyVariants: string[];
  policyVersion: string;
  selectionThreshold: number;
  a2tStatus: A2TStatus;
  signals: Signals;
  scoreBreakdown: ScoreBreakdown[];
  rationale: string;
  selectedInstrument: string;
  stateLabel: string;
};

const actionMetadata: Record<Action | typeof RECOVERY_ACTION, { variants: string[] }> = {
  "Add Funds": {
    variants: [
      "Your account is ready for the next step. Add funds to continue when you’re ready.",
      "You’ve started setting up your account. Add funds whenever it suits you.",
      "A small next step is ready: add funds to keep your activation moving.",
    ],
  },
  "Create Pre-order": {
    variants: [
      "Your selected instrument is ready. Create a pre-order when you’re ready to continue.",
      "You’ve selected an instrument. Save your intent with a pre-order for the next step.",
      "Your research is ready to carry forward. Create a pre-order for the selected instrument.",
    ],
  },
  "Start MF Investing": {
    variants: [
      "Your MF setup is ready. Start investing when you’re comfortable with the next step.",
      "You’ve explored the scheme and SIP details. Start MF investing whenever you’re ready.",
      "Your selected MF journey is ready to continue with a first investment.",
    ],
  },
  "Activate Segment": {
    variants: [
      "Your selected segment is ready for activation. Continue when you’re ready.",
      "You’ve shown interest in this segment. Review and activate it when it suits you.",
      "A segment activation step is available for your account to review.",
    ],
  },
  "Take First Trade": {
    variants: [
      "Your account and saved instrument are ready for review. Take your first trade when you’re ready.",
      "Your selected watchlist item is ready for the next step. Review it before taking your first trade.",
      "You have a saved instrument to review. Continue to the trade ticket when it suits you.",
    ],
  },
  [RECOVERY_ACTION]: {
    variants: [
      "Your KYC details need another review. Complete Re-KYC or Re-KRA to continue.",
      "There’s one account verification step to resolve. Start Re-KYC or Re-KRA when you’re ready.",
      "Your account needs a verification recovery step before product exploration can continue.",
    ],
  },
};

export const DEFAULT_POLICY: Policy = {
  version: "1.0",
  threshold: 60,
  weights: {
    "Add Funds": { order: 25, watchlist: 25, mf: 10, segment: 10, funding: 10 },
    "Create Pre-order": { order: 25, watchlist: 20, mf: 0, segment: 0, funding: 35 },
    "Start MF Investing": { order: 5, watchlist: 5, mf: 45, segment: 0, funding: 25 },
    "Activate Segment": { order: 10, watchlist: 10, mf: 0, segment: 50, funding: 10 },
    "Take First Trade": { order: 25, watchlist: 20, mf: 0, segment: 0, funding: 35 },
  },
  channelPlan: {
    primary: "In-app",
    inApp: "Immediately in the active session",
    push: "30 minutes after exit if incomplete",
    whatsapp: "24 hours later if incomplete and consent eligible",
    consentEligible: true,
  },
  suppressionRules: [
    "Suppress after completion",
    "Suppress after opt-out",
    "Suppress after two ignored pushes in seven days",
  ],
};

const baseState = (overrides: Partial<AccountState> = {}): AccountState => ({
  eSignComplete: true,
  kraStatus: "Approved",
  uccStatus: "Complete",
  mfAccountStatus: "Not started",
  exchangeStatus: "Not approved",
  fundingStatus: "Not started",
  preOrderStatus: "Not started",
  mfOrderStatus: "Not submitted",
  firstTradeStatus: "Not placed",
  segmentStatus: "Not activated",
  a2tStatus: "Not achieved",
  optOut: false,
  ignoredPushes: 0,
  ...overrides,
});

export const CUSTOMER_PROFILES: CustomerProfile[] = [
  {
    id: "FT-20481",
    name: "Arjun Mehta",
    initials: "AM",
    cohort: "Research-led",
    stateLabel: "UCC Mapping",
    cohortDefault: "Create Pre-order",
    accountState: baseState({ uccStatus: "Pending", fundingStatus: "In progress", preOrderStatus: "Started" }),
    completedActionKeys: [],
    selectedInstrument: "NIFTY 50 ETF",
    savedWatchlist: true,
    sipCalculatorUsed: false,
    segmentInterest: false,
    primaryChannel: "In-app",
    rationaleByAction: {
      "Add Funds": "A pre-order has started and the funding flow is already in progress, so Add Funds is the safest next step.",
      "Create Pre-order": "The selected instrument is ready, but funding is still in progress before a pre-order can be submitted.",
    },
    replacementRationale: "Replaced by Add Funds because the funding flow is already in progress.",
    deepLinkContext: "Customer-owned NIFTY 50 ETF context",
    signals: { order: 0.7, watchlist: 0.8, mf: 0.4, segment: 0.3, funding: 0.8 },
  },
  {
    id: "FT-20317",
    name: "Nisha Kulkarni",
    initials: "NK",
    cohort: "MF-first",
    stateLabel: "MF Account",
    cohortDefault: "Start MF Investing",
    accountState: baseState({ mfAccountStatus: "Not started" }),
    completedActionKeys: [],
    selectedInstrument: "Balanced Advantage Fund",
    savedWatchlist: false,
    sipCalculatorUsed: true,
    segmentInterest: false,
    primaryChannel: "WhatsApp",
    rationaleByAction: {
      "Start MF Investing": "Scheme detail and SIP calculator activity show strong MF intent with no completed MF order.",
    },
    replacementRationale: "The MF-first default is retained because no higher-priority completed action suppresses it.",
    deepLinkContext: "Customer-owned SIP calculator context",
    signals: { order: 0, watchlist: 0.6, mf: 1, segment: 0.7, funding: 0.3 },
  },
  {
    id: "FT-20188",
    name: "Rohit Sharma",
    initials: "RS",
    cohort: "Intent-rich",
    stateLabel: "Exchange Approval",
    cohortDefault: "Create Pre-order",
    accountState: baseState({ exchangeStatus: "Approved", preOrderStatus: "Not started" }),
    completedActionKeys: [],
    selectedInstrument: "NIFTY 50",
    savedWatchlist: true,
    sipCalculatorUsed: false,
    segmentInterest: true,
    primaryChannel: "In-app",
    rationaleByAction: {
      "Take First Trade": "Exchange approval is complete and a saved instrument is recent, so Take First Trade wins without repeating completed actions.",
    },
    replacementRationale: "Replaced by Take First Trade because exchange approval is complete and the customer has a saved instrument.",
    deepLinkContext: "Saved watchlist item: NIFTY 50",
    signals: { order: 1, watchlist: 1, mf: 0.7, segment: 1, funding: 0.8 },
  },
  {
    id: "FT-19942",
    name: "Priya Iyer",
    initials: "PI",
    cohort: "New explorer",
    stateLabel: "KRA Rejected",
    cohortDefault: RECOVERY_ACTION,
    accountState: baseState({ kraStatus: "Rejected", uccStatus: "Not started" }),
    completedActionKeys: [],
    selectedInstrument: "None",
    savedWatchlist: false,
    sipCalculatorUsed: false,
    segmentInterest: false,
    primaryChannel: "Push",
    rationaleByAction: {
      [RECOVERY_ACTION]: "KRA was rejected. Recovery is the only eligible path; no product action is scored.",
    },
    replacementRationale: "Trading, funding, MF, and segment actions remain blocked until Re-KYC / Re-KRA is complete.",
    deepLinkContext: "Customer-owned verification recovery context",
    signals: { order: 0, watchlist: 0, mf: 0, segment: 0, funding: 0 },
  },
  {
    id: "FT-19871",
    name: "Kabir Rao",
    initials: "KR",
    cohort: "Segment intent",
    stateLabel: "Segment activation",
    cohortDefault: "Activate Segment",
    accountState: baseState({ segmentStatus: "Not activated" }),
    completedActionKeys: [],
    selectedInstrument: "F&O segment",
    savedWatchlist: true,
    sipCalculatorUsed: false,
    segmentInterest: true,
    primaryChannel: "In-app",
    rationaleByAction: {
      "Activate Segment": "F&O and commodity research is recent, while segment activation is still incomplete.",
    },
    replacementRationale: "Retained because segment activation is the only missing product-owned step for this intent.",
    deepLinkContext: "Customer-owned F&O segment context",
    signals: { order: 0.4, watchlist: 0.8, mf: 0, segment: 1, funding: 0.5 },
  },
  {
    id: "FT-19740",
    name: "Meera Shah",
    initials: "MS",
    cohort: "UCC pending",
    stateLabel: "UCC Mapping",
    cohortDefault: "Add Funds",
    accountState: baseState({ uccStatus: "Pending", fundingStatus: "In progress" }),
    completedActionKeys: [],
    selectedInstrument: "NIFTY 50 ETF",
    savedWatchlist: true,
    sipCalculatorUsed: false,
    segmentInterest: false,
    primaryChannel: "In-app",
    rationaleByAction: {
      "Add Funds": "UCC is pending externally, but research and funding intent remain available for a safe Add Funds step.",
    },
    replacementRationale: "The pending external UCC step does not block product exploration or funding intent.",
    deepLinkContext: "Customer-owned NIFTY 50 ETF context",
    signals: { order: 0.7, watchlist: 0.7, mf: 0.2, segment: 0.2, funding: 0.9 },
  },
  {
    id: "FT-19612",
    name: "Devika Menon",
    initials: "DM",
    cohort: "A2T achieved",
    stateLabel: "A2T complete",
    cohortDefault: NO_RECOMMENDATION,
    accountState: baseState({ a2tStatus: "Achieved through pre-order", preOrderStatus: "Submitted" }),
    completedActionKeys: ["Create Pre-order"],
    selectedInstrument: "NIFTY 50 ETF",
    savedWatchlist: true,
    sipCalculatorUsed: false,
    segmentInterest: false,
    primaryChannel: "In-app",
    rationaleByAction: {},
    replacementRationale: "A2T is already achieved through a submitted pre-order, so all repeat nudges are suppressed.",
    deepLinkContext: "Customer-owned submitted pre-order context",
    signals: { order: 0.8, watchlist: 0.8, mf: 0, segment: 0, funding: 1 },
  },
];

export const stageData = [
  { title: "KRA Stage", pending: "Pending externally", can: "Complete KYC / KRA", cohort: "New explorer", count: "1,204", picks: [RECOVERY_ACTION, "Resume account"] },
  { title: "UCC Mapping Stage", pending: "Pending externally", can: "Add Funds or create a pre-order", cohort: "UCC pending", count: "846", picks: ["Add Funds", "Create Pre-order"] },
  { title: "MF Account Stage", pending: "Pending externally", can: "Start MF Investing", cohort: "MF-first", count: "429", picks: ["Start MF Investing", "Review scheme"] },
  { title: "Exchange Trading Approval Stage", pending: "Pending externally", can: "Take First Trade", cohort: "Intent-rich", count: "188", picks: ["Take First Trade", "Review watchlist"] },
] as const;

const completedLabels: Record<Action, string> = {
  "Add Funds": "Add Funds completed",
  "Create Pre-order": "Pre-order submitted",
  "Start MF Investing": "MF order submitted",
  "Activate Segment": "Segment activated",
  "Take First Trade": "First trade placed",
};

function hasCompletedAction(profile: CustomerProfile, action: Action) {
  return profile.completedActionKeys.includes(action);
}

function scoreFor(action: Action, profile: CustomerProfile, policy: Policy) {
  const weights = policy.weights[action];
  const base = profile.accountState.eSignComplete ? 20 : 0;
  return Math.round(
    base
      + SIGNAL_KEYS.reduce((total, key) => total + profile.signals[key] * weights[key], 0),
  );
}

function deepLinkFor(action: DecisionAction, profile: CustomerProfile) {
  if (action === RECOVERY_ACTION) return "/activate/re-kyc";
  if (action === "No recommendation") return "/activate";
  if (action === "Resume account") return "/activate/resume";
  if (action === "Create Pre-order") return `/activate/pre-order?instrument=${encodeURIComponent(profile.selectedInstrument)}`;
  if (action === "Take First Trade") return `/trade/first?instrument=${encodeURIComponent(profile.selectedInstrument)}`;
  if (action === "Start MF Investing") return `/invest/mutual-funds?context=sip-calculator`;
  if (action === "Activate Segment") return "/activate/segment";
  return "/activate/add-funds";
}

function actionRationale(action: DecisionAction, profile: CustomerProfile) {
  if (action === "No recommendation") return "A2T is already achieved. Completed-action suppression prevents another recommendation.";
  if (action === "Resume account") return "No eligible action clears the current selection threshold. Resume the account journey without forcing a product action.";
  return profile.rationaleByAction[action] ?? `${action} is the highest eligible fit under the current policy.`;
}

function scoreBreakdownFor(profile: CustomerProfile, action: Action, policy: Policy): ScoreBreakdown[] {
  return SIGNAL_KEYS.map((key) => ({
    key,
    label: SIGNAL_LABELS[key],
    value: profile.signals[key],
    contribution: Math.round(profile.signals[key] * policy.weights[action][key]),
  }));
}

export function createDecision(profile: CustomerProfile, policy: Policy): Decision {
  const isA2TAchieved = profile.accountState.a2tStatus !== "Not achieved";
  const recoveryOnly = profile.accountState.kraStatus === "Rejected";
  const eligibleActions: DecisionAction[] = recoveryOnly
    ? [RECOVERY_ACTION]
    : isA2TAchieved
      ? []
      : ACTIONS.filter((action) => {
        if (hasCompletedAction(profile, action)) return false;
        if (action === "Create Pre-order" && profile.selectedInstrument === "None") return false;
        if (action === "Take First Trade" && (profile.accountState.exchangeStatus !== "Approved" || (!profile.savedWatchlist && profile.selectedInstrument === "None"))) return false;
        if (action === "Activate Segment" && !profile.segmentInterest) return false;
        return true;
      });

  const candidateScores = ACTIONS.reduce<Record<Action, number | null>>((scores, action) => {
    scores[action] = !eligibleActions.includes(action)
      ? null
      : scoreFor(action, profile, policy);
    return scores;
  }, {} as Record<Action, number | null>);

  let selectedAction: DecisionAction = NO_RECOMMENDATION;
  if (recoveryOnly) {
    selectedAction = RECOVERY_ACTION;
  } else if (isA2TAchieved) {
    selectedAction = NO_RECOMMENDATION;
  } else if (profile.accountState.exchangeStatus === "Approved" && eligibleActions.includes("Take First Trade")) {
    selectedAction = "Take First Trade";
  } else if (
    profile.accountState.fundingStatus === "Ready"
    && profile.selectedInstrument !== "None"
    && eligibleActions.includes("Create Pre-order")
  ) {
    selectedAction = "Create Pre-order";
  } else if (
    profile.accountState.fundingStatus === "In progress"
    && eligibleActions.includes("Add Funds")
  ) {
    selectedAction = "Add Funds";
  } else {
    const ranked = eligibleActions
      .filter((action): action is Action => ACTIONS.includes(action as Action))
      .sort((left, right) => (candidateScores[right] ?? -1) - (candidateScores[left] ?? -1));
    const top = ranked[0];
    selectedAction = top && (candidateScores[top] ?? 0) >= policy.threshold ? top : RESUME_ACTION;
  }

  const scoreAction = ACTIONS.includes(selectedAction as Action) ? selectedAction as Action : null;
  const selectedScore = scoreAction ? candidateScores[scoreAction] : null;
  const selectedCopyAction = selectedAction === RECOVERY_ACTION ? RECOVERY_ACTION : scoreAction;
  const copyVariants = selectedCopyAction ? actionMetadata[selectedCopyAction].variants : [];
  const completedActions = profile.completedActionKeys.map((action) => completedLabels[action]);
  if (profile.accountState.a2tStatus !== "Not achieved" && completedActions.length === 0) {
    completedActions.push(profile.accountState.a2tStatus);
  }

  return {
    customer: { id: profile.id, name: profile.name, initials: profile.initials },
    cohort: profile.cohort,
    accountState: profile.accountState,
    eligibleActions,
    candidateScores,
    selectedAction,
    selectedScore,
    cohortDefault: profile.cohortDefault,
    replacementRationale: profile.replacementRationale,
    completedActions,
    customerOwnedDeepLinkContext: `${deepLinkFor(selectedAction, profile)} · ${profile.deepLinkContext}`,
    channelPlan: { ...policy.channelPlan, primary: profile.primaryChannel },
    suppressionRules: policy.suppressionRules,
    copyVariants,
    policyVersion: policy.version,
    selectionThreshold: policy.threshold,
    a2tStatus: profile.accountState.a2tStatus,
    signals: profile.signals,
    scoreBreakdown: scoreAction ? scoreBreakdownFor(profile, scoreAction, policy) : [],
    rationale: actionRationale(selectedAction, profile),
    selectedInstrument: profile.selectedInstrument,
    stateLabel: profile.stateLabel,
  };
}

export function decisionsFor(policy: Policy) {
  return CUSTOMER_PROFILES.map((profile) => createDecision(profile, policy));
}

export type SimulatorState = {
  eSignComplete: boolean;
  kraStatus: KRAStatus;
  uccStatus: UCCStatus;
  mfAccountStatus: MFAccountStatus;
  exchangeStatus: ExchangeStatus;
  fundingStatus: FundingStatus;
  preOrderStatus: PreOrderStatus;
  mfOrderStatus: MFOrderStatus;
  firstTradeStatus: FirstTradeStatus;
  segmentStatus: SegmentStatus;
  a2tStatus: A2TStatus;
  savedWatchlist: boolean;
  sipCalculatorUsed: boolean;
  segmentInterest: boolean;
  selectedInstrument: string;
  optOut: boolean;
  ignoredPushes: number;
};

export const SIMULATOR_SCENARIOS = [
  "Research-led account",
  "KRA rejected",
  "UCC pending",
  "MF-first customer",
  "Exchange approved",
  "High intent F&O",
  "A2T achieved",
] as const;
export type SimulatorScenario = (typeof SIMULATOR_SCENARIOS)[number];

const simulatorBase: SimulatorState = {
  eSignComplete: true,
  kraStatus: "Approved",
  uccStatus: "Complete",
  mfAccountStatus: "Not started",
  exchangeStatus: "Not approved",
  fundingStatus: "Not started",
  preOrderStatus: "Not started",
  mfOrderStatus: "Not submitted",
  firstTradeStatus: "Not placed",
  segmentStatus: "Not activated",
  a2tStatus: "Not achieved",
  savedWatchlist: false,
  sipCalculatorUsed: false,
  segmentInterest: false,
  selectedInstrument: "None",
  optOut: false,
  ignoredPushes: 0,
};

export const SCENARIO_PRESETS: Record<SimulatorScenario, SimulatorState> = {
  "Research-led account": {
    ...simulatorBase,
    uccStatus: "Pending",
    fundingStatus: "In progress",
    preOrderStatus: "Started",
    savedWatchlist: true,
    selectedInstrument: "NIFTY 50 ETF",
  },
  "KRA rejected": {
    ...simulatorBase,
    kraStatus: "Rejected",
  },
  "UCC pending": {
    ...simulatorBase,
    uccStatus: "Pending",
    fundingStatus: "In progress",
    savedWatchlist: true,
    selectedInstrument: "NIFTY 50 ETF",
  },
  "MF-first customer": {
    ...simulatorBase,
    mfAccountStatus: "Not started",
    sipCalculatorUsed: true,
    selectedInstrument: "Balanced Advantage Fund",
  },
  "Exchange approved": {
    ...simulatorBase,
    exchangeStatus: "Approved",
    savedWatchlist: true,
    segmentInterest: true,
    selectedInstrument: "NIFTY 50",
  },
  "High intent F&O": {
    ...simulatorBase,
    segmentInterest: true,
    savedWatchlist: true,
    selectedInstrument: "F&O segment",
  },
  "A2T achieved": {
    ...simulatorBase,
    exchangeStatus: "Approved",
    savedWatchlist: true,
    selectedInstrument: "NIFTY 50 ETF",
    preOrderStatus: "Submitted",
    a2tStatus: "Achieved through pre-order",
  },
};

function simulatorSignals(state: SimulatorState): Signals {
  return {
    order: state.fundingStatus === "Not started" ? 0 : state.fundingStatus === "Ready" ? 0.9 : 0.7,
    watchlist: state.savedWatchlist ? 0.9 : 0,
    mf: state.sipCalculatorUsed ? 0.95 : 0,
    segment: state.segmentInterest ? 1 : 0,
    funding: state.fundingStatus === "Ready" ? 1 : state.fundingStatus === "In progress" ? 0.85 : 0,
  };
}

export function profileFromSimulator(state: SimulatorState): CustomerProfile {
  const completedActionKeys: Action[] = [];
  if (state.fundingStatus === "Complete") completedActionKeys.push("Add Funds");
  if (state.preOrderStatus === "Submitted") completedActionKeys.push("Create Pre-order");
  if (state.mfOrderStatus === "Submitted") completedActionKeys.push("Start MF Investing");
  if (state.segmentStatus === "Activated") completedActionKeys.push("Activate Segment");
  if (state.firstTradeStatus === "Placed") completedActionKeys.push("Take First Trade");
  const resolvedA2TStatus: A2TStatus = state.a2tStatus !== "Not achieved"
    ? state.a2tStatus
    : state.preOrderStatus === "Submitted"
      ? "Achieved through pre-order"
      : state.mfOrderStatus === "Submitted"
        ? "Achieved through MF order"
        : state.firstTradeStatus === "Placed"
          ? "Achieved through first trade"
          : "Not achieved";

  return {
    id: "SIM-001",
    name: "Simulator customer",
    initials: "SC",
    cohort: "Live scenario",
    stateLabel: state.kraStatus === "Rejected" ? "KRA Rejected" : state.exchangeStatus === "Approved" ? "Exchange Approval" : state.uccStatus,
    cohortDefault: state.segmentInterest ? "Activate Segment" : state.sipCalculatorUsed ? "Start MF Investing" : "Add Funds",
    accountState: {
      eSignComplete: state.eSignComplete,
      kraStatus: state.kraStatus,
      uccStatus: state.uccStatus,
      mfAccountStatus: state.mfAccountStatus,
      exchangeStatus: state.exchangeStatus,
      fundingStatus: state.fundingStatus,
      preOrderStatus: state.preOrderStatus,
      mfOrderStatus: state.mfOrderStatus,
      firstTradeStatus: state.firstTradeStatus,
      segmentStatus: state.segmentStatus,
      a2tStatus: resolvedA2TStatus,
      optOut: state.optOut,
      ignoredPushes: state.ignoredPushes,
    },
    completedActionKeys,
    selectedInstrument: state.selectedInstrument,
    savedWatchlist: state.savedWatchlist,
    sipCalculatorUsed: state.sipCalculatorUsed,
    segmentInterest: state.segmentInterest,
    primaryChannel: "In-app",
    rationaleByAction: {
      "Add Funds": "Funding intent is in progress and UCC remains externally pending, but product exploration is still available.",
      "Create Pre-order": "Funds are ready and a selected instrument is present, so a pre-order is the next safe product-owned step.",
      "Start MF Investing": "SIP calculator activity is strong and no MF order has been submitted.",
      "Activate Segment": "Segment intent is high and the account has not activated the segment.",
      "Take First Trade": state.exchangeStatus === "Approved"
        ? "Exchange approval is complete and the saved instrument is ready for customer review."
        : "Exchange approval is not complete, so Take First Trade is not eligible.",
      [RECOVERY_ACTION]: "KRA was rejected. Recovery is the only eligible path; no score is calculated.",
    },
    replacementRationale: state.kraStatus === "Rejected"
      ? "Rejected KRA changes the path to recovery-only."
      : "The selected action is retained because completed actions are removed before selection.",
    deepLinkContext: state.selectedInstrument === "None"
      ? "No instrument context selected"
      : `Selected product context: ${state.selectedInstrument}`,
    signals: simulatorSignals(state),
  };
}