# PIROKA Knotty Autopilot — Chrome

This extension replaces the manual DevTools-console workflow.

## Behavior

After one-time installation, the extension loads automatically on Sniffies.

For the conversation you open:

1. Knotty sends the configured opener once.
2. A 60-second timer begins.
3. If the other person replies before the timer ends, Knotty waits until the 60-second mark and then answers.
4. If there is no reply by the 60-second mark, Knotty sends one follow-up.
5. After that, Knotty watches the open conversation and answers new incoming text through the PIROKA server endpoint.
6. It persists per-chat state in Chrome storage so refreshes do not resend the opener.
7. Pause / Resume / STOP controls appear inside the page.
8. An opt-out or safety/legal escalation stops the current chat.
9. SPA navigation is detected; when you open a different chat, the extension switches to that chat automatically.

It intentionally does **not** enumerate profiles, crawl recent chats, or open multiple conversations for bulk outreach.

## One-time installation on Mac Chrome

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder:
   `browser-extension/knotty-sniffies`
6. Pin **PIROKA Knotty Autopilot** if you want quick settings access.
7. Refresh Sniffies once.

After that, you do not paste code in DevTools again.

## Start automatically when the Mac starts

The extension can open Sniffies when Chrome starts.

To also start Chrome at macOS login, add Google Chrome under:

**System Settings → General → Login Items**

That is a one-time macOS permission. Chrome extensions cannot silently add themselves to macOS Login Items.

## Settings

Click the extension icon to configure:

- Autopilot on/off
- Open Sniffies when Chrome starts
- Takeover delay
- Opener
- Follow-up

Default flow:

- Opener: `What's good? 😈`
- Delay: 60 seconds
- Follow-up: `Real talk… tired of fake profiles and scammers on here? 👀`

## Backend

Replies use:

`https://www.pirokaapp.com/api/knotty-outreach`

AI credentials remain server-side. Nothing secret is embedded in this extension.
