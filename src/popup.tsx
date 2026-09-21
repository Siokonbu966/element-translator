import React, { use, useState } from "react";
import { createRoot } from "react-dom/client";
import browser from "webextension-polyfill";
import WindowIcon from "ikonate/icons/window.svg?react";
import "./popup.css";

interface Settings {
  endpoint: string;
  model: string;
}

interface HistoryItem {
  url: string;
  at: number;
  sourceText: string;
  translatedText: string;
  endpoint: string;
  model: string;
  error?: string;
}

interface State {
  history: HistoryItem[];
  settings: Settings;
  endpointError: boolean;
  models: string[];
  modelsError: string | null;
  loadingModels: boolean;
}

interface WindowItem {
  type: browser.Windows.CreateType;
  url: string;
}

const DEFAULT_ENDPOINT = "http://127.0.0.1:1234";

export default function App() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settings, setSettings] = useState<Settings>({
    endpoint: DEFAULT_ENDPOINT, model: ""
  });
  const [endpointError, setEndpointError] = useState<string | null>(null)
  const [models, setModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [loadingModels, setLoadingModels] = useState<boolean>(false)

  function onStorageChanged(changes: Record<string, browser.Storage.StorageChange>) {
    const next = changes.history.newValue;
    setHistory( Array.isArray(next) ? (next as HistoryItem[]) : [] )
  }

  async function componentDidMount() {
    browser.storage.onChanged.addListener(onStorageChanged);
    const store = await browser.storage.local.get(["history", "settings"]);
    const history = Array.isArray(store.history)
      ? (store.history as HistoryItem[])
      : [];
    const raw = (store.settings ?? {}) as Partial<Settings>;
    const endpoint =
      typeof raw.endpoint === "string" && raw.endpoint.trim()
        ? raw.endpoint.trim()
        : DEFAULT_ENDPOINT;
    const model = typeof raw.model === "string" ? raw.model : "";
    setHistory(history)
    setSettings({endpoint, model})
  }

  function componentWillUnmount() {
    browser.storage.onChanged.removeListener(onStorageChanged);
  }

  const clearHistory = async () => {
    await browser.storage.local.set({ history: [] });
  };

  function isValidHttpUrl(endpoint: string): boolean {
    if (!URL.canParse(endpoint)) {
      return false;
    }
    const url = new URL(endpoint);
    return url.protocol === "http:" || url.protocol === "https:";
  }

  async function loadModels() {
    const endpoint = settings.endpoint.trim() || DEFAULT_ENDPOINT;
    if (!isValidHttpUrl(endpoint)) {
      setLoadingModels(true);
      return;
    }
    setLoadingModels(true);
    setModelsError(null);
    setEndpointError(null);
    try {
      const res = await fetch(`${endpoint.replace(/\/+$/, "")}/v1/models`);
      if (!res.ok) throw new Error(`GET /v1/models failed: ${res.status}`);
      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      const models = (json.data ?? [])
        .map((m) => (typeof m.id === "string" ? m.id : ""))
        .filter(Boolean);
      setModels(models);
      if (!settings.model && models[0]) {
        await browser.storage.local.set({
          settings: { ...settings, endpoint, model: models[0] },
        });
      }
    } catch (e: unknown) {
      setModelsError( e instanceof Error ? e.message : String(e) );
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }

  async function setEndpoint(endpoint: string) {
    await browser.storage.local.set({
      settings: { ...settings, endpoint },
    });
  };

  async function setModel(model: string) {
    await browser.storage.local.set({
      settings: { ...settings, model },
    });
  };

  async function startSelectText() {
    const tab = await browser.tabs.query({  u active: true, currentWindow: true })
    if (tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: "SELECT_TRANSLATE" })
    }
  }

  private async allTextTranslate() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: "ALL_TEXT_TRANSLATE" })
    }
  }
 
  private openWindow = () => {
    const createWindow: WindowItem = {
      type: "panel",
      url: "panel.html",
    };
    browser.windows.create(createWindow);
  }

  render() {
    const {
      history,
      settings,
      endpointError,
      models,
      loadingModels,
      modelsError,
    } = this.state;
    return (
      <div className="p-3 w-[360px]">
        <div className="flex justify-between">
          <h1 className="text-lg font-semibold">Element Translator</h1>
          <WindowIcon className="h-8 icon-white" onClick={ () => void this.openWindow() }/>
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium">
            LM Studio endpoint
          </label>
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            value={settings.endpoint}
            onChange={(e) => void this.setEndpoint(e.target.value)}
            placeholder={DEFAULT_ENDPOINT}
          />
          {endpointError ? (
            <div className="mt-1 text-xs text-red-600">
              Invalid endpoint URL (must start with http:// or https://)
            </div>
          ) : null}
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium">Model</label>
          <select
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            value={settings.model}
            onChange={(e) => void this.setModel(e.target.value)}
            disabled={loadingModels || models.length === 0}
          >
            <option value="" disabled>
              {loadingModels
                ? "Loading..."
                : models.length
                  ? "Select model"
                  : "No models"}
            </option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {modelsError ? (
            <div className="mt-1 text-xs text-red-600">{modelsError}</div>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            className="rounded border px-2 py-1 text-sm"
            onClick={() => void this.loadModels()}
          >
            Refresh models
          </button>
          <button
            className="rounded border px-2 py-1 text-sm"
            onClick={() => void this.clearHistory()}
          >
            Clear history
          </button>
          <button
            className="rounded border px-2 py-1 text-sm"
            onClick={() => void this.startSelectText()}
          >
          Select text
          </button>
          <button
            className="rounded border px-2 py-1 text-sm"
            onClick={() => void this.allTextTranslate()}
          >
          All text translate 
          </button>
        </div>
        <div className="mt-4">
          <div className="text-sm font-medium">History</div>
          <div className="mt-2 space-y-3">
            {history.map((item) => (
              <div key={item.at} className="rounded border p-2">
                <div className="text-xs text-slate-500 break-all">
                  {item.url}
                </div>
                <div className="mt-1 text-xs text-slate-500 break-all">
                  {new Date(item.at).toLocaleString()} ({item.model})
                </div>
                <div className="mt-2 text-sm font-medium">原文</div>
                <div className="text-sm whitespace-pre-wrap break-words">
                  {item.sourceText}
                </div>
                <div className="mt-2 text-sm font-medium">訳</div>
                {item.error ? (
                  <div className="text-sm text-red-600 whitespace-pre-wrap break-words">
                    {item.error}
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {item.translatedText}
                  </div>
                )}
              </div>
            ))}
            {history.length === 0 ? (
              <div className="text-sm text-slate-500">No history yet.</div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
