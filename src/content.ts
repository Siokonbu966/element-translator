console.log("hello extension!");

document.addEventListener("click", (event: any) => {
  const target = event.target as HTMLElement | null;
  const p = target?.closest("p");
  if (!p) return;

  const text = p.textContent?.trim() ?? "";
  browser.runtime.sendMessage({ type: "PARAGRAPH_CLICKED", text });
});
