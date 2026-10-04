---
name: ui-polish
description: Fix the subtle layout and interaction bugs that make a UI feel "slightly off", grounded in Adam Wathan's "Build UIs that don't suck" course (Tailwind CSS). Use when building or reviewing cards, lists with icons, icon buttons, tables, dropdown/menus, or any nested rounded container — and proactively when auditing a component for polish. Covers fully clickable cards that stay accessible, concentric border radius, aligning icons with the first line of wrapping text (`lh` unit, SVG viewBox centering), invisible touch-target expansion with `@media (pointer: coarse)`, edge-to-edge scrollable tables, and optional icon columns with CSS subgrid. Triggers on — clickable card, card link, stretched link, screen reader link, nested border radius, inner radius, concentric corners, icon alignment, checklist icon, bullet icon, first line, items-center wrap, touch target, tap target, 44px, 48px, small icon button, hamburger, pointer coarse, pointer fine, responsive table, table overflow, horizontal scroll, page padding, dropdown icon, menu alignment, subgrid, "looks off", "polish", "pixel perfect".
metadata:
  short-description: Six bulletproof fixes for UI details that are subtly broken
---

# UI Polish — Build UIs that don't suck

Distilled from Adam Wathan's free video course *Build UIs that don't suck*
([tailwindcss.com](https://tailwindcss.com), 2025). Five lessons plus an intro video,
each one a component that looks fine in the happy path and breaks on wrap, on touch,
on a narrow screen, with a screen reader, or with optional content.

Examples use Tailwind CSS v4 syntax (`p-(--var)`, `--spacing(n)`, `[--var:value]`)
with the vanilla CSS equivalent. The techniques do not depend on Tailwind.

## Core principles

These run through every lesson. Apply them before reaching for a specific recipe.

1. **Model the relationship, not the result.** A magic number (`mt-0.5`, `rounded-3xl`
   picked by eye, `-mx-6`) works until a neighbouring value changes. Express *why* the
   value is what it is: a `calc()`, the `lh` unit, a shared CSS variable.
2. **One source of truth per design token in a component.** If two declarations must stay
   in sync, put the value in a CSS custom property on the common ancestor and read it in
   both places. Then a change (including a responsive one) cannot desynchronise them.
3. **Encapsulate the fix in the element that needs it.** Prefer a solution whose details
   stay inside one element over one that leaks compensations into parents and siblings
   (padding tweaks, gap tweaks, negative margins scattered around the layout).
4. **Distrust negative margins.** They work until they don't (collapse, one-sided pull,
   surprise overflow). Use them only when there is no structural alternative, and pair
   them with the same variable that defines the space they cancel.
5. **Test the unhappy path.** Long text that wraps, a missing optional element, a 375px
   viewport, a touch device, a screen reader, a parent value changed by a teammate.
6. **Input type ≠ viewport size.** Touch-specific behaviour belongs behind
   `@media (pointer: coarse)` / `(pointer: fine)`, not behind a breakpoint. A tablet is
   a big screen used with fingers.

## 1. Fully clickable card with an accessible link (intro)

**Problem.** Wrapping a whole card in `<a>` makes it clickable, but a screen reader
announces the *entire* card content as the link name ("link, Crafting a design system…
September 5… Most companies try to…"). Users who tab through links hear paragraphs.

**Fix.** Make only the title the link, and stretch an empty child of the link over the
card with absolute positioning.

```html
<article class="group relative isolate ...hover styles on the card...">
  <time class="relative ...">September 5, 2022</time>
  <h2>
    <a href="/posts/slug">
      <span class="absolute inset-0 z-10"></span>
      Crafting a design system for a multiplanetary future
    </a>
  </h2>
  <p>Most companies try to stay ahead of the curve…</p>
</article>
```

- `relative` on the card is the containing block for the overlay.
- `absolute inset-0` makes the empty span cover the whole card → every pixel clicks the link.
- `z-10` puts the overlay above children that are themselves positioned (`relative`
  dates, badges); without it those areas stay non-clickable.
- `isolate` (`isolation: isolate`) scopes that `z-index` to the card so it does not fight
  with headers, popovers or other stacked UI on the page.
- Hover styles stay on the card (`hover:` / `group-hover:`).

**Caveat.** The overlay covers any other interactive element inside the card. A second
button or link in the card must sit above the overlay (`relative z-20`).

## 2. Concentric border radius for nested elements (lesson 1)

**Problem.** A rounded element inside a padded rounded container with the *same* radius
looks wrong; picking a smaller one by eye is "close" but still off.

**Rule.** `inner radius = outer radius − padding`. Example: 32px − 12px = 20px.

**Fix.** Declare radius and padding once as variables on the outer element and derive
the inner radius with `calc()`. Keep units in `rem` (respects user font scaling).

```html
<div class="rounded-(--card-radius) p-(--card-padding)
            [--card-padding:--spacing(3)] [--card-radius:var(--radius-4xl)]">
  <img class="rounded-[calc(var(--card-radius)-var(--card-padding))]" src="…" alt="" />
</div>
```

```css
.card  { --card-radius: 2rem; --card-padding: .75rem;
         border-radius: var(--card-radius); padding: var(--card-padding); }
.card > img { border-radius: calc(var(--card-radius) - var(--card-padding)); }
```

Escalation of quality: eyeballed value < hard-coded correct px < `calc(radius-4xl -
spacing-3)` < shared variables. Only the last one stays correct when someone changes
the radius or the padding. If padding ≥ radius, clamp with `max(0px, …)`.

## 3. Align an icon with the first line of wrapping text (lesson 2)

**Problem.** `flex items-center` centers the icon on the *whole* text block. When the
text wraps to two lines the icon floats between them. `items-start` puts it slightly too
high, and `mt-0.5` (= (line-height − icon size) / 2) breaks as soon as the line height
changes.

**Fix A — general (any element):** wrap the icon in a box exactly one line tall, and
center inside that box. The `lh` unit equals the current computed line height.

```html
<li class="flex items-start gap-x-3 text-sm/6">
  <span class="flex h-[1lh] items-center">
    <svg class="size-5 flex-none" viewBox="0 0 20 20" aria-hidden="true">…</svg>
  </span>
  Custom branding and white-label options
</li>
```

**Fix B — SVG only, no wrapper:** an SVG with a `viewBox` whose box has a different aspect
ratio centers its drawing inside the box (default `preserveAspectRatio="xMidYMid meet"`).
So give it the icon width and a height of one line:

```html
<li class="flex items-start gap-x-3 text-sm/6">
  <svg class="h-[1lh] w-5 flex-none" viewBox="0 0 20 20" aria-hidden="true">…</svg>
  Priority customer support with fast response
</li>
```

Rule of thumb: **never vertically center an icon with a block of text; center it with the
first line.** Applies to checklists, pricing features, alerts, list items with avatars,
form-field hints, toasts. Check `lh` support for your browser targets (Baseline 2023).

## 4. Big touch targets on small icon buttons (lesson 3)

**Problem.** A 24px icon button looks right but is far below the recommended 44px
(Apple HIG) / 48px minimum touch target.

**Rejected fixes.**
- Make the button bigger → changes the visual design and hover area.
- Make it bigger and compensate parent padding / gaps → details leak across the layout
  and every value must be recalculated on any change.
- Negative margins on the enlarged button → fragile (see principle 4).

**Fix.** Keep the button at its visual size and add an invisible, absolutely positioned,
centered child that is the size of the touch target. Clicks on a child count as clicks on
the button, and an absolute element does not affect layout. Show it only for coarse
pointers, so desktop hover states do not trigger from far away.

```html
<button type="button" aria-label="Toggle navigation"
        class="relative flex size-6 items-center justify-center rounded-md hover:bg-zinc-900/15">
  <span class="absolute top-1/2 left-1/2 size-12 -translate-1/2 pointer-fine:hidden"></span>
  <svg class="w-2.5" aria-hidden="true">…</svg>
</button>
```

```css
.touch-target {
  position: absolute; top: 50%; left: 50%;
  width: 48px; height: 48px; transform: translate(-50%, -50%);
}
@media (pointer: fine) { .touch-target { display: none; } }
```

- Center with `top-1/2 left-1/2 -translate-1/2` even if the parent already centers with
  flex, so the expander works in any button (good default for a reusable component).
- `pointer-fine:hidden` is a Tailwind v4.1+ variant; on older versions use the arbitrary
  variant `[@media(pointer:fine)]:hidden`.
- Do **not** use `sm:hidden`: viewport width does not tell you the input type.
- Watch for overlap: two expanded targets closer than 48px will overlap; the later one wins.
- The only detail that leaks out is `relative` on the button.

## 5. Responsive tables that scroll edge to edge (lesson 4)

**Goal.** For general-purpose, data-heavy tables (unknown columns, dashboards), keep the
table a table and let it scroll horizontally on mobile — without the whole page
overflowing and without content being clipped by the page padding.

```html
<div class="px-(--page-padding) py-6 [--page-padding:--spacing(4)] sm:[--page-padding:--spacing(8)]">
  …
  <div class="-mx-(--page-padding) mt-8 flex overflow-x-auto">
    <div class="grow px-(--page-padding)">
      <table class="min-w-full text-left text-sm/6 whitespace-nowrap">…</table>
    </div>
  </div>
</div>
```

Why each piece:

1. **Wrapper with `overflow-x-auto`** → only the table scrolls, not the page. Put
   external margins (`mt-8`) on the wrapper, not on the table: the outermost element owns
   its spacing.
2. **`-mx-(--page-padding)`** on the scroller → it reaches the viewport edges, so rows
   scroll in and out from the edge instead of being cut at the page gutter.
3. **Inner `px-(--page-padding)`** → restores the visual alignment with the rest of the page.
4. **`flex` on the scroller + `grow` on the inner div** → a block child in an overflowing
   container does not extend its padding to the end of the scroll area (no right padding
   when scrolled fully right). A flex item sizes to its content, so the trailing padding
   is kept; `grow` makes it still fill the width on desktop.
   Alternative: `inline-block align-middle` on the inner div (`align-middle` removes the
   extra line-height gap below inline-blocks) — works but more hacky.
5. **`--page-padding` variable on the page container** → the negative margin and the
   inner padding always match the page gutter, including a responsive change
   (`sm:[--page-padding:…]`).

Use a different mobile design (stacked cards, hidden columns) only when you control the
content and columns. Otherwise, a scrolling table is the robust default.

## 6. Optional icons in menus with CSS subgrid (lesson 5)

**Problem.** Menu items built as `flex items-center gap-2` with icon + label:
- one item without an icon → its label jumps left, misaligned;
- fixed icon column (`grid-cols-[--spacing(4)_1fr]`) → fixes that, but a menu with *no*
  icons keeps an empty gutter.

**Fix.** Define the grid once on the menu with an `auto` icon column, make each item span
both columns and adopt the parent tracks with `subgrid`. Put the icon spacing on the icon
(margin), not as a grid `gap`, so the space only exists when an icon exists.

```jsx
function DropdownMenu({ children }) {
  return <div className="grid grid-cols-[auto_1fr] …">{children}</div>
}

function DropdownItem({ children }) {
  return <a className="col-span-2 grid grid-cols-subgrid items-center …">{children}</a>
}

function DropdownIcon({ icon: Icon }) {
  return <Icon className="mr-2 size-4" aria-hidden="true" />
}

function DropdownLabel({ children }) {
  return <span className="col-start-2">{children}</span>
}
```

- `auto` first column → as wide as the widest icon, `0` when no item has one.
- `col-span-2` → each item takes a full row; without it, items fill cells one by one.
- `grid-cols-subgrid` (`grid-template-columns: subgrid`) → the item's children join the
  menu's columns, so all labels line up across items.
- `col-start-2` on the label → it stays in the text column when the icon is missing.
- No `gap-x` on the grid: a gap would remain as an empty offset when the icon column
  collapses. `mr-2` on the icon creates the space only when present.
- The same pattern handles a trailing column (keyboard shortcuts, badges, chevrons):
  `grid-cols-[auto_1fr_auto]`, `col-span-3`.

Subgrid is Baseline 2023. Think of it whenever siblings in different containers must
share column widths: menus, forms with labels, card grids with aligned sections,
definition lists, settings rows.

## Audit checklist

When asked to review or polish a component, walk through this list and report each hit
with the file, the symptom and the fix above.

- [ ] A link wraps a whole card / row with long content → title link + stretched
      `absolute inset-0 z-10` overlay, `relative isolate` on the card.
- [ ] Nested rounded elements share the same radius, or the inner one is eyeballed →
      `calc(outer − padding)` with shared variables.
- [ ] `items-center` aligns an icon/avatar/bullet with text that can wrap →
      `items-start` + `h-[1lh]` box (or `h-[1lh]` on the SVG).
- [ ] Magic nudge values (`mt-px`, `mt-0.5`, `-mt-1`) on icons next to text → same.
- [ ] Interactive element smaller than 44px on touch → absolute centered `size-12`
      expander, hidden with `pointer: fine`.
- [ ] Touch behaviour tied to `sm:` / `md:` breakpoints → `pointer` media query.
- [ ] Wide table that overflows the page, or scrolls but is clipped by page padding →
      the edge-to-edge scroller recipe with a `--page-padding` variable.
- [ ] Negative margin whose value repeats another value by hand → shared variable.
- [ ] Repeated item components with optional leading/trailing content that must align →
      parent grid with `auto` columns + `subgrid` items, margin instead of gap.
- [ ] The fix leaks compensations into parents/siblings → find an encapsulated version.

Test each fix by changing the related value (line height, padding, radius, page padding),
removing the optional element, wrapping the text, and toggling touch emulation in the
browser dev tools.
