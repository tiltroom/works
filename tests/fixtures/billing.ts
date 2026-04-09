import type {
  QuoteLoggedHourRecord,
  QuotePrepaymentSessionRecord,
  QuoteRecord,
  QuoteSubtaskEstimateRecord,
  QuoteSubtaskEntryRecord,
  QuoteSubtaskRecord,
  QuoteWorkerRecord,
} from "@/lib/quotes";

interface BillingFixtureOverrides {
  quote?: Partial<QuoteRecord>;
  workers?: Array<Partial<QuoteWorkerRecord>>;
  subtasks?: Array<Partial<QuoteSubtaskRecord>>;
  estimates?: Array<Partial<QuoteSubtaskEstimateRecord>>;
  loggedHours?: Array<Partial<QuoteLoggedHourRecord>>;
  timeEntries?: Array<Partial<QuoteSubtaskEntryRecord>>;
  prepayment?: Partial<QuotePrepaymentSessionRecord>;
}

export interface BillingScenarioFixture {
  quote: QuoteRecord;
  workers: QuoteWorkerRecord[];
  subtasks: QuoteSubtaskRecord[];
  estimates: QuoteSubtaskEstimateRecord[];
  loggedHours: QuoteLoggedHourRecord[];
  timeEntries: QuoteSubtaskEntryRecord[];
  prepayment: QuotePrepaymentSessionRecord;
}

const defaultQuote: QuoteRecord = {
  id: "quote_test_001",
  title: "Website redesign",
  description: "Phase 1 billing harness fixture",
  contentHtml: "<p>Scope of work</p>",
  contentJson: null,
  status: "signed",
  billingMode: "prepaid",
  customerId: "customer_001",
  customerName: "Acme SRL",
  totalEstimatedHours: 18,
  totalLoggedHours: 5.5,
  signedByName: "Casey Customer",
  signedAt: "2026-04-08T09:00:00.000Z",
  signedByUserId: "customer_user_001",
  linkedProjectId: "project_001",
  linkedProjectName: "Acme redesign",
  projectId: "project_001",
  projectName: "Acme redesign",
  convertedAt: null,
  createdBy: "admin_001",
  createdAt: "2026-04-07T09:00:00.000Z",
  updatedAt: "2026-04-08T09:00:00.000Z",
  scopeOfWork: "<p>Scope of work</p>",
  signatureName: "Casey Customer",
  adminNotes: "Fixture only",
  confirmedAt: "2026-04-08T09:10:00.000Z",
  conversionRequestedAt: null,
  prepaymentRequestedAt: "2026-04-08T09:15:00.000Z",
};

const defaultWorkers: QuoteWorkerRecord[] = [
  {
    quoteId: defaultQuote.id,
    workerId: "worker_001",
    workerName: "Wanda Worker",
    assignedAt: "2026-04-07T10:00:00.000Z",
    assignedBy: "admin_001",
  },
];

const defaultSubtasks: QuoteSubtaskRecord[] = [
  {
    id: "subtask_001",
    quoteId: defaultQuote.id,
    title: "Design system audit",
    description: "Review the current UI components",
    estimatedHours: 6,
    sortOrder: 1,
    createdBy: "admin_001",
    createdAt: "2026-04-07T10:00:00.000Z",
    updatedAt: "2026-04-07T10:00:00.000Z",
  },
  {
    id: "subtask_002",
    quoteId: defaultQuote.id,
    title: "Responsive landing page",
    description: "Implement the approved design",
    estimatedHours: 12,
    sortOrder: 2,
    createdBy: "admin_001",
    createdAt: "2026-04-07T10:15:00.000Z",
    updatedAt: "2026-04-07T10:15:00.000Z",
  },
];

const defaultEstimates: QuoteSubtaskEstimateRecord[] = [
  {
    id: "estimate_001",
    quoteId: defaultQuote.id,
    workerId: "worker_001",
    workerName: "Wanda Worker",
    title: "Design system audit",
    note: "Initial audit and report",
    estimatedHours: 6,
    createdAt: "2026-04-07T10:00:00.000Z",
  },
  {
    id: "estimate_002",
    quoteId: defaultQuote.id,
    workerId: "worker_001",
    workerName: "Wanda Worker",
    title: "Responsive landing page",
    note: "Implementation and QA",
    estimatedHours: 12,
    createdAt: "2026-04-07T10:15:00.000Z",
  },
];

const defaultLoggedHours: QuoteLoggedHourRecord[] = [
  {
    id: "logged_001",
    quoteId: defaultQuote.id,
    workerId: "worker_001",
    workerName: "Wanda Worker",
    title: "Audit call",
    note: "Kickoff workshop",
    hoursLogged: 2,
    createdAt: "2026-04-08T10:00:00.000Z",
  },
  {
    id: "logged_002",
    quoteId: defaultQuote.id,
    workerId: "worker_001",
    workerName: "Wanda Worker",
    title: "Wireframes",
    note: "Homepage and pricing drafts",
    hoursLogged: 3.5,
    createdAt: "2026-04-08T14:00:00.000Z",
  },
];

const defaultTimeEntries: QuoteSubtaskEntryRecord[] = [
  {
    id: "entry_001",
    quoteSubtaskId: "subtask_001",
    workerId: "worker_001",
    workerName: "Wanda Worker",
    loggedHours: 2,
    note: "Kickoff workshop",
    createdAt: "2026-04-08T10:00:00.000Z",
    updatedAt: "2026-04-08T10:00:00.000Z",
  },
  {
    id: "entry_002",
    quoteSubtaskId: "subtask_002",
    workerId: "worker_001",
    workerName: "Wanda Worker",
    loggedHours: 3.5,
    note: "Homepage wireframes",
    createdAt: "2026-04-08T14:00:00.000Z",
    updatedAt: "2026-04-08T14:00:00.000Z",
  },
];

const defaultPrepayment: QuotePrepaymentSessionRecord = {
  id: "prep_001",
  quoteId: defaultQuote.id,
  customerId: defaultQuote.customerId,
  stripeCheckoutSessionId: "cs_test_001",
  estimatedHoursSnapshot: defaultQuote.totalEstimatedHours,
  amountCents: 90000,
  currency: "usd",
  status: "pending",
  stripeEventId: null,
  paidAt: null,
  createdAt: "2026-04-08T09:15:00.000Z",
};

function mergeList<T>(defaults: T[], overrides: Array<Partial<T>> | undefined): T[] {
  if (!overrides?.length) {
    return defaults;
  }

  return defaults.map((item, index) => ({
    ...item,
    ...overrides[index],
  }));
}

export function createBillingScenarioFixture(overrides: BillingFixtureOverrides = {}): BillingScenarioFixture {
  const quote = {
    ...defaultQuote,
    ...overrides.quote,
  };

  return {
    quote,
    workers: mergeList(defaultWorkers, overrides.workers).map((worker) => ({
      ...worker,
      quoteId: quote.id,
    })),
    subtasks: mergeList(defaultSubtasks, overrides.subtasks).map((subtask) => ({
      ...subtask,
      quoteId: quote.id,
    })),
    estimates: mergeList(defaultEstimates, overrides.estimates).map((estimate) => ({
      ...estimate,
      quoteId: quote.id,
    })),
    loggedHours: mergeList(defaultLoggedHours, overrides.loggedHours).map((entry) => ({
      ...entry,
      quoteId: quote.id,
    })),
    timeEntries: mergeList(defaultTimeEntries, overrides.timeEntries),
    prepayment: {
      ...defaultPrepayment,
      quoteId: quote.id,
      customerId: quote.customerId,
      estimatedHoursSnapshot: quote.totalEstimatedHours,
      ...overrides.prepayment,
    },
  };
}
