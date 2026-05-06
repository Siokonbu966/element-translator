import browser from "webextension-polyfill";

let isCapturing = false;

function startCapture() {
  if (isCapturing) return;
  isCapturing = true;
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeydown, true);
}

function stopCapture() {
  if (!isCapturing) return;
  isCapturing = false;
  document.removeEventListener("click", handleClick, true);
  document.removeEventListener("keydown", handleKeydown, true);
}

function handleClick(event: MouseEvent) {
  if (!isCapturing) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  // リンク内は除外
  if (target.closest("a")) return;
  // imgは除外（altは使わない）
  if (target.tagName === "IMG") return;
  const text = (target.textContent ?? "").trim();
  if (text.length <= 2) return;
  browser.runtime.sendMessage({
    type: "SAVE_TRANSLATION_SOURCE",
    payload: { text, url: location.href, at: Date.now() }
  });
  stopCapture(); // 成功したら停止);
}

function handleKeydown(event: KeyboardEvent) {
  if (!isCapturing) return;
  if (event.key === "Escape") {
    stopCapture(); // Escで停止（保存しない）
  }
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "START_CAPTURE") {
    startCapture();
  }
});
