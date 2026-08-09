import { createFileRoute } from "@tanstack/solid-router";
import { renderEldspireRulesVariant } from "@/lib/eldspire-rules-variant";

export const Route = createFileRoute("/rules_/variant")({
  head: () => ({ meta: [{ title: "Experimental Rules | Eldspire" }] }),
  component: RulesVariantPage,
});

function RulesVariantPage() {
  return <div innerHTML={renderEldspireRulesVariant()} />;
}
