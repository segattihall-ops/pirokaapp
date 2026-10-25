# Knotty single-chat browser assistant (Mac)

This tool is intentionally scoped to **one already-open Sniffies conversation**. It does not discover profiles, open chats in bulk, or run a message queue.

## What it does

1. You open one Sniffies chat in Chrome on Mac.
2. You paste `scripts/knotty-sniffies-single-chat.js` into DevTools Console.
3. The script sends the opener once:
   `What's good? 😈`
4. A 60-second countdown begins.
5. If the person replies during the countdown, that reply is held until the 60-second mark.
6. At 60 seconds, Knotty takes over:
   - if a reply is already waiting, Knotty answers it;
   - if there is no reply yet, Knotty sends one follow-up: `Real talk… tired of fake profiles and scammers on here? 👀`.
7. After that one follow-up, Knotty waits for the person's reply and responds automatically.
8. Knotty can introduce PIROKA and send `https://www.pirokaapp.com` once when relevant.
9. The assistant stops on opt-out/negative language, legal/safety escalation, chat/page navigation, or the STOP button.

## Safety / control behavior

- One chat only.
- Stops if the page URL changes.
- Does not scan profiles or recent chats.
- Does not send the PIROKA link repeatedly.
- Does not claim PIROKA eliminates scams or guarantees safety.
- If asked whether it is AI, Knotty identifies itself as PIROKA's AI assistant.
- STOP and Pause controls stay visible in the browser.
- If the API fails, the script pauses instead of sending an unreviewed message.

## Server endpoint

`POST /api/knotty-outreach`

Accepted cross-origin requests are restricted to HTTPS Sniffies origins.

Request:

```json
{
  "message": "incoming reply",
  "history": [
    { "role": "assistant", "content": "What's good? 😈" }
  ],
  "linkAlreadySent": false
}
```

Response:

```json
{
  "action": "reply",
  "reply": "short Knotty response",
  "linkSent": false,
  "mode": "ai"
}
```

or:

```json
{
  "action": "stop",
  "reply": ""
}
```

## AI configuration

The endpoint uses `ANTHROPIC_API_KEY` when configured in the PIROKA deployment. The existing deterministic fallback remains available when the key is absent or the model request fails.

Optional:

```text
ANTHROPIC_MODEL=claude-3-5-haiku-latest
```

Do not place the model key in the browser script.

## Mac run steps

1. Open Chrome.
2. Open Sniffies and enter one conversation.
3. Open DevTools Console with `Command + Option + J`.
4. Paste the full contents of `scripts/knotty-sniffies-single-chat.js`.
5. Press Enter.
6. Watch the PIROKA Knotty panel in the bottom-right.
7. Press STOP at any time to end the automation.

If Chrome displays its self-XSS paste warning, follow Chrome's own prompt before pasting code you have reviewed.
