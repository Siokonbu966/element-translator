interface LLMResponse {
  translatedText: string,
  sourceText: string,
  id: number,
}

function setupSelectTextListener() {
  function handler(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    const el = target?.closest("p, li");
    if (!el) return;

    const text = el.textContent?.trim() ?? "";
    if (!text) return;

    document.removeEventListener("click", handler, true);
    browser.runtime.sendMessage({ type: "PARAGRAPH_CLICKED", text });
  }
  document.addEventListener("click", handler, true);
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
  if (msg.type === "CLICKED_ALL_TEXT") {
    collectMainContentTexts();
    return true;
  } else if (msg.type === "SELECT_TRANSLATE") {
    setupSelectTextListener();
    return true;
  }
});
