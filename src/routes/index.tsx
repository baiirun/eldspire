import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { For } from "solid-js";
import { InternalLink } from "@/components/InternalLink";

type RecentPage = {
	name: string;
};

const getRecentPages = createServerFn({ method: "GET" }).handler(async () => {
	const result = await env.DB.prepare(
		"SELECT name FROM pages ORDER BY updated_at DESC LIMIT 3",
	).all<RecentPage>();

	return result.results;
});

export const Route = createFileRoute("/")({
	loader: async () => await getRecentPages(),
	component: App,
});

function App() {
	const recentPages = Route.useLoaderData();

	return (
		<div class="page-column home-page">
			<section class="page-intro">
				<p class="eyebrow">A survival fantasy world</p>
				<h1>Eldspire</h1>
				<p>
					Cultures clash in mystical lands as explorers, adventurers, and
					colonial powers seek fame and fortune in a world haunted by the shadow
					of a fallen civilization.
				</p>
			</section>

			<section class="home-section">
				<h2>Play</h2>
				<ul>
					<li><InternalLink to="/rules">Read the rules</InternalLink></li>
					<li><InternalLink to="/generator">Generate a character</InternalLink></li>
					<li><InternalLink to="/sheet">Print a character sheet</InternalLink></li>
				</ul>
			</section>

			<section class="home-section">
				<h2>Characters</h2>
				<ul>
					<li>
						<InternalLink
							to="/pages/$slug"
							params={{ slug: "thaniel-cottonwood" }}
						>
							Thaniel Cottonwood
						</InternalLink>
					</li>
					<li>
						<InternalLink to="/pages/$slug" params={{ slug: "tharn" }}>
							Tharn
						</InternalLink>
					</li>
					<li>
						<InternalLink to="/pages/$slug" params={{ slug: "eli" }}>
							Eli
						</InternalLink>
					</li>
					<li>
						<InternalLink to="/pages/$slug" params={{ slug: "tirolas" }}>
							Tirolas
						</InternalLink>
					</li>
					<li>
						<InternalLink
							to="/pages/$slug"
							params={{ slug: "reverend-mother" }}
						>
							Reverend Mother
						</InternalLink>
					</li>
				</ul>
			</section>

			<section class="home-section">
				<h2>Logs</h2>
				<ul>
					<li>
						<InternalLink to="/pages/$slug" params={{ slug: "adventure-log" }}>
							Adventure Log
						</InternalLink>
					</li>
					<li>
						<InternalLink to="/pages/$slug" params={{ slug: "quest-log" }}>
							Quest Log
						</InternalLink>
					</li>
				</ul>
			</section>

			<section class="home-section">
				<h2>Recently Updated</h2>
				<ul>
					<For each={recentPages()}>
						{(page) => (
							<li>
								<InternalLink
									to="/pages/$slug"
									params={{
										slug: page.name.toLowerCase().replace(/\s+/g, "-"),
									}}
								>
									{page.name}
								</InternalLink>
							</li>
						)}
					</For>
				</ul>
			</section>
		</div>
	);
}
