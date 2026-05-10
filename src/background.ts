import browser from "webextension-polyfill";

browser.runtime.onMessage.addListener(async (msg: any, sender:any) => {
  if (msg?.type === "START_CAPTURE") {
    const tabId = sender.tab?.id;

    if (!tabId) return;

    const url = sender.tab?.url ?? "";

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return;
    }

    try {
      await browser.tabs.sendMessage(tabId, {
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
