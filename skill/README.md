# Skills Setup

To let OpenCode discover the companion skill from this repository, add the path below to your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": {
    "paths": ["/home/killian/Documents/dev/oc-internal-schedule/skill"]
  }
}
```

After restarting OpenCode, the skill should appear as:

- `oc-internal-schedule`

Then the agent can load it with the `skill` tool when a request is about delayed follow-up or recurring self-reminders.
