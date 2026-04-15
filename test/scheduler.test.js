import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { JobStore } from "../src/store.js";
import { SessionScheduler } from "../src/scheduler.js";

async function createTempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "oc-internal-schedule-"));
  return path.join(dir, "jobs.json");
}

async function withMockServer(fn) {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    calls.push({
      url: req.url,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    });
    res.statusCode = 204;
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  try {
    await fn({
      apiBaseUrl: `http://127.0.0.1:${address.port}`,
      calls,
    });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("dispatches a one-shot self-message to prompt_async", async () => {
  await withMockServer(async ({ apiBaseUrl, calls }) => {
    const storePath = await createTempStore();
    const scheduler = new SessionScheduler({
      store: new JobStore(storePath),
      apiBaseUrl,
    });

    await scheduler.schedule({
      sessionID: "ses_test_one",
      message: "Check the logs in 5 minutes",
      in: "1ms",
    });

    const results = await scheduler.runDue(new Date(Date.now() + 10));
    const jobs = await scheduler.list();

    assert.equal(results.length, 1);
    assert.equal(results[0].ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/session/ses_test_one/message");
    assert.equal(calls[0].body.noReply, false);
    assert.deepEqual(calls[0].body.parts, [
      {
        type: "text",
        text: "Check the logs in 5 minutes",
      },
    ]);
    assert.equal(jobs[0].status, "completed");
  });
});

test("reschedules recurring jobs after dispatch", async () => {
  await withMockServer(async ({ apiBaseUrl, calls }) => {
    const storePath = await createTempStore();
    const scheduler = new SessionScheduler({
      store: new JobStore(storePath),
      apiBaseUrl,
    });
    const now = new Date("2026-04-15T12:00:00.000Z");

    await scheduler.schedule({
      sessionID: "ses_test_recurring",
      message: "Re-check the current run",
      at: now.toISOString(),
      every: "10m",
    });

    const results = await scheduler.runDue(now);
    const jobs = await scheduler.list();

    assert.equal(results.length, 1);
    assert.equal(results[0].ok, true);
    assert.equal(results[0].recurring, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/session/ses_test_recurring/message");
    assert.equal(calls[0].body.noReply, false);
    assert.equal(jobs[0].status, "scheduled");
    assert.equal(jobs[0].runAt, "2026-04-15T12:10:00.000Z");
  });
});
