import React from "react";
import { createRoot } from "react-dom/client";
import "../popup.css";

export class Window extends React.Component {
  render() {
    return <h1>Hello world!</h1>;
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<Window />);
}
