# Changelog

All notable changes to this project are documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/) and this
project adheres to [Semantic Versioning](https://semver.org/).

## [2.2.0] — 2026-10-19

### Features
- **Auto Masonry and Shuffle Masonry buttons** on the main gallery builder bar (and in Order Visually → Layout). Auto sizes every item to fit its image's proportions and gives the same layout on every click; Shuffle gives a new arrangement each click while staying proportion-aware. Both respect the gallery's Columns setting (regular items are one visual column, with occasional 1.5-column accents and larger hero images). The "this will resize everything" confirmation shows once per page load. Replaces the old ratio-blind "Randomize Layout" and the hidden "Smart Layout".
- **New layout algorithm** behind both buttons: skyline packing that places items exactly where CSS grid will, with no holes, scoring each cell size on crop, size and rhythm, with one-item lookahead so a cell never leaves a slot the next image can't fill. On a 49-image, mostly 16:9 test gallery, average crop dropped from ~30% to ~10%.
- **New "Row Height" setting**: Fixed (175px, the previous behavior and still the default) or **Proportional** (row height = column width, so every cell keeps its shape at any screen width). Auto/Shuffle switch a gallery to Proportional and save it together with the sizes.
- **Drag-to-resize handle** on the bottom-right corner of every item in the builder grid and in Layout mode. Snaps to whole grid columns/rows with a live "c × r" readout and saves through the same path as the Width/Height inputs (images, uploaded videos, YouTube and Vimeo).
- **Vimeo support.** "Add YouTube Video" is now **Add Video** and accepts YouTube or Vimeo URLs (vimeo.com/ID, unlisted vimeo.com/ID/HASH, player.vimeo.com/video/ID?h=HASH, channel/group/showcase links). Thumbnail and real dimensions come from Vimeo's oEmbed API, so Auto Masonry sizes Vimeo items correctly; the lightbox plays them through Vimeo's player. A video's URL can be edited later, including switching between YouTube and Vimeo.
- **New "Lightbox Transition" setting**: Slide (default, previous behavior), Fade, or **Resize to Next Image**, which crossfades while the frame morphs from the current image's shape to the next one's. Also available as a WPBakery Lightbox-tab override and the `lightbox_transition` shortcode attribute.

### Fixes
- **Images were cropped twice in larger cells.** Tall/Wide/Large cells loaded Salient's hard-cropped image sizes (`large_featured` 1870×770, `wide` 1000×500), so `object-fit: cover` cropped an already-cropped image (a square photo in a 4×4 cell showed a 2.43:1 strip). Gallery images now always use uncropped sizes; srcset still picks an appropriately small file. This affects every gallery.
- **Tablet layouts (481–768px):** items 3 or 6 micro-columns wide left gaps or created phantom columns when galleries drop to 4 tracks. Wide items now go full width there, with row spans re-picked per image to keep their shape.
- **Phones (≤480px), proportional galleries:** best-fit row count per image instead of forcing every item into a single row.

## [2.1.0] — 2026-08-26

### Features
- **New "Hide Download Button" setting** (Gallery Settings, under Enable Lightbox). Removes the download button from the FancyBox lightbox toolbar. The button was already hidden for logged-out visitors; this setting hides it for logged-in users as well. Available as a per-instance override via the shortcode attribute `lightbox_download_hide="1"` and the WPBakery element's Lightbox group ("Hide Download Button", tri-state Inherit/Yes/No).

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
