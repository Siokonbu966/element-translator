import browser from "webextension-polyfill";

interface Settings {
  endpoint: string;
  model: string;
};

interface HistoryItem {
  at: number;
  url: string;
  sourceText: string;
  translatedText: string;
  endpoint: string;
  model: string;
  error?: string;
};

const DEFAULT_ENDPOINT = "http://127.0.0.1:1234";
const HISTORY_LIMIT = 50;
const MODELS_TIMEOUT_MS = 10_000;
const TRANSLATE_TIMEOUT_MS = 60_000;

async function getSettings(): Promise<Settings> {
  const store = await browser.storage.local.get("settings");
  const raw = (store.settings ?? {}) as Partial<Settings>;

  return {
    endpoint:
      typeof raw.endpoint === "string" && raw.endpoint.trim()
        ? raw.endpoint.trim()
        : DEFAULT_ENDPOINT,
    model: typeof raw.model === "string" ? raw.model.trim() : "",
  };
}

async function saveSettings(settings: Settings) {
  await browser.storage.local.set({ settings });
}

async function listModels(
  endpoint: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const res = await fetch(`${endpoint.replace(/\/+$/, "")}/v1/models`, {
    signal,
  });
  if (!res.ok) throw new Error(`LM Studio /v1/models failed: ${res.status}`);

  const json = (await res.json()) as { data?: Array<{ id?: string }> };
  return (json.data ?? [])
    .map((m) => (typeof m.id === "string" ? m.id : ""))
    .filter(Boolean);
}

async function ensureModel(settings: Settings): Promise<Settings> {
  if (settings.model) return settings;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODELS_TIMEOUT_MS);
  try {
    const models = await listModels(settings.endpoint, controller.signal);
    const picked = models[0] ?? "";
    if (!picked) throw new Error("No models returned from LM Studio");

    const next = { ...settings, model: picked };
    await saveSettings(next);
    return next;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateToJapanese(
  endpoint: string,
  model: string,
  text: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${endpoint.replace(/\/+$/, "")}/v1/chat/completions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          stream: false,
          messages: [
            {
              role: "system",
              content:
                "You are a translation engine. Translate the user's text into natural Japanese. Return ONLY the translated Japanese text, no explanations.",
            },
            { role: "user", content: text },
          ],
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `LM Studio chat.completions failed: ${res.status} ${body}`.trim(),
      );
    }
    const json: unknown = await res.json();
    const out = (
      json as { choices?: Array<{ message?: { content?: unknown } }> }
    )?.choices?.[0]?.message?.content;
    if (typeof out !== "string" || !out.trim())
      throw new Error("Empty translation result");
    return out.trim();
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(
        `Translation timed out after ${Math.round(TRANSLATE_TIMEOUT_MS / 1000)}s`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

async function appendHistory(item: HistoryItem) {
  const store = await browser.storage.local.get("history");
  const prev = Array.isArray(store.history)
    ? (store.history as HistoryItem[])
    : [];
  const next = [item, ...prev].slice(0, HISTORY_LIMIT);
  await browser.storage.local.set({ history: next });
}

interface ParagraphClickedMessage {
  type: "PARAGRAPH_CLICKED";
  text: string;
  url?: string;
};

browser.runtime.onMessage.addListener(
  (message: unknown, sender: browser.Runtime.MessageSender) => {
    const msg = message as Partial<ParagraphClickedMessage>;
    if (!msg || msg.type !== "PARAGRAPH_CLICKED") {
      console.log("[element-translator] Ignoring", JSON.stringify(message)?.substring(0, 100));
      return;
    };

    const sourceText = typeof msg.text === "string" ? msg.text.trim() : "";
    console.log("[element-translator] Received PARAGRAPH_CLICKED:", {
      textType: typeof msg.text,
      textValue: sourceText.substring(0, 100),
      length: sourceText.length,
      senderUrl: sender?.tab?.url,
    });

    if (!sourceText) {
      console.log("[element-translator] Empty text received, skipping");
      return;
    }
    const url =
      (typeof msg.url === "string" && msg.url) || sender?.tab?.url || "";

    return (async () => {
      const baseSettings = await getSettings();
      const settings = await ensureModel(baseSettings);
      let translatedText = "";
      let error: string | undefined;
      try {
        translatedText = await translateToJapanese(
          settings.endpoint,
          settings.model,
          sourceText,
        );
      } catch (e: unknown) {
        error = e instanceof Error ? e.message : String(e);
      }
      await appendHistory({
        at: Date.now(),
        url,
        sourceText,
        translatedText,
        endpoint: settings.endpoint,
        model: settings.model,
        ...(error ? { error } : {}),
      });
    })();
  },
);
