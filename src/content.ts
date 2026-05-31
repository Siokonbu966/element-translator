console.log("hello extension!");

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
