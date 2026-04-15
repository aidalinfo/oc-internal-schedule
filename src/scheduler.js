import { createId, parseDelay, resolveRunAt, toIso, assert } from "./utils.js";
import { sendPrompt, sendPromptAsync } from "./opencode-client.js";

export class SessionScheduler {
  constructor({ store, apiBaseUrl }) {
    this.store = store;
    this.apiBaseUrl = apiBaseUrl;
  }

  async schedule(input) {
    assert(input.sessionID, "Missing sessionID");
    assert(input.message, "Missing message");

    const runAt = resolveRunAt({
      inDelay: input.in,
      at: input.at,
      now: input.now ?? new Date(),
    });

    const recurringEveryMs = input.every ? parseDelay(input.every) : null;
    const job = {
      id: input.id ?? createId(),
      sessionID: input.sessionID,
      message: input.message,
      agent: input.agent ?? null,
      system: input.system ?? null,
      variant: input.variant ?? null,
      noReply: input.noReply ?? false,
      apiBaseUrl: input.apiBaseUrl ?? this.apiBaseUrl,
      runAt: toIso(runAt),
      everyMs: recurringEveryMs,
      status: "scheduled",
      lastRunAt: null,
      lastError: null,
      createdAt: toIso(new Date()),
    };

    return this.store.add(job);
  }

  async list() {
    return this.store.list();
  }

  async cancel(jobID) {
    return this.store.remove(jobID);
  }

  async runDue(now = new Date()) {
    const jobs = await this.store.list();
    const results = [];

    for (const job of jobs) {
      if (job.status !== "scheduled") continue;
      if (new Date(job.runAt).getTime() > now.getTime()) continue;

      try {
        const sender = job.noReply ? sendPromptAsync : sendPrompt;
        await sender({
          apiBaseUrl: job.apiBaseUrl,
          sessionID: job.sessionID,
          message: job.message,
          agent: job.agent ?? undefined,
          system: job.system ?? undefined,
          variant: job.variant ?? undefined,
          noReply: job.noReply,
        });

        const next = job.everyMs
          ? {
              ...job,
              runAt: toIso(new Date(now.getTime() + job.everyMs)),
              lastRunAt: toIso(now),
              lastError: null,
            }
          : {
              ...job,
              status: "completed",
              lastRunAt: toIso(now),
              lastError: null,
            };

        await this.store.update(job.id, () => next);
        results.push({ id: job.id, ok: true, recurring: Boolean(job.everyMs) });
      } catch (error) {
        await this.store.update(job.id, (current) => ({
          ...current,
          status: current.everyMs ? "scheduled" : "failed",
          lastError: error instanceof Error ? error.message : String(error),
          lastRunAt: toIso(now),
        }));
        results.push({
          id: job.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  async runDaemon({ pollMs = 5000, signal }) {
    while (!signal?.aborted) {
      await this.runDue(new Date());
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
}
