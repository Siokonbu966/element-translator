import React from "react";
import { createRoot } from "react-dom/client";
import browser from "webextension-polyfill";
import "./popup.css";

interface Item {
  text: string;
  url: string;
  at: number;
}

interface State {
  history: Item[];
}

export class App extends React.Component<{}, State> {
  state: State = { history: [] };

  componentDidMount() {
    browser.storage.local.get("history").then((store) => {
      const history = Array.isArray(store.history) ? store.history : [];
      this.setState({ history });
    });
  }

  handleStartCapture = () => {
    browser.runtime.sendMessage({ type: "START_CAPTURE" });
  };

  render() {
    return (
      <div>
        <h1 className="text-2xl">Element-Translator</h1>
        <button onClick={this.handleStartCapture}>選択</button>

        {this.state.history.map((item) => (
          <div key={item.at}>
            <div>{item.text}</div>
            <small>{item.url}</small>
          </div>
        ))}
      </div>
    );
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
