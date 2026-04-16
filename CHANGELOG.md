# Changelog

All notable changes to this project are documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/) and this
project adheres to [Semantic Versioning](https://semver.org/).

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
