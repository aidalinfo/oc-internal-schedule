# `schedule_self_message`

## Purpose

Plan a prompt that should be injected back into the current OpenCode session later.

## Best uses

- remind the agent to re-check logs in a few minutes
- schedule a follow-up after a build or long-running task
- create recurring checks for a service or cron
- ask the agent to come back to an investigation at a specific time

## Main arguments

- `message`: required prompt to inject later
- `in`: relative delay such as `30s`, `5m`, `1h`
- `at`: absolute ISO date/time
- `every`: recurring interval such as `10m`, `1h`
- `agent`: optional agent override
- `variant`: optional model variant override
- `system`: optional system prompt override
- `noReply`: optional boolean, defaults to `false`

## Rules

- use either `in` or `at`
- use `every` only when recurring follow-up is actually useful
- keep the future message explicit and action-oriented
- leave `noReply` unset if you want the reminder to generate a visible reply in the session

## Good examples

- `In 5 minutes, re-check the scheduler logs and summarize what changed.`
- `Every 10 minutes, verify whether the current background run is still progressing.`
- `At 2026-04-15T16:00:00+02:00, revisit the current bug and report whether the service recovered.`

## Bad examples

- `Check later`
- `Maybe revisit this`
- `Do the thing`

## Example call shape

```json
{
  "message": "In 5 minutes, re-check the scheduler logs and summarize what changed.",
  "in": "5m"
}
```
