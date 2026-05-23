import browser from "webextension-polyfill";

const HIGHLIGHT_CLASS = "et-highlight";
const HIGHLIGHT_STYLE_ID = "et-highlight-style";

let isCapturing = false;
let currentHighlighted: Element | null = null;
console.log("content loaded");

function startCapture() {
  if (isCapturing) return;
  isCapturing = true;
  ensureHighlightStyle();
  document.addEventListener("mousemove", handleMouseMove, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeydown, true);
}

function stopCapture() {
  if (!isCapturing) return;
  isCapturing = false;
  clearHighlight();
  document.removeEventListener("mousemove", handleMouseMove, true);
  document.removeEventListener("click", handleClick, true);
  document.removeEventListener("keydown", handleKeydown, true);
}

function ensureHighlightStyle() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `.${HIGHLIGHT_CLASS}{outline:2px solid #f59e0b;outline-offset:2px;}`;
  const target = document.head ?? document.documentElement;
  target.appendChild(style);
}

function getSelectableElement(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  if (target.closest("a")) return null;
  if (target.tagName === "IMG") return null;
  const text = (target.textContent ?? "").trim();
  if (text.length <= 2) return null;
  return target;
}

function setHighlight(element: Element | null) {
  if (currentHighlighted === element) return;
  if (currentHighlighted) {
    currentHighlighted.classList.remove(HIGHLIGHT_CLASS);
  }
  currentHighlighted = element;
  if (currentHighlighted) {
    currentHighlighted.classList.add(HIGHLIGHT_CLASS);
  }
}

function clearHighlight() {
  setHighlight(null);
}

function handleMouseMove(event: MouseEvent) {
  if (!isCapturing) return;
  const selectable = getSelectableElement(event.target);
  setHighlight(selectable);
}

function handleClick(event: MouseEvent) {
  if (!isCapturing) return;
  const target = currentHighlighted ?? getSelectableElement(event.target);
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  const text = (target.textContent ?? "").trim();
  if (text.length <= 2) return;
  browser.runtime.sendMessage({
    type: "SAVE_TRANSLATION_SOURCE",
    payload: { text, url: location.href, at: Date.now() },
  });
  stopCapture(); // 成功したら停止);
}

function handleKeydown(event: KeyboardEvent) {
  if (!isCapturing) return;
  if (event.key === "Escape") {
    stopCapture(); // Escで停止（保存しない）
  }
}

browser.runtime.onMessage.addListener((msg: any) => {
  if (msg?.type === "START_CAPTURE") {
    startCapture();
  }
});
