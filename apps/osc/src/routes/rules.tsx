import { createFileRoute } from "@tanstack/solid-router";
import { marked } from "marked";
import rules from "../content/osc-rules.md?raw";

export const Route = createFileRoute("/rules")({
  head: () => ({ meta: [{ title: "Rules | OSC" }] }),
  component: RulesPage,
});

const rulesHtml = marked.parse(rules, { async: false }) as string;

function RulesPage() {
  return (
    <article class="rules-page prose" innerHTML={rulesHtml} />
  );
}
