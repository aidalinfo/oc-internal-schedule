# oc-internal-schedule

OpenCode plugin that adds real scheduling tools capable of sending deferred prompts back into an existing session via `POST /session/:sessionID/prompt_async`.

## What it does

- stores scheduled jobs in a local JSON file
- supports one-shot jobs and recurring jobs
- dispatches prompts to an existing OpenCode session
- exposes actual OpenCode tools usable by an agent

## Added tools

- `schedule_self_message`
- `list_scheduled_self_messages`
- `cancel_scheduled_self_message`

These tools automatically use the current OpenCode `sessionID`.

## Install into OpenCode

1. Install this plugin's dependencies once:

```bash
cd /home/killian/Documents/dev/oc-internal-schedule
npm install
```

2. Add the plugin and the skill path in your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["/home/killian/Documents/dev/oc-internal-schedule"],
  "skills": {
    "paths": ["/home/killian/Documents/dev/oc-internal-schedule/skill"]
  }
}
```

3. Restart OpenCode.

4. Verify that OpenCode now exposes:

- plugin tools:
  - `schedule_self_message`
  - `list_scheduled_self_messages`
  - `cancel_scheduled_self_message`
- skill:
  - `oc-internal-schedule`

## Skill

The companion skill teaches the agent:

- when a delayed self-reminder is useful
- when a recurring reminder is better than a one-shot reminder
- when to list existing reminders before creating a new one
- how to cancel an obsolete reminder

Skill name:

- `oc-internal-schedule`

Skill file:

- `/home/killian/Documents/dev/oc-internal-schedule/skill/oc-internal-schedule/SKILL.md`

## Test Prompts

### Quick access check

```text
Vérifie si tu as accès aux tools `list_scheduled_self_messages`, `schedule_self_message` et `cancel_scheduled_self_message`, puis utilise `list_scheduled_self_messages`.
```

### Skill loading check

```text
Charge le skill `oc-internal-schedule` puis explique quand tu utiliserais `schedule_self_message` plutôt qu'un simple rappel textuel.
```

### One-shot reminder test

```text
Charge le skill `oc-internal-schedule`, puis utilise `schedule_self_message` pour te rappeler dans 2 minutes de relire les logs du run courant et m'en faire un retour ici.
```

### Recurring reminder test

```text
Charge le skill `oc-internal-schedule`, puis utilise `schedule_self_message` pour te rappeler toutes les 10 minutes de vérifier l'état du scheduler et me résumer la situation.
```

### Cancel test

```text
Utilise `list_scheduled_self_messages` pour trouver le dernier rappel planifié dans cette session, puis annule-le avec `cancel_scheduled_self_message`.
```

### Minimal direct prompt

```text
Utilise le tool `schedule_self_message` pour te rappeler dans 2 minutes de relire les logs du run courant et m'en faire un retour ici.
```

## Persistence model

- jobs are stored in `~/.local/share/opencode/internal-schedule/jobs.json`
- if OpenCode stays running, timers fire at the planned time
- if OpenCode restarts, jobs are reloaded and re-armed on plugin init

Current limitation:

- if OpenCode is completely stopped at the scheduled time, the message cannot be injected until OpenCode is started again and the plugin reloads

## Why this matters

OpenCode already exposes the key primitive needed for a real internal reminder tool:

- `POST /session/:sessionID/prompt_async`

This prototype proves the missing layer:

- schedule something for a session
- wake up later
- inject a prompt back into that same session

## CLI

Schedule a one-shot message 5 minutes from now:

```bash
node src/cli.js schedule \
  --api-base-url http://127.0.0.1:4096 \
  --session session_123 \
  --in 5m \
  --message "Check the scheduler logs and summarize what happened."
```

Run due jobs once:

```bash
node src/cli.js run-due --api-base-url http://127.0.0.1:4096
```

Start a polling worker:

```bash
node src/cli.js daemon --api-base-url http://127.0.0.1:4096 --poll-ms 5000
```

List jobs:

```bash
node src/cli.js list
```

Cancel a job:

```bash
node src/cli.js cancel --id job_abc123
```

## Tool behavior

`schedule_self_message` accepts:

- `message`
- `in` or `at`
- optional `every`
- optional `agent`
- optional `variant`
- optional `system`
- optional `noReply`

Default behavior:

- `noReply` defaults to `false`
- scheduled reminders should therefore generate a normal visible assistant reply in the session
- visible reminders now use the normal `session.prompt` route instead of `prompt_async`
- set `noReply: true` only if you want a silent/internal reminder without visible reply

Examples:

```text
Planifie un self-message dans 1 minutes avec `schedule_self_message` pour vérifier mes conteneurs qui tourne stp.
```

```text
Planifie un rappel toutes les 10 minutes avec `schedule_self_message` pour surveiller l'état du scheduler.
```

## Tests

Run:

```bash
npm test
```

The tests cover:

- the standalone scheduler prototype against a mock HTTP server
- the real OpenCode plugin tool flow with a mocked OpenCode client
