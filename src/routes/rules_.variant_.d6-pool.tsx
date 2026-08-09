import { createFileRoute } from "@tanstack/solid-router";
import { renderEldspireRulesD6PoolVariant } from "@/lib/eldspire-rules-d6-pool-variant";

export const Route = createFileRoute("/rules_/variant_/d6-pool")({
  head: () => ({ meta: [{ title: "d6 Pool Variant | Eldspire" }] }),
  component: RulesD6PoolVariantPage,
});

function RulesD6PoolVariantPage() {
  return <div innerHTML={renderEldspireRulesD6PoolVariant()} />;
}
