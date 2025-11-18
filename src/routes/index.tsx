import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return (
    <div>
      <h1>I. Frame</h1>
      <p>This document has been generated for research purposes after reading 242 sources after considering 682 sources. This document contains confidential and propietary information. It is intended solely for the designated participant(s). Any unauthorized review, use, distribution or disclosure of this document, in whole or in part, is strictly prohibited.</p>
    </div>
  );
}
