import React from "react";
import ReactDOM from "react-dom/client";
import { Providers } from "./app/providers";
import App from "./App";
import { seedIfEmpty } from "./mocks/seed";
import "./index.css";

seedIfEmpty();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>,
);