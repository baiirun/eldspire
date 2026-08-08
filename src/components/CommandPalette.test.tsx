// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { Suspense, type JSX } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

const searchPages = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/solid-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: () => searchPages,
    }),
  }),
}));

vi.mock("@tanstack/solid-router", () => ({
  Link: (props: { children: JSX.Element }) => <a>{props.children}</a>,
  useNavigate: () => vi.fn(),
}));

import { CommandPalette } from "./CommandPalette";

afterEach(() => {
  cleanup();
  searchPages.mockReset();
});

describe("CommandPalette", () => {
  it("keeps focus in the search input while the first results load", async () => {
    let resolveSearch!: (results: Array<{ name: string }>) => void;
    searchPages.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );

    render(() => (
      <Suspense>
        <CommandPalette open={true} onClose={() => undefined} />
      </Suspense>
    ));

    const input = await screen.findByPlaceholderText("Search pages...");
    input.focus();
    fireEvent.input(input, { target: { value: "thar" } });

    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(searchPages).toHaveBeenCalledWith({ data: "thar" });
    expect(document.activeElement).toBe(input);

    resolveSearch([{ name: "Tharn" }]);
    await waitFor(() => expect(screen.getByText("Tharn")).toBeTruthy());
    expect(document.activeElement).toBe(input);
  });
});
