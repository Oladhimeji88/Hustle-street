# Photo credits

All photography on the marketing pages comes from [Unsplash](https://unsplash.com),
under the [Unsplash License](https://unsplash.com/license): free for commercial
use, no attribution required. Credit is given here anyway, because these
photographers did the work and it costs us a markdown file.

Nigerian and African photographers were preferred deliberately. This is a Lagos
marketplace, and generic Western stock reads as a template rather than a place.

## Why these are downloaded rather than hotlinked

Three reasons, in order of weight:

1. **The CSP.** `img-src` in `next.config.mjs` is a strict allowlist. Adding a
   third-party image host widens it for every page on the site, permanently, to
   save a one-off download.
2. **The users.** This product targets mid-range Android phones on metered data.
   Self-hosted files go through Next's image optimiser, get served as AVIF/WebP
   at the size actually needed, and are cached by the service worker for offline
   use. A remote URL gets none of that.
3. **The dependency.** A hotlinked image is a marketing page that breaks when
   somebody else's CDN has a bad day.

## The photographs

| File | Subject | Photographer | Source |
|---|---|---|---|
| `scene-post.jpg` | Furniture being carried during a move | Curated Lifestyle | [link](https://unsplash.com/photos/furniture-delivery-service-concept-DEpgEDdtr-M) |
| `scene-hustlers.jpg` | A carpenter using a power tool | Trésor Kande | [link](https://unsplash.com/photos/a-man-using-a-power-tool-on-a-piece-of-wood-GPOTDTZyH-8) |
| `scene-categories.jpg` | Cleaning a home | Curated Lifestyle | [link](https://unsplash.com/photos/black-woman-doing-house-chores-ulcazqOrYrg) |
| `scene-payment.jpg` | Working at a laptop by lamplight | Blessing Olarewaju | [link](https://unsplash.com/photos/man-working-on-a-laptop-with-desk-lamps--cS7zu68Cks) |
| `coverage-lagos.jpg` | Aerial view of Lagos | Omotayo Kofoworola | [link](https://unsplash.com/photos/aerial-view-of-city-buildings-during-daytime-7eHPxnhY_uA) |
| `poster-how-it-works.jpg` | Yellow danfo buses on a Lagos road | Dami Akinbode | [link](https://unsplash.com/photos/yellow-vans-on-side-of-road-pwMCmK_6-OI) |
| `poster-escrow.jpg` | A construction worker in a hard hat | Ben Iwara | [link](https://unsplash.com/photos/a-construction-worker-is-wearing-a-yellow-helmet-ic8c8UAkkeU) |
| `hero-about.jpg` | A group of people together | Ben Iwara | [link](https://unsplash.com/photos/a-group-of-people-that-are-standing-together-C5LQbheSBSw) |
| `hero-safety.jpg` | A worker in a safety vest and helmet | Ben Iwara | [link](https://unsplash.com/photos/construction-worker-wearing-a-safety-vest-and-helmet-eN5n_slN2zc) |
| `hero-explore.jpg` | A rider on a motorcycle in traffic | Ato Aikins | [link](https://unsplash.com/photos/a-man-riding-a-motorcycle-down-a-street-aWq58WRC0BY) |
| `hero-hustlers.jpg` | A person drilling into timber | Trésor Kande | [link](https://unsplash.com/photos/a-man-is-using-a-drill-to-drill-a-piece-of-wood-rHafl05rWAc) |
| `hero-categories.jpg` | A woman standing against a pink wall | Ben Iwara | [link](https://unsplash.com/photos/a-woman-standing-next-to-a-pink-wall-fn0N_pq0TBk) |
| `hero-how-it-works.jpg` | Someone pushing a hand cart | Shedrack Salami | [link](https://unsplash.com/photos/a-person-pushing-a-cart-LrD1rwpKjuc) |

## What is deliberately *not* stock

`story-*.png` — the hustler testimonial cards — are still branded placeholders,
and were left that way on purpose.

Putting a stock photograph of an identifiable person behind an invented quote
attributed to "Blessing, plumber, Surulere" would be fabricating a testimonial.
It misleads users, and the Unsplash License specifically does not permit using
photos of identifiable people in a way that implies they endorse a product.

Those three slots need real, consented people. See `public/media/README.md`.
