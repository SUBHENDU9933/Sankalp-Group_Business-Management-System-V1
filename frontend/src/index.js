import React from "react";
import ReactDOM from "react-dom/client";
import "@/lib/suppress-resize-observer";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
