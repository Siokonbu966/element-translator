import browser from "webextension-polyfill";

browser.runtime.onMessage.addListener(async (msg: any) => {
  if (msg?.type === "START_CAPTURE") {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) {
      browser.tabs.sendMessage(tab.id, { type: "START_CAPTURE" });
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
