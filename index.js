import { tool } from "@opencode-ai/plugin";
import os from "node:os";
import path from "node:path";

import { JobStore } from "./src/store.js";
import { createId, parseDelay, resolveRunAt, toIso } from "./src/utils.js";

const STORE_PATH =
  process.env.OPENCODE_INTERNAL_SCHEDULE_STORE ||
  path.join(
    os.homedir(),
    ".local",
    "share",
    "opencode",
    "internal-schedule",
    "jobs.json",
  );
const STATE_KEY = Symbol.for("oc-internal-schedule.state");

function getGlobalState() {
  if (!globalThis[STATE_KEY]) {
    globalThis[STATE_KEY] = {
      manager: new SelfMessageManager(new JobStore(STORE_PATH)),
    };
  }
  return globalThis[STATE_KEY];
}

class SelfMessageManager {
  constructor(store) {
    this.store = store;
    this.timers = new Map();
    this.dispatchers = new Map();
    this.restoredProjects = new Set();
  }

  registerProject(projectID, dispatcher) {
    this.dispatchers.set(projectID, dispatcher);
  }

  async restoreProject(projectID) {
    if (this.restoredProjects.has(projectID)) return;
    this.restoredProjects.add(projectID);

    const jobs = await this.store.list();
    for (const job of jobs) {
      if (job.projectID !== projectID) continue;
      if (job.status !== "scheduled") continue;
      this.arm(job);
    }
  }

  async schedule(input) {
    const now = input.now ?? new Date();
    const runAt = resolveRunAt({ inDelay: input.in, at: input.at, now });
    const job = {
      id: input.id ?? createId("selfmsg"),
      projectID: input.projectID,
      sessionID: input.sessionID,
      message: input.message,
      agent: input.agent ?? null,
      system: input.system ?? null,
      variant: input.variant ?? null,
      noReply: input.noReply ?? false,
      everyMs: input.every ? parseDelay(input.every) : null,
      runAt: toIso(runAt),
      createdAt: toIso(now),
      lastRunAt: null,
      lastError: null,
      status: "scheduled",
    };

    await this.store.add(job);
    this.arm(job);
    return job;
  }

  async list(filter = {}) {
    const jobs = await this.store.list();
    return jobs.filter((job) => {
      if (filter.projectID && job.projectID !== filter.projectID) return false;
      if (filter.sessionID && job.sessionID !== filter.sessionID) return false;
      return true;
    });
  }

  async cancel(jobID) {
    const timer = this.timers.get(jobID);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobID);
    }
    return this.store.remove(jobID);
  }

  arm(job) {
    const existing = this.timers.get(job.id);
    if (existing) clearTimeout(existing);

    const delay = Math.max(0, new Date(job.runAt).getTime() - Date.now());
    const timer = setTimeout(() => {
      this.timers.delete(job.id);
      void this.execute(job.id);
    }, delay);
    this.timers.set(job.id, timer);
  }

  async execute(jobID) {
    const jobs = await this.store.list();
    const job = jobs.find((item) => item.id === jobID);
    if (!job || job.status !== "scheduled") return;

    const dispatcher = this.dispatchers.get(job.projectID);
    const now = new Date();

    if (!dispatcher) {
      await this.store.update(jobID, (current) => ({
        ...current,
        lastRunAt: toIso(now),
        lastError: `No active OpenCode dispatcher for project ${job.projectID}`,
      }));
      if (job.everyMs) {
        const next = {
          ...job,
          runAt: toIso(new Date(now.getTime() + job.everyMs)),
        };
        await this.store.update(jobID, () => next);
        this.arm(next);
      }
      return;
    }

    try {
      await dispatcher(job);
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

      await this.store.update(jobID, () => next);
      if (next.status === "scheduled") this.arm(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const next = {
        ...job,
        lastRunAt: toIso(now),
        lastError: message,
        status: job.everyMs ? "scheduled" : "failed",
      };
      await this.store.update(jobID, () => next);
      if (job.everyMs) {
        const recurring = {
          ...next,
          runAt: toIso(new Date(now.getTime() + job.everyMs)),
        };
        await this.store.update(jobID, () => recurring);
        this.arm(recurring);
      }
    }
  }
}

function formatSchedulerError(error, job) {
  const fallback = error instanceof Error ? error.message : String(error);

  if (fallback && fallback !== "[object Object]") {
    if (fallback.includes("is busy")) {
      return `Scheduled self-message could not run because session '${job.sessionID}' is busy. Try again later or use a recurring reminder.`;
    }
    return fallback;
  }

  if (error && typeof error === "object") {
    const maybeMessage =
      error.body?.message ||
      error.body?.error?.message ||
      error.error?.message ||
      error.message;

    if (typeof maybeMessage === "string" && maybeMessage) {
      if (maybeMessage.includes("is busy")) {
        return `Scheduled self-message could not run because session '${job.sessionID}' is busy. Try again later or use a recurring reminder.`;
      }
      return maybeMessage;
    }

    try {
      const json = JSON.stringify(error, null, 2);
      if (json && json !== "{}") return json;
    } catch {}
  }

  return `Scheduled self-message failed for session '${job.sessionID}' with an unknown error.`;
}

async function dispatchScheduledPrompt(client, job) {
  const payload = {
    path: { id: job.sessionID },
    body: {
      agent: job.agent || undefined,
      system: job.system || undefined,
      variant: job.variant || undefined,
      noReply: job.noReply,
      parts: [
        {
          type: "text",
          text: job.message,
        },
      ],
    },
    throwOnError: true,
  };

  if (job.noReply) {
    return client.session.promptAsync(payload);
  }

  return client.session.prompt(payload);
}

export async function InternalSchedulePlugin({ client, project }) {
  const manager = getGlobalState().manager;

  manager.registerProject(project.id, async (job) => {
    try {
      await dispatchScheduledPrompt(client, job);
    } catch (error) {
      throw new Error(formatSchedulerError(error, job));
    }
  });

  await manager.restoreProject(project.id);

  return {
    tool: {
      schedule_self_message: tool({
        description:
          "Schedule a prompt to be injected back into the current OpenCode session later or on a recurring interval.",
        args: {
          message: tool.schema
            .string()
            .describe("Message to inject back into the current session"),
          in: tool.schema
            .string()
            .optional()
            .describe("Relative delay like 5m, 30s, 1h"),
          at: tool.schema
            .string()
            .optional()
            .describe("Absolute ISO date/time to run at"),
          every: tool.schema
            .string()
            .optional()
            .describe("Recurring interval like 10m, 1h, 1d"),
          agent: tool.schema
            .string()
            .optional()
            .describe("Optional agent override for the injected prompt"),
          variant: tool.schema
            .string()
            .optional()
            .describe("Optional model variant override"),
          system: tool.schema
            .string()
            .optional()
            .describe("Optional system prompt override"),
          noReply: tool.schema
            .boolean()
            .optional()
            .describe(
              "If true, injects silently without generating a visible assistant reply",
            ),
        },
        async execute(args, context) {
          const job = await manager.schedule({
            ...args,
            projectID: project.id,
            sessionID: context.sessionID,
          });

          return [
            `Scheduled self-message '${job.id}'.`,
            `Session: ${job.sessionID}`,
            `Run at: ${job.runAt}`,
            job.everyMs ? `Recurring every: ${job.everyMs}ms` : "Recurring: no",
          ].join("\n");
        },
      }),
      list_scheduled_self_messages: tool({
        description:
          "List scheduled self-messages for the current session or the whole current project.",
        args: {
          scope: tool.schema
            .enum(["session", "project"])
            .optional()
            .describe("Filter by current session only or the whole project"),
        },
        async execute(args, context) {
          const jobs = await manager.list({
            projectID: project.id,
            sessionID: args.scope === "project" ? undefined : context.sessionID,
          });

          if (jobs.length === 0) {
            return "No scheduled self-messages found.";
          }

          return jobs
            .map(
              (job) =>
                `${job.id} | status=${job.status} | session=${job.sessionID} | runAt=${job.runAt}${job.everyMs ? ` | every=${job.everyMs}ms` : ""}${job.lastError ? ` | lastError=${job.lastError}` : ""}`,
            )
            .join("\n");
        },
      }),
      cancel_scheduled_self_message: tool({
        description: "Cancel a scheduled self-message by id.",
        args: {
          id: tool.schema.string().describe("Scheduled self-message id"),
        },
        async execute(args) {
          const ok = await manager.cancel(args.id);
          return ok
            ? `Cancelled scheduled self-message '${args.id}'.`
            : `No scheduled self-message found for '${args.id}'.`;
        },
      }),
    },
    event: async ({ event }) => {
      if (event.type !== "session.deleted") return;
      const jobs = await manager.list({
        projectID: project.id,
        sessionID: event.properties.sessionID,
      });
      await Promise.all(jobs.map((job) => manager.cancel(job.id)));
    },
  };
}

export default {
  id: "oc-internal-schedule",
  server: InternalSchedulePlugin,
};
