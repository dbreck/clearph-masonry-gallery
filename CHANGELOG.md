# Changelog

All notable changes to this project are documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/) and this
project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-06-28

### Features
- **WPBakery element** "Clear pH Masonry Gallery" (category "Clear pH"). Pick a saved gallery from a dropdown and optionally override its display settings per placement — Columns, Masonry, Object Fit/Position, Border Radius, Column Gap, Labels (show/hover/placement/color/shadow), Lightbox (enable, labels-on-lightbox, hide caption), and Filter Animation. Every override defaults to "Inherit from gallery", so an unconfigured element renders identically to a plain `[clearph_gallery id="X"]`.
- **Per-instance shortcode overrides**: `[clearph_gallery]` now accepts the same settings as attributes (e.g. `columns="2" lightbox_caption_hide="1" filter_animation="scale"`). Empty/omitted = inherit the gallery's saved setting.
- **Filter animations**: new "Filter Animation" setting (Filter Settings) replacing the old all-at-once fade with GSAP-powered, staggered entrances — **Fade Up** (default), **Fade**, **Scale / Pop In**, **3D Flip**, **Blur In**, **Slide In**, or **None**. Departing items get a quick fade-out before the layout reflows, then the new set cascades in. Respects `prefers-reduced-motion`, falls back to a CSS fade without GSAP, and skips animation in hidden tabs (so `?filter=` links opened in a background tab still filter correctly instead of stalling on a frozen GSAP timeline).
- **New "Hide lightbox caption" setting** (Image Labels → Label Visibility). The lightbox showed the label or attachment alt text as a caption with no way to turn it off. When enabled, the caption stays in the FancyBox markup (for SEO / accessibility) but is hidden visually via CSS (`visibility:hidden; opacity:0`) using a new `clearph-fancybox-caption-hidden` baseClass. Does not affect in-grid labels.

## [1.9.2] — 2026-04-21

### Fixes
- Blurry images in tall cover-fit cells: `sizes` attribute is now aspect-ratio aware. When a cell is narrower than the source image's aspect (portrait cell + landscape photo), the `vw` breakpoints are inflated so the browser picks a srcset candidate with enough resolution to cover the cell's height. Applies to both the grid-span sizing system and legacy named sizes (Regular/Tall/Wide/Large/XL).
- WordPress 6.7+ was prepending `sizes="auto, ..."` to gallery images via `wp_img_tag_add_auto_sizes()`. The `auto` keyword resolved to the image's rendered CSS width and overrode our calculated breakpoints, defeating the aspect-aware fix. The plugin now strips the `auto, ` prefix from its own images via the `wp_content_img_tag` filter (scoped by the `lazy-image` class, so non-gallery images are untouched).

## [1.9.0] — 2026-04-20

### Features
- New "Show labels on lightbox image" checkbox under Image Labels → Label Visibility. When enabled, the FancyBox caption uses the per-image label text instead of the attachment alt text. Independent of the in-grid visibility checkboxes.
- Plugin now sets `data-show-lightbox-captions` on the gallery wrapper and applies `clearph-fancybox-captioned` as the FancyBox `baseClass` when the setting is on, with matching CSS that re-reveals the caption in case a host theme has hidden `.fancybox-caption--separate`.
- New `lightbox_group` shortcode param. Galleries rendered on the same page that share the same `lightbox_group` value are combined into a single FancyBox chain — advancing past the last image of one gallery continues into the next. Omit the param to keep per-gallery lightbox behavior.

## [1.8.0] — 2026-04-16

### Features
- Gallery Editor — Order view: category filter bar sourced from the gallery's `filter_categories` setting, with an "Uncategorized" bucket when applicable. Filtered drag-reorder preserves the global position of hidden tiles.
- Gallery Editor — Order view: red X delete button on each tile (reveals on hover). Removes the item from the modal and the underlying source grid, cleans up YouTube metadata where applicable, and refreshes the filter bar.
- Gallery Editor — Order view: exposes the same metadata panel as Layout mode (preset size, custom Width/Height, image position, label + color override + text shadow, category, video & YouTube settings). Click a tile to select and edit; settings save live via the existing proxy pattern.

### Changes
- Restructured modal markup: shared `__main` flex wrapper so the settings panel sits alongside whichever body (Order or Layout) is active.
- Updated Order-mode hint copy to point users at the right panel.
- Docs (CLAUDE.md): added coverage for the `filter_all_last` gallery setting and the Salient-class-induced label positioning gotcha.

## [1.7.0] — 2026-04-14

### Features
- Filter "All" link position option — new checkbox to place the All button at the end of the category list
- Filter uniform grid: visible items get uniform sizing when filtered for clean alignment
- Auto-Layout bulk actions in Gallery Editor modal (Randomize Layout + Smart Layout)
- Gallery-scoped image sizing — prevents sizing bleed between galleries sharing the same images

### Fixes
- Label positioning on mobile: override Salient `.eyebrow` margin-bottom that pushed labels toward center of short cells

## [1.6.1] — 2026-04-07

- Auto-Layout bulk actions + gallery-scoped image sizing

## [1.5.0] — 2026-03-20

- Gallery Editor modal, image labels, per-image position control
