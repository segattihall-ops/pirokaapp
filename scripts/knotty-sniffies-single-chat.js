/*
 * PIROKA / Knotty single-chat assistant for Sniffies (Mac desktop browser).
 *
 * Scope:
 * - Runs only in the ONE chat that is already open when you paste this script.
 * - Sends one opener once.
 * - Waits 60 seconds before Knotty is allowed to reply.
 * - After 60 seconds, watches only that open chat for new incoming text.
 * - Sends Knotty replies automatically.
 * - Stops on chat navigation, opt-out/negative language, legal/safety escalation,
 *   or when you press STOP.
 *
 * No profile scanning, no chat queueing, no mass outreach.
 */

(() => {
  const CONFIG = {
    apiUrl: "https://www.pirokaapp.com/api/knotty-outreach",
    opener: "What's good? 😈",
    armDelayMs: 60_000,
    apiTimeoutMs: 12_000,
    postReplyDelayMs: 1_800,
    maxHistoryTurns: 8,
  };

  const existing = window.__PIROKA_KNOTTY_SINGLE_CHAT__;
  if (existing && typeof existing.stop === "function") {
    existing.stop("Restarted");
  }

  const state = {
    startedAt: Date.now(),
    armedAt: Date.now() + CONFIG.armDelayMs,
    armed: false,
    stopped: false,
    paused: false,
    busy: false,
    pendingIncoming: null,
    lastHandledIncoming: "",
    lastHandledAt: 0,
    linkAlreadySent: false,
    history: [],
    sentTexts: new Set(),
    observedTexts: new Set(),
    observer: null,
    countdownTimer: null,
    routeTimer: null,
    field: null,
    chatRoot: null,
    initialUrl: location.href,
    panel: null,
    statusEl: null,
    detailEl: null,
  };

  const STOP_RE =
    /\b(stop|not interested|no thanks|no thank you|leave me alone|don't message|do not message|don't contact|do not contact|unsubscribe|fuck off|go away)\b/i;
  const ESCALATION_RE =
    /\b(minor|underage|police|lawyer|attorney|lawsuit|sue you|harassment|harassing|report you|threat|threaten)\b/i;

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  function findMessageField() {
    const selectors = [
      'textarea[placeholder*="Say something" i]',
      'input[placeholder*="Say something" i]',
      'textarea[placeholder*="message" i]',
      'input[placeholder*="message" i]',
      '[role="textbox"][contenteditable="true"]',
      '[contenteditable="true"]',
      "textarea",
    ];

    for (const selector of selectors) {
      const matches = [...document.querySelectorAll(selector)].filter(
        (el) => isVisible(el) && !el.disabled && !el.readOnly,
      );
      if (matches.length) return matches[matches.length - 1];
    }
    return null;
  }

  function findChatRoot(field) {
    const candidates = [
      field.closest('[role="dialog"]'),
      field.closest('[class*="conversation" i]'),
      field.closest('[class*="chat" i]'),
      field.closest("main"),
      field.closest("section"),
      document.body,
    ].filter(Boolean);

    return candidates.find((el) => el.contains(field)) || document.body;
  }

  function setFieldValue(field, text) {
    field.focus();

    if (field instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      if (setter) setter.call(field, text);
      else field.value = text;
    } else if (field instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (setter) setter.call(field, text);
      else field.value = text;
    } else {
      field.textContent = text;
    }

    try {
      field.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: text,
        }),
      );
    } catch {
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }

    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findSendButton(field) {
    const form = field.closest("form");
    if (form) {
      const submit = form.querySelector(
        'button[type="submit"], input[type="submit"]',
      );
      if (submit && isVisible(submit) && !submit.disabled) return submit;
    }

    const fieldRect = field.getBoundingClientRect();
    const buttons = [
      ...document.querySelectorAll(
        'button, [role="button"], input[type="submit"]',
      ),
    ].filter((el) => isVisible(el) && !el.disabled);

    let best = null;
    let bestScore = -Infinity;

    for (const button of buttons) {
      if (state.panel?.contains(button)) continue;

      const rect = button.getBoundingClientRect();
      const label = [
        button.getAttribute("aria-label"),
        button.getAttribute("title"),
        button.textContent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      let score = 0;

      if (/\bsend\b|submit|paper plane|arrow/i.test(label)) score += 100;

      const verticalDistance = Math.abs(
        rect.top +
          rect.height / 2 -
          (fieldRect.top + fieldRect.height / 2),
      );
      if (verticalDistance <= 70) score += 35;

      const horizontalOffset = rect.left - fieldRect.right;
      if (horizontalOffset >= -100 && horizontalOffset <= 220) score += 40;

      if (rect.width <= 120 && rect.height <= 120) score += 10;

      if (score > bestScore) {
        best = button;
        bestScore = score;
      }
    }

    return bestScore >= 45 ? best : null;
  }

  async function sendMessage(text) {
    if (state.stopped) return false;

    const field = findMessageField();
    if (!field) {
      stop("Message box disappeared");
      return false;
    }

    state.field = field;
    state.sentTexts.add(normalizeText(text));
    setFieldValue(field, text);

    await sleep(250);

    const sendButton = findSendButton(field);
    if (sendButton) {
      sendButton.click();
      return true;
    }

    field.focus();
    field.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      }),
    );
    field.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      }),
    );

    await sleep(400);

    const current =
      field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
        ? field.value
        : field.textContent || "";

    if (normalizeText(current) === normalizeText(text)) {
      setStatus("PAUSED", "Couldn't identify Send safely. Send manually, then Resume.");
      state.paused = true;
      return false;
    }

    return true;
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function looksLikeUiNoise(text) {
    const value = normalizeText(text);
    if (!value || value.length > 700) return true;
    if (/^(online|offline|typing|delivered|sent|read|today|yesterday)$/i.test(value))
      return true;
    if (/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(value)) return true;
    if (/^(block|report|mute|close|back|send|say something)$/i.test(value))
      return true;
    if (value === "PIROKA Knotty") return true;
    return false;
  }

  function leafTexts(node) {
    const root =
      node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!(root instanceof Element)) return [];

    const texts = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(el) {
        if (state.panel?.contains(el)) return NodeFilter.FILTER_REJECT;
        if (
          el.matches(
            "script,style,textarea,input,button,svg,path,img,video,audio",
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        const childTextElements = [...el.children].filter((child) => {
          if (
            child.matches(
              "script,style,textarea,input,button,svg,path,img,video,audio",
            )
          )
            return false;
          return normalizeText(child.textContent).length > 0;
        });

        return childTextElements.length === 0
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });

    let current = walker.nextNode();
    while (current) {
      const text = normalizeText(current.textContent);
      if (text) texts.push(text);
      current = walker.nextNode();
    }

    return texts;
  }

  function candidateFromMutation(mutation) {
    const candidates = [];

    for (const node of mutation.addedNodes) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        state.panel?.contains(node)
      ) {
        continue;
      }

      for (const text of leafTexts(node)) {
        if (looksLikeUiNoise(text)) continue;

        const normalized = normalizeText(text);
        if (!normalized) continue;
        if (state.sentTexts.has(normalized)) continue;
        if (state.observedTexts.has(normalized)) continue;

        state.observedTexts.add(normalized);
        candidates.push(normalized);
      }
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) => b.length - a.length);
    return candidates[0];
  }

  function handlePotentialIncoming(text) {
    if (state.stopped) return;

    const incoming = normalizeText(text);
    if (!incoming) return;
    if (state.sentTexts.has(incoming)) return;

    const duplicateWindow =
      incoming === state.lastHandledIncoming &&
      Date.now() - state.lastHandledAt < 30_000;
    if (duplicateWindow) return;

    if (STOP_RE.test(incoming) || ESCALATION_RE.test(incoming)) {
      state.history.push({ role: "user", content: incoming });
      stop("Conversation stopped by reply");
      return;
    }

    state.pendingIncoming = incoming;

    if (!state.armed) {
      setStatus(
        "WAITING",
        "Reply received. Knotty will answer when the 60-second timer finishes.",
      );
      return;
    }

    void processPending();
  }

  async function processPending() {
    if (
      state.stopped ||
      state.paused ||
      state.busy ||
      !state.armed ||
      !state.pendingIncoming
    ) {
      return;
    }

    const incoming = state.pendingIncoming;
    state.pendingIncoming = null;
    state.busy = true;
    state.lastHandledIncoming = incoming;
    state.lastHandledAt = Date.now();

    state.history.push({ role: "user", content: incoming });
    state.history = state.history.slice(-CONFIG.maxHistoryTurns);

    setStatus("KNOTTY THINKING", incoming.slice(0, 100));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        CONFIG.apiTimeoutMs,
      );

      const response = await fetch(CONFIG.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: incoming,
          history: state.history.slice(0, -1),
          linkAlreadySent: state.linkAlreadySent,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Knotty API ${response.status}`);
      }

      const data = await response.json();

      if (data?.action === "stop") {
        stop("Knotty stopped the conversation");
        return;
      }

      const reply = normalizeText(data?.reply);
      if (!reply) {
        throw new Error("Empty Knotty reply");
      }

      if (
        data?.linkSent === true ||
        /https?:\/\/(?:www\.)?pirokaapp\.com/i.test(reply)
      ) {
        state.linkAlreadySent = true;
      }

      await sleep(CONFIG.postReplyDelayMs);

      const sent = await sendMessage(reply);
      if (!sent) return;

      state.history.push({ role: "assistant", content: reply });
      state.history = state.history.slice(-CONFIG.maxHistoryTurns);

      setStatus(
        "KNOTTY ACTIVE",
        data?.mode === "fallback"
          ? "Reply sent (fallback mode). Waiting for the next reply."
          : "Reply sent. Waiting for the next reply.",
      );
    } catch (error) {
      console.error("[PIROKA Knotty]", error);
      state.paused = true;
      setStatus(
        "PAUSED",
        "Knotty API failed. No message was sent. Press Resume to retry on the next reply.",
      );
    } finally {
      state.busy = false;

      if (
        !state.stopped &&
        !state.paused &&
        state.pendingIncoming &&
        state.armed
      ) {
        void processPending();
      }
    }
  }

  function startObserver() {
    state.observer = new MutationObserver((mutations) => {
      if (state.stopped || state.paused) return;

      for (const mutation of mutations) {
        const candidate = candidateFromMutation(mutation);
        if (candidate) {
          handlePotentialIncoming(candidate);
        }
      }
    });

    state.observer.observe(state.chatRoot, {
      childList: true,
      subtree: true,
      characterData: false,
    });
  }

  function buildPanel() {
    const panel = document.createElement("div");
    panel.id = "piroka-knotty-panel";

    Object.assign(panel.style, {
      position: "fixed",
      right: "18px",
      bottom: "92px",
      zIndex: "2147483647",
      width: "280px",
      padding: "14px",
      borderRadius: "14px",
      background: "rgba(15,15,18,.96)",
      color: "#fff",
      boxShadow: "0 12px 36px rgba(0,0,0,.45)",
      fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      fontSize: "13px",
      lineHeight: "1.35",
      border: "1px solid rgba(255,255,255,.12)",
    });

    const title = document.createElement("div");
    title.textContent = "PIROKA Knotty";
    title.style.fontWeight = "700";
    title.style.fontSize = "15px";
    title.style.marginBottom = "8px";

    const status = document.createElement("div");
    status.style.fontWeight = "700";
    status.style.marginBottom = "4px";

    const detail = document.createElement("div");
    detail.style.opacity = ".78";
    detail.style.fontSize = "12px";
    detail.style.marginBottom = "12px";

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      gap: "7px",
    });

    const pauseButton = makeButton("Pause", () => {
      state.paused = !state.paused;
      pauseButton.textContent = state.paused ? "Resume" : "Pause";

      if (state.paused) {
        setStatus("PAUSED", "Knotty will not read or send while paused.");
      } else {
        setStatus(
          state.armed ? "KNOTTY ACTIVE" : "WAITING",
          state.armed
            ? "Waiting for a reply."
            : "Countdown resumed. Waiting for the 60-second mark.",
        );
        if (state.pendingIncoming && state.armed) void processPending();
      }
    });

    const stopButton = makeButton("STOP", () => stop("Stopped by you"));
    stopButton.style.background = "#4b161b";

    row.append(pauseButton, stopButton);
    panel.append(title, status, detail, row);
    document.body.appendChild(panel);

    state.panel = panel;
    state.statusEl = status;
    state.detailEl = detail;
  }

  function makeButton(label, onClick) {
    const button = document.createElement("button");
    button.textContent = label;
    Object.assign(button.style, {
      flex: "1",
      border: "0",
      borderRadius: "9px",
      padding: "9px 10px",
      background: "#2a2a2f",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "650",
    });
    button.addEventListener("click", onClick);
    return button;
  }

  function setStatus(status, detail) {
    if (state.statusEl) state.statusEl.textContent = status;
    if (state.detailEl) state.detailEl.textContent = detail || "";
  }

  function stop(reason = "Stopped") {
    if (state.stopped) return;

    state.stopped = true;
    state.observer?.disconnect();
    clearInterval(state.countdownTimer);
    clearInterval(state.routeTimer);

    setStatus("STOPPED", reason);

    if (state.panel) {
      const buttons = state.panel.querySelectorAll("button");
      buttons.forEach((button) => {
        button.disabled = true;
        button.style.opacity = ".45";
        button.style.cursor = "default";
      });
    }

    delete window.__PIROKA_KNOTTY_SINGLE_CHAT__;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function primeObservedText() {
    const all = state.chatRoot.querySelectorAll(
      "p,span,div,[role='listitem'],li",
    );

    for (const el of all) {
      if (!isVisible(el)) continue;
      const text = normalizeText(el.textContent);
      if (!text || looksLikeUiNoise(text)) continue;
      state.observedTexts.add(text);
    }
  }

  async function boot() {
    const field = findMessageField();

    if (!field) {
      alert(
        "PIROKA Knotty: Open ONE Sniffies chat first, then run the script again.",
      );
      return;
    }

    state.field = field;
    state.chatRoot = findChatRoot(field);

    buildPanel();
    primeObservedText();
    startObserver();

    window.__PIROKA_KNOTTY_SINGLE_CHAT__ = {
      stop,
      state,
    };

    state.routeTimer = setInterval(() => {
      if (location.href !== state.initialUrl) {
        stop("Chat/page changed — safety stop");
        return;
      }

      const currentField = findMessageField();
      if (!currentField) stop("Message box disappeared — safety stop");
    }, 1_000);

    const pageText = normalizeText(state.chatRoot.textContent);
    const openerAlreadyVisible = pageText.includes(
      normalizeText(CONFIG.opener),
    );

    if (!openerAlreadyVisible) {
      setStatus("STARTING", "Sending opener…");
      const sent = await sendMessage(CONFIG.opener);

      if (!sent) {
        setStatus(
          "PAUSED",
          "Opener was filled but couldn't be sent automatically.",
        );
        return;
      }

      state.history.push({
        role: "assistant",
        content: CONFIG.opener,
      });
    } else {
      state.sentTexts.add(normalizeText(CONFIG.opener));
      state.history.push({
        role: "assistant",
        content: CONFIG.opener,
      });
    }

    state.countdownTimer = setInterval(() => {
      if (state.stopped) return;

      const remaining = Math.max(0, state.armedAt - Date.now());

      if (remaining <= 0) {
        state.armed = true;
        clearInterval(state.countdownTimer);

        setStatus(
          state.paused ? "PAUSED" : "KNOTTY ACTIVE",
          state.paused
            ? "60-second wait finished. Press Resume when ready."
            : "60-second wait finished. Waiting for a reply.",
        );

        if (state.pendingIncoming && !state.paused) {
          void processPending();
        }
        return;
      }

      if (!state.paused) {
        const seconds = Math.ceil(remaining / 1000);
        setStatus(
          "WAITING",
          `Knotty takes over in ${seconds}s. Replies received now will wait for the timer.`,
        );
      }
    }, 250);
  }

  void boot();
})();
