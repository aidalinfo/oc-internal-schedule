# `list_scheduled_self_messages`

## Purpose

List the scheduled self-messages known to the plugin.

## Scope

- `session`: only jobs for the current session
- `project`: all jobs for the current project

## Best uses

- verify that a reminder was actually scheduled
- inspect recurring jobs before adding another one
- confirm whether a prior reminder already exists

## Example call shape

```json
{
  "scope": "session"
}
```
