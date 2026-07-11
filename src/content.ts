console.log("load content.js");

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

const EXCLUDE_SELECTOR = "nav, footer, aside, header, [role='navigation'], [role='banner'], [role='contentinfo']";

/**
 * request for sending transtlate API
 * 
 * @remarks
 * translated is optional
 *
 * @example
 * ```ts
 * const message: translationUnit = {
 *  id: somthing_number;
 *  element: DOMElement;
 *  type: "GET_ALL_TEXT";
 *  original: input domtext;
 *  translated?: return api text;
 * }
 * ```
 */
interface translationUnit {
  /** Element id */
  id: number;

  /** Input element */
  element: Element;

  type: "GET_ALL_TEXT";
  original: string;
  translated?: string;
}

function collectMainContentTexts() {
  const container = getMainContainer();
  const elements = container.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li");
  let sentCount = 0;
  let skipCount = 0;
  let idCount = 0;

  for (const el of elements) {
    if (el.closest(EXCLUDE_SELECTOR)) continue;

    const text = (el.textContent ?? "").trim();
    if(!text) {
      skipCount++;
      continue;
    };
    
    try {
      const message: translationUnit = { type: "GET_ALL_TEXT" as const, id: idCount, nodes: original: text };
      console.log(
        `[element-translator] Sending <${el.tagName}> (${text.length} chars):`,
        text.substring(0, 80)
      );
      browser.runtime.sendMessage(message)
        .then()
        .catch((err) => {
        console.error(`[element-translator] sendMessage failed for <${el.tagName}>:`, err);
      });
      sentCount++;
    } catch (err) {
      console.error(`[element-translator] Error on <${el.tagName}>:`, err);
      skipCount++;
    }

    idCount++;
  }
  console.log(`[element-translator] Done. sent=${sentCount} skipped=${skipCount} total=${elements.length}`);
}

/**
 * @param type - browser runtime listener messages.
 */
interface translateAllPage {
  type: string;
}

browser.runtime.onMessage.addListener(async(message: unknown) => {
  const msg = message as Partial<translateAllPage>;
  if (msg.type == "CLICKED_ALL_TEXT") {
    collectMainContentTexts();
    return true;
  } else if (msg.type == "SELECT_TRANSLATE") {
    setupSelectTextListener();
    return true;
  }
});
