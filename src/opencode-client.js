async function assertOk(response, kind) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenCode ${kind} failed (${response.status}): ${body}`);
  }
}

export async function sendPromptAsync({
  apiBaseUrl,
  sessionID,
  message,
  agent,
  system,
  variant,
  noReply = false,
}) {
  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, "")}/session/${encodeURIComponent(sessionID)}/prompt_async`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agent,
        system,
        variant,
        noReply,
        parts: [
          {
            type: "text",
            text: message,
          },
        ],
      }),
    },
  );

  await assertOk(response, "prompt_async");
}

export async function sendPrompt({
  apiBaseUrl,
  sessionID,
  message,
  agent,
  system,
  variant,
  noReply = false,
}) {
  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, "")}/session/${encodeURIComponent(sessionID)}/message`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agent,
        system,
        variant,
        noReply,
        parts: [
          {
            type: "text",
            text: message,
          },
        ],
      }),
    },
  );

  await assertOk(response, "prompt");
}
