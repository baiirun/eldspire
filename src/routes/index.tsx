import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return (
    <div class="space-y-2">
      <h1 class="mb-8">I. <span class="ml-4">Frame</span></h1>
      <p>Cultures clash in mystical lands as explorers, adventurers, and colonial powers seek fame and fortune in a world haunted by the shadow of a fallen civilization.</p>
      <p>I work at home, and if I wanted to, I could have a computer right by my bed, and I'd never have to leave it. But I use a typewriter, and afterwards I mark up the pages with a pencil. Then I call up this woman named Carol out in Woodstock and say, "Are you still doing typing?" Sure she is, and her husband is trying to track bluebirds out there and not having much luck, and so we chitchat back and forth, and I say, "OK, I'll send you the pages."</p>
      <p>Then I'm going down the steps, and my wife calls up, "Where are you going?" I say, "Well, I'm going to go buy an envelope." And she says, "You're not a poor man. Why don't you buy a thousand envelopes? They'll deliver them, and you can put them in a closet." And I say, "Hush." So I go down the steps here, and I go out to this newsstand across the street where they sell magazines and lottery tickets and stationery. I have to get in line because there are people buying candy and all that sort of thing, and I talk to them. The woman behind the counter has a jewel between her eyes, and when it's my turn, I ask her if there have been any big winners lately. I get my envelope and seal it up and go to the postal convenience center down the block at the corner of 47th Street and 2nd Avenue, where I'm secretly in love with the woman behind the counter. I keep absolutely poker-faced; I never let her know how I feel about her. One time I had my pocket picked in there and got to meet a cop and tell him about it. Anyway, I address the envelope to Carol in Woodstock. I stamp the envelope and mail it in a mailbox in front of the post office, and I go home. <strong>And I've had a hell of a good time.</strong> And I tell you, <strong>we are here on Earth to fart around, and don't let anybody tell you any different.</strong></p>
    </div>
  );
}
