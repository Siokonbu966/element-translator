import browser from "webextension-polyfill";

const text = window.getSelection()?.toString().trim();
if (text) {
  browser.runtime.sendMessage({
    type: "SAVE_TRANSLATION_SOURCE",
    payload: { text, url: location.href}
  });
}
