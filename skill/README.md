# Skills Setup

OpenCode currently resolves skills from paths or URLs, not directly from npm package names.

To use the bundled skill from the published npm package, first install the package into a stable local directory:

```bash
npm install --prefix ~/.config/opencode/vendor @aidalinfo/oc-internal-schedule
```

Then add the installed `skill/` directory to your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": {
    "paths": [
      "~/.config/opencode/vendor/node_modules/@aidalinfo/oc-internal-schedule/skill"
    ]
  }
}
```

After restarting OpenCode, the skill should appear as:

- `oc-internal-schedule`

Then the agent can load it with the `skill` tool when a request is about delayed follow-up or recurring self-reminders.
