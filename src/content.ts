interface LLMResponse {
  translatedText: string,
  sourceText: string,
  id: number,
}

const SELECT_STYLE_ID = "element-translator-select-style";
const SELECTING_CLASS = "element-translator-selecting";
const HOVER_CLASS = "element-translator-select-hover";
const FLASH_CLASS = "element-translator-select-flash";

function injectSelectStyle() {
  if (document.getElementById(SELECT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = SELECT_STYLE_ID;
  style.textContent = `
html.${SELECTING_CLASS}, html.${SELECTING_CLASS} * {
  cursor: crosshair !important;
}
.${HOVER_CLASS} {
  outline: 2px solid #3b82f6 !important;
  background-color: rgba(59, 130, 246, 0.15) !important;
}
@keyframes element-translator-flash {
  0% {
    outline-color: rgba(59, 130, 246, 1);
    background-color: rgba(59, 130, 246, 0.5);
  }
  100% {
    outline-color: rgba(59, 130, 246, 0);
    background-color: rgba(59, 130, 246, 0);
  }
}
.${FLASH_CLASS} {
  outline: 2px solid #3b82f6 !important;
  animation: element-translator-flash 600ms ease-out !important;
}
`;
  document.head.appendChild(style);
}

let selecting = false;

function setupSelectTextListener() {
  if (selecting) return;
  selecting = true;

  injectSelectStyle();
  document.documentElement.classList.add(SELECTING_CLASS);

  let hovered: Element | null = null;

  function updateHover(el: Element | null) {
    if (el === hovered) return;
    hovered?.classList.remove(HOVER_CLASS);
    hovered = el;
    hovered?.classList.add(HOVER_CLASS);
  }

  function overHandler(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    updateHover(target?.closest("p, li") ?? null);
  }

  function outHandler(event: MouseEvent) {
    const related = event.relatedTarget as HTMLElement | null;
    updateHover(related?.closest("p, li") ?? null);
  }

  function cleanup() {
    document.removeEventListener("click", handler, true);
    document.removeEventListener("mouseover", overHandler, true);
    document.removeEventListener("mouseout", outHandler, true);
    hovered?.classList.remove(HOVER_CLASS);
    document.documentElement.classList.remove(SELECTING_CLASS);
    selecting = false;
  }

  function handler(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    const el = target?.closest("p, li");
    if (!el) return;

    const text = el.textContent?.trim() ?? "";
    if (!text) return;

    cleanup();

    el.classList.add(FLASH_CLASS);
    const removeFlash = () => {
      el.classList.remove(FLASH_CLASS);
      document.getElementById(SELECT_STYLE_ID)?.remove();
    };
    el.addEventListener("animationend", removeFlash, { once: true });
    setTimeout(removeFlash, 700);

    browser.runtime.sendMessage({ type: "PARAGRAPH_CLICKED", text });
  }

  document.addEventListener("click", handler, true);
  document.addEventListener("mouseover", overHandler, true);
  document.addEventListener("mouseout", outHandler, true);
}

function getMainContainer(): Element{
  return (
    document.querySelector("main, article, [role='main']") ?? document.body
  );
}

const EXCLUDE_SELECTOR = "a, nav, footer, aside, header, [role='navigation'], [role='banner'], [role='contentinfo']";

function collectMainContentTexts() {
  const container = getMainContainer();
  const elements = container.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li");
  let sentCount = 0;
  let skipCount = 0;
  let id = 0;
  const textList: Map<number, { element: Element }> = new Map(); 

  for (const el of elements) {
    if (el.closest(EXCLUDE_SELECTOR)) continue;

    const text = (el.textContent ?? "").trim();
    if (!text) {
      skipCount++;
      continue;
    };
    
    try {
      const message = { type: "GET_ALL_TEXT", text, id};
      textList.set(id, { element: el });
      browser.runtime.sendMessage(message)
        .then((response) => {
          const res = response as LLMResponse;
          const unit = textList.get(res.id);
          if (unit) {
            unit.element.textContent = res.translatedText;
          }
         })
        .catch((err) => {
          console.error(`[element-translator] sendMessage failed for <${el.tagName}>:`, err);
        });
      sentCount++;
    } catch (err) {
      console.error(`[element-translator] Error on <${el.tagName}>:`, err);
      skipCount++;
    }

    id++;
  }
  console.log(`[element-translator] Done. sent=${sentCount} skipped=${skipCount} total=${elements.length}`);
}

interface translateAllPage {
  /** browser runtime listener messages. */
  type: string;
}

browser.runtime.onMessage.addListener(async(message: unknown) => {
  const msg = message as Partial<translateAllPage>;
  if (msg.type === "ALL_TEXT_TRANSLATE") {
    collectMainContentTexts();
    return true;
  } else if (msg.type === "SELECT_TRANSLATE") {
    setupSelectTextListener();
    return true;
  }
});
