import browser from "webextension-polyfill";

browser.runtime.onMessage.addListener(async (msg: any, sender: any) => {
  if (msg?.type === "START_CAPTURE") {
    const tabId = sender.tab?.id;
    const tabUrl = sender.tab?.url;

    const targetTabId = tabId ?? (await getActiveTabId());
    const targetUrl = tabUrl ?? (await getActiveTabUrl());

    if (!targetTabId || !targetUrl) return;

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      return;
    }

    try {
      await browser.tabs.sendMessage(targetTabId, {
        type: "START_CAPTURE",
      });
    } catch (error) {
      console.warn("Faild to start capture in tab", error);
    }
  }

  if (msg.type === "SAVE_TRANSLATION_SOURCE") {
    console.log(msg);
    const { text, url } = msg.payload;

    const store = await browser.storage.local.get("history");
    const history = Array.isArray(store.history) ? store.history : [];
    history.unshift({ text, url, at: Date.now() });

    await browser.storage.local.set({ history: history.slice(0, 20) });
  }
});

async function getActiveTabId(): Promise<number | undefined> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

async function getActiveTabUrl(): Promise<string | undefined> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.url;
}
