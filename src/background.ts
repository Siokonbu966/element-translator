browser.runtime.onMessage.addListener((message: any) => {
  if (!message || message.type !== "PARAGRAPH_CLICKED") return;
  const text = typeof message.text === "string" ? message.text : "";
  console.log("paragraph text:", text);
  console.log(message)
});
