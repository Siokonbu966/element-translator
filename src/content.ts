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

function collectMainContentTexts() {
  const container = getMainContainer();
  const elements = container.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li");
  let sentCount = 0;
  let skipCount = 0;

  for (const el of elements) {
    if (el.closest(EXCLUDE_SELECTOR)) continue;

    const text = (el.textContent ?? "").trim();
    if(!text) {
      skipCount++;
      continue;
    };
    
    try {
      const message = { type: "PARAGRAPH_CLICKED" as const, text: text};
      console.log(
        `[element-translator] Sending <${el.tagName}> (${text.length} chars):`,
        text.substring(0, 80)
      );
      browser.runtime.sendMessage(message).catch((err) => {
        console.error(`[element-translator] sendMessage failed for <${el.tagName}>:`, err);
      });
      sentCount++;
    } catch (err) {
      console.error(`[element-translator] Error on <${el.tagName}>:`, err);
      skipCount++;
    }
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
  if (msg.type == "GET_ALL_TEXT") {
    console.log("get GET_ALL_TEXT msg")
    collectMainContentTexts();
    return true;
  } else if (msg.type == "SELECT_TRANSLATE") {
    console.log("get SELECT_TRANSLATE")
    setupSelectTextListener();
    return true;
  }
});
