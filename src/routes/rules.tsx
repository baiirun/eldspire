import { createFileRoute } from "@tanstack/solid-router";
import { renderEldspireRules } from "@/lib/eldspire-rules";

export const Route = createFileRoute("/rules")({
  head: () => ({ meta: [{ title: "Rules | Eldspire" }] }),
  component: RulesPage,
});

function RulesPage() {
  return <div innerHTML={renderEldspireRules()} />;
}
