import React from "react";
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

export class App extends React.Component<object, State> {
  state: State = {
    history: [],
    settings: { endpoint: DEFAULT_ENDPOINT, model: "" },
    endpointError: false,
    models: [],
    modelsError: null,
    loadingModels: false,
  };

  private onStorageChanged = (
    changes: Record<string, browser.Storage.StorageChange>,
  ) => {
    if (changes.history) {
      const next = changes.history.newValue;
      this.setState({
        history: Array.isArray(next) ? (next as HistoryItem[]) : [],
      });
    }
    if (changes.settings) {
      const next = changes.settings.newValue as Partial<Settings> | undefined;
      const endpoint =
        typeof next?.endpoint === "string" && next.endpoint.trim()
          ? next.endpoint.trim()
          : DEFAULT_ENDPOINT;
      const model = typeof next?.model === "string" ? next.model : "";
      this.setState(
        { settings: { endpoint, model } },
        () => void this.loadModels(),
      );
    }
  };

  async componentDidMount() {
    browser.storage.onChanged.addListener(this.onStorageChanged);
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
    this.setState(
      { history, settings: { endpoint, model } },
      () => void this.loadModels(),
    );
  }

  componentWillUnmount() {
    browser.storage.onChanged.removeListener(this.onStorageChanged);
  }

  private isValidHttpUrl(endpoint: string): boolean {
    if (!URL.canParse(endpoint)) {
      return false;
    }

    const url = new URL(endpoint);
    return url.protocol === "http:" || url.protocol === "https:";
  }

  private async loadModels() {
    const endpoint = this.state.settings.endpoint.trim() || DEFAULT_ENDPOINT;
    if (!this.isValidHttpUrl(endpoint)) {
      this.setState({ endpointError: true });
      return;
    }
    this.setState({
      loadingModels: true,
      modelsError: null,
      endpointError: false,
    });
    try {
      const res = await fetch(`${endpoint.replace(/\/+$/, "")}/v1/models`);
      if (!res.ok) throw new Error(`GET /v1/models failed: ${res.status}`);
      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      const models = (json.data ?? [])
        .map((m) => (typeof m.id === "string" ? m.id : ""))
        .filter(Boolean);
      this.setState({ models });
      // モデル未設定なら最初のモデルを自動セット（background側でも同様にフォールバックするので二重でもOK）
      if (!this.state.settings.model && models[0]) {
        await browser.storage.local.set({
          settings: { ...this.state.settings, endpoint, model: models[0] },
        });
      }
    } catch (e: unknown) {
      this.setState({
        modelsError: e instanceof Error ? e.message : String(e),
        models: [],
      });
    } finally {
      this.setState({ loadingModels: false });
    }
  }
  private async startSelectText() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: "SELECT_TRANSLATE" })
    }
  }

  private async allTextTranslate() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: "CLICKED_ALL_TEXT" })
    }
  }
  
  private setEndpoint = async (endpoint: string) => {
    await browser.storage.local.set({
      settings: { ...this.state.settings, endpoint },
    });
  };

  private setModel = async (model: string) => {
    await browser.storage.local.set({
      settings: { ...this.state.settings, model },
    });
  };

  private clearHistory = async () => {
    await browser.storage.local.set({ history: [] });
  };

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
