console.log("hello extension!");
console.log("load content.js");

document.addEventListener("click", (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  const el = target?.closest("p, li");
  if (!el) return;

  const text = el.textContent?.trim() ?? "";
  if (!text) return;

  browser.runtime.sendMessage({
    type: "PARAGRAPH_CLICKED",
    text,
    url: location.href,
  });
});

function getMainContainer(): Element{
  return (
    document.querySelector("main, aritcle, role=['main']") ?? document.body
  );
}

const EXCLUDE_SELECTOR = "nav, footer, aside, header, [role='navigation'], [role='banner'], [role='contentinfo']";

function collectMainContentTexts(): string[] {
  const container = getMainContainer();
  const elements = container.querySelectorAll("p, li");
  const texts: string[] = [];
  for (const el of elements) {
    if (el.closest(EXCLUDE_SELECTOR)) continue;

    const text = el.textContent?.trim() ?? ""
    if (text) texts.push(text);
  }
  return texts;
}

browser.runtime.onMessage.addListener((msg: unknown) => {
  if (msg.type == "GET_ALL_TEXT") {
    const texts = collectMainContentTexts();
    browser.runtime.sendMessage({ texts });
    return true;
  }
});
