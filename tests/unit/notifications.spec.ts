import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  profiles: [] as Array<{ id: string; role: string; locale: string | null; full_name: string | null }>,
  quote: { id: "quote-1", title: "Test Quote", customer_id: "customer-1" } as { id: string; title: string | null; customer_id: string } | null,
  quoteWorkers: [] as Array<{ worker_id: string }>,
  authEmails: {} as Record<string, string>,
  insertDuplicate: false,
  notificationRows: [] as Array<{ id: string; quote_id: string; event_type: string; recipient_user_id: string; dedupe_key: string; status: "pending" | "sent" | "failed"; created_at: string; updated_at: string }>,
  updatePayloads: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/env", () => ({
  env: {
    appUrl: "https://app.example.com",
    edgeFunctionUrl: "https://edge.example.com/send-email",
    edgeFunctionSecret: "test-secret",
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeAdminClient,
}));

vi.stubGlobal("fetch", mocks.fetch);

class FakeQueryBuilder {
  private filters = new Map<string, unknown>();
  private inFilters = new Map<string, unknown[]>();

  constructor(private readonly table: string) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilters.set(column, values);
    return this;
  }

  async maybeSingle() {
    const rows = this.resolveRows();
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({ data: this.resolveRows(), error: null }).then(onfulfilled, onrejected);
  }

  private resolveRows() {
    if (this.table === "profiles") {
      const role = this.filters.get("role");
      const id = this.filters.get("id");
      const ids = this.inFilters.get("id");

      if (role) {
        return mocks.profiles.filter((profile) => profile.role === role);
      }

      if (id) {
        return mocks.profiles.filter((profile) => profile.id === id);
      }

      if (ids) {
        return mocks.profiles.filter((profile) => ids.includes(profile.id));
      }

      return mocks.profiles;
    }

    if (this.table === "quotes") {
      const id = this.filters.get("id");
      return mocks.quote && (!id || mocks.quote.id === id) ? [mocks.quote] : [];
    }

    if (this.table === "quote_workers") {
      return mocks.quoteWorkers;
    }

    return [];
  }
}

class FakeEmailNotificationsBuilder {
  private filters = new Map<string, unknown>();

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const rows = mocks.notificationRows.filter((row) => {
      for (const [column, value] of this.filters.entries()) {
        if ((row as Record<string, unknown>)[column] !== value) {
          return false;
        }
      }

      return true;
    });

    return Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected);
  }

  insert(payload: Record<string, unknown>) {
    return {
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => {
          if (mocks.insertDuplicate) {
            return {
              data: null,
              error: {
                code: "23505",
                message: "duplicate key value violates unique constraint email_notifications_dedup_unique",
              },
            };
          }

          const id = `log-${mocks.notificationRows.length + 1}`;
          mocks.notificationRows.push({
            id,
            quote_id: String(payload.quote_id),
            event_type: String(payload.event_type),
            recipient_user_id: String(payload.recipient_user_id),
            dedupe_key: String(payload.dedupe_key),
            status: "pending",
            created_at: new Date(mocks.notificationRows.length + 1).toISOString(),
            updated_at: new Date(mocks.notificationRows.length + 1).toISOString(),
          });

          return { data: { id }, error: null };
        }),
      })),
    };
  }

  update(payload: Record<string, unknown>) {
    return {
      eq: vi.fn(async (column: string, value: unknown) => {
        mocks.updatePayloads.push(payload);
        if (column === "id") {
          const row = mocks.notificationRows.find((notification) => notification.id === value);
          if (row && typeof payload.status === "string") {
            row.status = payload.status as "pending" | "sent" | "failed";
            row.updated_at = typeof payload.updated_at === "string" ? payload.updated_at : row.updated_at;
          }
        }
        return { error: null };
      }),
    };
  }
}

const fakeAdminClient = {
  from(table: string) {
    if (table === "email_notifications") {
      return new FakeEmailNotificationsBuilder();
    }

    return new FakeQueryBuilder(table);
  },
  auth: {
    admin: {
      getUserById: vi.fn(async (id: string) => {
        const email = mocks.authEmails[id];
        return email
          ? { data: { user: { email } }, error: null }
          : { data: { user: null }, error: { message: "not found" } };
      }),
    },
  },
};

function resetFakeData() {
  mocks.profiles = [
    { id: "admin-1", role: "admin", locale: "en", full_name: "Admin One" },
    { id: "customer-1", role: "customer", locale: "it", full_name: "Customer One" },
    { id: "worker-1", role: "worker", locale: "en", full_name: "Worker One" },
  ];
  mocks.quote = { id: "quote-1", title: "Test Quote", customer_id: "customer-1" };
  mocks.quoteWorkers = [{ worker_id: "worker-1" }];
  mocks.authEmails = {
    "admin-1": "admin@example.com",
    "customer-1": "customer@example.com",
    "worker-1": "worker@example.com",
  };
  mocks.insertDuplicate = false;
  mocks.notificationRows = [];
  mocks.updatePayloads = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  resetFakeData();
  mocks.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
});

describe("resolveRecipients", () => {
  it("returns admins when includeAdmins=true", async () => {
    const { resolveRecipients } = await import("@/lib/notifications");
    const recipients = await resolveRecipients("quote-1", true, false, false);

    expect(recipients).toEqual([
      { userId: "admin-1", role: "admin", email: "admin@example.com", locale: "en" },
    ]);
  });

  it("includes workers from quote_workers when includeWorkers=true", async () => {
    const { resolveRecipients } = await import("@/lib/notifications");
    const recipients = await resolveRecipients("quote-1", false, false, true);

    expect(recipients).toEqual([
      { userId: "worker-1", role: "worker", email: "worker@example.com", locale: "en" },
    ]);
  });

  it("dedupes by userId when the same person appears from multiple sources", async () => {
    mocks.quote = { id: "quote-1", title: "Test Quote", customer_id: "admin-1" };
    mocks.quoteWorkers = [{ worker_id: "admin-1" }];

    const { resolveRecipients } = await import("@/lib/notifications");
    const recipients = await resolveRecipients("quote-1", true, true, true);

    expect(recipients.filter((recipient) => recipient.userId === "admin-1")).toHaveLength(1);
  });
});

describe("quote notification dispatch", () => {
  it("notifyQuoteCreated posts the expected Edge Function payload", async () => {
    const { notifyQuoteCreated } = await import("@/lib/notifications");

    await notifyQuoteCreated("quote-1", "customer-1");

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = mocks.fetch.mock.calls[0]!;
    expect(url).toBe("https://edge.example.com/send-email");
    expect(options.headers.Authorization).toBe("Bearer test-secret");
    const body = JSON.parse(options.body as string);
    expect(body).toMatchObject({
      eventType: "quote_created",
      quoteId: "quote-1",
      recipientUserId: "admin-1",
      to: "admin@example.com",
      locale: "en",
    });
    expect(body.subject).toContain("New Quote");
  });

  it("notifyQuoteConverted posts payloads for admin, customer, and worker", async () => {
    const { notifyQuoteConverted } = await import("@/lib/notifications");

    await notifyQuoteConverted("quote-1");

    const bodies = mocks.fetch.mock.calls.map(([, options]) => JSON.parse(options.body as string));
    expect(bodies).toHaveLength(3);
    expect(bodies.map((body) => body.eventType)).toEqual(["quote_converted", "quote_converted", "quote_converted"]);
    expect(bodies.map((body) => body.recipientUserId).sort()).toEqual(["admin-1", "customer-1", "worker-1"]);
  });

  it("notifyQuoteReverted posts expected reverted payloads", async () => {
    const { notifyQuoteReverted } = await import("@/lib/notifications");

    await notifyQuoteReverted("quote-1");

    const bodies = mocks.fetch.mock.calls.map(([, options]) => JSON.parse(options.body as string));
    expect(bodies).toHaveLength(3);
    expect(bodies.every((body) => body.eventType === "quote_reverted")).toBe(true);
    expect(bodies[0]!.subject).toContain("Preventivo riportato in bozza");
  });
});

describe("notification log status updates", () => {
  it("updates the log to sent after successful dispatch", async () => {
    const { notifyQuoteCreated } = await import("@/lib/notifications");

    await notifyQuoteCreated("quote-1", "customer-1");

    expect(mocks.updatePayloads).toContainEqual({ status: "sent", error_message: null, updated_at: expect.any(String) });
  });

  it("updates the log to failed with an error message when dispatch fails", async () => {
    mocks.fetch.mockRejectedValue(new Error("Edge function unreachable"));
    const { notifyQuoteCreated } = await import("@/lib/notifications");

    await notifyQuoteCreated("quote-1", "customer-1");

    expect(mocks.updatePayloads).toContainEqual({
      status: "failed",
      error_message: "Edge function unreachable",
      updated_at: expect.any(String),
    });
  });
});

describe("duplicate notification handling", () => {
  it("skips resend when a sent notification already exists for the same dedupe key", async () => {
    mocks.notificationRows = [{
      id: "existing-log",
      quote_id: "quote-1",
      event_type: "quote_created",
      recipient_user_id: "admin-1",
      dedupe_key: "quote-created:quote-1",
      status: "sent",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }];
    const { notifyQuoteCreated } = await import("@/lib/notifications");

    await notifyQuoteCreated("quote-1", "customer-1");

    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("retries when a failed notification exists for the same dedupe key", async () => {
    mocks.notificationRows = [{
      id: "failed-log",
      quote_id: "quote-1",
      event_type: "quote_created",
      recipient_user_id: "admin-1",
      dedupe_key: "quote-created:quote-1",
      status: "failed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }];
    mocks.insertDuplicate = true;
    const { notifyQuoteCreated } = await import("@/lib/notifications");

    await notifyQuoteCreated("quote-1", "customer-1");

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.updatePayloads).toContainEqual({ status: "pending", error_message: null, updated_at: expect.any(String) });
    expect(mocks.updatePayloads).toContainEqual({ status: "sent", error_message: null, updated_at: expect.any(String) });
  });

  it("retries a stale pending notification instead of skipping it forever", async () => {
    mocks.notificationRows = [{
      id: "pending-log",
      quote_id: "quote-1",
      event_type: "quote_created",
      recipient_user_id: "admin-1",
      dedupe_key: "quote-created:quote-1",
      status: "pending",
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    }];
    const { notifyQuoteCreated } = await import("@/lib/notifications");

    await notifyQuoteCreated("quote-1", "customer-1");

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.updatePayloads).toContainEqual({ status: "sent", error_message: null, updated_at: expect.any(String) });
  });
});

describe("fire-and-forget failure behavior", () => {
  it("notifyQuoteCreated resolves without throwing when fetch rejects", async () => {
    mocks.fetch.mockRejectedValue(new Error("Network failure"));
    const { notifyQuoteCreated } = await import("@/lib/notifications");

    await expect(notifyQuoteCreated("quote-1", "customer-1")).resolves.toBeUndefined();
  });

  it("notifyQuoteConverted resolves without throwing when fetch rejects", async () => {
    mocks.fetch.mockRejectedValue(new Error("Network failure"));
    const { notifyQuoteConverted } = await import("@/lib/notifications");

    await expect(notifyQuoteConverted("quote-1")).resolves.toBeUndefined();
  });

  it("notifyQuoteReverted resolves without throwing when fetch rejects", async () => {
    mocks.fetch.mockRejectedValue(new Error("Network failure"));
    const { notifyQuoteReverted } = await import("@/lib/notifications");

    await expect(notifyQuoteReverted("quote-1")).resolves.toBeUndefined();
  });
});
