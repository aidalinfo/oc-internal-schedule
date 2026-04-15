# `cancel_scheduled_self_message`

## Purpose

Cancel a previously scheduled self-message.

## Best uses

- user changed priorities
- reminder is no longer useful
- recurring check should stop

## Required argument

- `id`: scheduled self-message id

## Typical flow

1. call `list_scheduled_self_messages`
2. identify the relevant job id
3. call `cancel_scheduled_self_message`

## Example call shape

```json
{
  "id": "selfmsg_abc123"
}
```
