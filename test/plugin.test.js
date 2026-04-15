import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const originalStore = process.env.OPENCODE_INTERNAL_SCHEDULE_STORE;

test("schedule_self_message tool injects a deferred prompt into the current session", async () => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "oc-internal-schedule-plugin-"),
  );
  process.env.OPENCODE_INTERNAL_SCHEDULE_STORE = path.join(dir, "jobs.json");

  const calls = [];
  const client = {
    session: {
      async prompt(input) {
        calls.push({ kind: "prompt", input });
        return { data: undefined };
      },
      async promptAsync(input) {
        calls.push({ kind: "promptAsync", input });
        return { data: undefined };
      },
    },
  };

  const mod = await import(`../index.js?test=${Date.now()}`);
  const hooks = await mod.InternalSchedulePlugin({
    client,
    project: { id: "proj_test_plugin" },
  });

  const result = await hooks.tool.schedule_self_message.execute(
    {
      message: "Re-check the current run in 50ms",
      in: "50ms",
    },
    {
      sessionID: "ses_current",
      messageID: "msg_current",
      agent: "primary",
      directory: "/tmp",
      worktree: "/tmp",
      abort: new AbortController().signal,
      metadata() {},
      ask() {
        throw new Error("ask should not be called in this test");
      },
    },
  );

  assert.match(result, /Scheduled self-message/);

  await new Promise((resolve) => setTimeout(resolve, 120));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, "prompt");
  assert.equal(calls[0].input.path.id, "ses_current");
  assert.equal(
    calls[0].input.body.parts[0].text,
    "Re-check the current run in 50ms",
  );
  assert.equal(calls[0].input.body.noReply, false);
});

test("schedule_self_message uses prompt_async for silent reminders", async () => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "oc-internal-schedule-plugin-silent-"),
  );
  process.env.OPENCODE_INTERNAL_SCHEDULE_STORE = path.join(dir, "jobs.json");

  const calls = [];
  const client = {
    session: {
      async prompt(input) {
        calls.push({ kind: "prompt", input });
        return { data: undefined };
      },
      async promptAsync(input) {
        calls.push({ kind: "promptAsync", input });
        return { data: undefined };
      },
    },
  };

  const mod = await import(`../index.js?test=silent-${Date.now()}`);
  const hooks = await mod.InternalSchedulePlugin({
    client,
    project: { id: "proj_test_plugin_silent" },
  });

  await hooks.tool.schedule_self_message.execute(
    {
      message: "Silent follow-up",
      in: "50ms",
      noReply: true,
    },
    {
      sessionID: "ses_silent",
      messageID: "msg_silent",
      agent: "primary",
      directory: "/tmp",
      worktree: "/tmp",
      abort: new AbortController().signal,
      metadata() {},
      ask() {
        throw new Error("ask should not be called in this test");
      },
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 120));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, "promptAsync");
  assert.equal(calls[0].input.path.id, "ses_silent");
  assert.equal(calls[0].input.body.noReply, true);
});

test.after(() => {
  if (originalStore === undefined)
    delete process.env.OPENCODE_INTERNAL_SCHEDULE_STORE;
  else process.env.OPENCODE_INTERNAL_SCHEDULE_STORE = originalStore;
});
