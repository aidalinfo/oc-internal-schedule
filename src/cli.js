#!/usr/bin/env node

import { JobStore, DEFAULT_STORE } from "./store.js";
import { SessionScheduler } from "./scheduler.js";

function readArg(flag, args) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const [, , command, ...args] = process.argv;
  const storePath = readArg("--store", args) ?? DEFAULT_STORE;
  const apiBaseUrl = readArg("--api-base-url", args) ?? "http://127.0.0.1:4096";
  const scheduler = new SessionScheduler({
    store: new JobStore(storePath),
    apiBaseUrl,
  });

  if (command === "schedule") {
    const job = await scheduler.schedule({
      sessionID: readArg("--session", args),
      message: readArg("--message", args),
      in: readArg("--in", args),
      at: readArg("--at", args),
      every: readArg("--every", args),
      agent: readArg("--agent", args),
      variant: readArg("--variant", args),
      system: readArg("--system", args),
    });
    process.stdout.write(`${JSON.stringify(job, null, 2)}\n`);
    return;
  }

  if (command === "run-due") {
    const results = await scheduler.runDue(new Date());
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    return;
  }

  if (command === "list") {
    process.stdout.write(
      `${JSON.stringify(await scheduler.list(), null, 2)}\n`,
    );
    return;
  }

  if (command === "cancel") {
    const ok = await scheduler.cancel(readArg("--id", args));
    process.stdout.write(`${JSON.stringify({ ok })}\n`);
    return;
  }

  if (command === "daemon") {
    const pollMs = Number(readArg("--poll-ms", args) ?? "5000");
    process.stderr.write(
      `Polling ${apiBaseUrl} every ${pollMs}ms using ${storePath}\n`,
    );
    await scheduler.runDaemon({ pollMs });
    return;
  }

  process.stderr.write(`Unknown command: ${command}\n`);
  process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
