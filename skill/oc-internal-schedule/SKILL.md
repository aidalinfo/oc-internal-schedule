---
name: oc-internal-schedule
description: Teaches the agent when and how to use the internal self-message scheduling tools provided by the oc-internal-schedule plugin.
---

## When To Use

Use this skill when the user wants the agent to:

- remind itself to do something later in the same session
- check logs or service state after a delay
- schedule a recurring follow-up on a background task
- stop or inspect existing scheduled reminders

## Available Tools

The plugin exposes these tools:

- `schedule_self_message`
- `list_scheduled_self_messages`
- `cancel_scheduled_self_message`

Reference docs:

- `../../tools/schedule_self_message.md`
- `../../tools/list_scheduled_self_messages.md`
- `../../tools/cancel_scheduled_self_message.md`

## How To Think About It

These tools are for reminders directed back into the current OpenCode session.

Use them when the user explicitly wants a delayed or recurring follow-up from the agent itself.

Typical patterns:

- "In 5 minutes, check the logs again"
- "Every 10 minutes, monitor this background run"
- "Later today, remind yourself to verify the fix"

## Workflow

1. If needed, call `list_scheduled_self_messages` first to avoid duplicates.
2. Use `schedule_self_message` with a very explicit future instruction.
3. If the reminder becomes obsolete, use `cancel_scheduled_self_message`.

## Prompt Writing Rules

The scheduled message should:

- state exactly what to inspect
- state exactly what outcome to report
- avoid vague wording
- be short enough to execute directly later

Good examples:

- `In 5 minutes, re-check the scheduler logs and summarize whether the run progressed.`
- `Every 10 minutes, inspect the auto-pilot service and report whether it is stuck, active, or finished.`
- `In 2 minutes, re-open the current QA issue and tell me whether the failing test recovered.`

Bad examples:

- `Check later`
- `Follow up eventually`
- `See if it works`

## Decision Rules

- Prefer one-shot reminders for a single delayed check.
- Prefer recurring reminders only when the user clearly wants ongoing monitoring.
- Do not schedule unnecessary recurring jobs if a one-time delayed check is enough.
- If a job likely already exists, inspect first with `list_scheduled_self_messages`.

## Example Requests

User request:
`Dans 5 minutes, recheck les logs et fais-moi un retour ici.`

Recommended behavior:

1. call `schedule_self_message`
2. set `message` to something explicit like `In 5 minutes, re-check the current logs and report the result to the user.`
3. set `in` to `5m`

User request:
`Toutes les 10 minutes, surveille ce service.`

Recommended behavior:

1. optionally call `list_scheduled_self_messages`
2. call `schedule_self_message` with `every: 10m`
3. ensure the future message explicitly names the service and expected report

User request:
`Annule le rappel que tu avais mis.`

Recommended behavior:

1. call `list_scheduled_self_messages`
2. identify the target id
3. call `cancel_scheduled_self_message`
