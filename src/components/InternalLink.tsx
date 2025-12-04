import { Link } from "@tanstack/solid-router";
import type { JSX } from "solid-js";

type InternalLinkProps = {
  to: string;
  params?: Record<string, string>;
  children: JSX.Element;
};

export function InternalLink(props: InternalLinkProps) {
  return (
    <Link
      to={props.to}
      params={props.params}
      preload="viewport"
      class="border-b border-dotted border-stone-400 no-underline"
    >
      {props.children}
    </Link>
  );
}
