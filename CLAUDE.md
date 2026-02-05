# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Clear pH Masonry Gallery is a WordPress plugin that provides a drag-and-drop masonry gallery builder with GSAP animations, FancyBox lightbox integration, and content protection features. It uses CSS Grid for layout (not JavaScript masonry libraries) and is designed specifically for the Salient WordPress theme.

**Key Features:**
- Custom post type for reusable galleries with shortcode output
- Five masonry sizing options (Regular/Tall/Wide/Large/XL) per image
- Drag-drop gallery builder with grid/list views, grouping, and undo history
- Conditional asset loading (only loads CSS/JS when shortcode is present)
- Lazy loading with IntersectionObserver
- Content protection for logged-out users (right-click prevention, optional resolution capping)

## Development Workflow

**IMPORTANT: There is no build process.** This plugin has no package.json, composer.json, webpack, or any build tools. All development is done by directly editing PHP, JavaScript, and CSS files.

- **Testing changes:** Refresh WordPress admin/frontend in browser
- **Debugging:** Use browser DevTools and WP_DEBUG constant
- **Dependencies:** All external dependencies come from WordPress core or Salient theme (jQuery, jQuery UI Sortable, GSAP, FancyBox 3)
- **No transpilation:** ES6 code is written directly (IE11 not supported)
- **No minification:** Files are served as-is

## Architecture

### Bootstrap Pattern (Singleton)

The main plugin file `clearph-masonry-gallery.php` uses a singleton pattern to initialize all components:

```php
ClearPH_Masonry_Gallery::get_instance()
```

This loads six class files from `/includes/` and instantiates them in order. All classes are prefixed with `ClearPH_` and use underscore naming (no namespaces).

### Component Architecture

**Six independent classes with clear responsibilities:**

1. **Gallery_Post_Type** - Registers `clearph_gallery` CPT, creates meta boxes (shortcode display, settings, image builder)
2. **Admin** - Enqueues admin assets, registers settings page for protection scope
3. **Frontend** - Handles `[clearph_gallery]` shortcode rendering and lightbox initialization
4. **Media_Handler** - AJAX endpoints for saving/retrieving masonry sizes per image
5. **Assets** - Registers (but doesn't enqueue) frontend CSS/JS for conditional loading
6. **Content_Protection** - Feature-flagged protection (resolution capping, attachment blocking, right-click prevention)

**Key Pattern:** Assets class only *registers* files. Frontend class *enqueues* them when shortcode is detected. This prevents loading assets on pages without galleries.

## Masonry Sizing System

This is the most complex cross-file concept in the plugin. The system supports **two sizing methods**:

### Micro-Column Grid System (Current)

The plugin uses a **micro-column architecture** to enable fractional column widths:
- Each visual column = 2 micro-columns
- Example: 3-column gallery = 6 micro-columns
  - 1 visual column = 2 micro-columns (33.33% width)
  - 1.5 visual columns = 3 micro-columns (50% width)
  - 2 visual columns = 4 micro-columns (66.66% width)

**Grid Row System:**
- Base row height: 200px (frontend), 100px (admin preview)
- Row span range: 1-12 rows
- Width/Height controls in admin UI accept micro-column values (1-12)

**Optimal Sizing to Minimize Cropping:**

When using `object-fit: cover`, images crop based on aspect ratio mismatch between the image and its container. To minimize cropping:

**Recommended cell sizes for common aspect ratios:**
- **Portrait photos (2:3 ratio)**: Use 2 micro-cols × 4+ rows (tall cells)
- **Landscape photos (16:9 ratio)**: Use 4+ micro-cols × 2 rows (wide cells)
- **Square photos (1:1 ratio)**: Use 2 micro-cols × 2 rows or 4 micro-cols × 4 rows

**Tips for content preservation:**
- Match row span to image aspect ratio (tall images need more rows)
- Wide images need more column span to preserve composition
- Increase row span if important vertical content is being cropped
- Use Width/Height controls to fine-tune each image's container

### Legacy Named Sizes (Backward Compatible)

The plugin maintains support for the original five preset sizes:
- **Regular (R):** 1 visual column × 2 rows (2 micro-cols × 2 rows)
- **Tall (T):** 1 visual column × 4 rows (2 micro-cols × 4 rows)
- **Wide (W):** 2 visual columns × 2 rows (4 micro-cols × 2 rows)
- **Large (L):** 2 visual columns × 4 rows (4 micro-cols × 4 rows)
- **XL:** Full width × 6 rows (spans all micro-columns × 6 rows)

Clicking these preset buttons automatically populates the Width/Height inputs with corresponding micro-column values.

### Data Flow

**1. Admin UI (admin/js/gallery-builder.js)**
- User clicks R/T/W/L/XL buttons → populates Width/Height inputs → AJAX call to `clearph_update_grid_sizing`
- OR user manually sets Width/Height values → clicks Apply → AJAX call to `clearph_update_grid_sizing`

**2. Storage (class-media-handler.php)**
- New format: `update_post_meta($image_id, 'clearph_grid_sizing', ['column_span' => X, 'row_span' => Y])`
- Legacy format: `update_post_meta($image_id, 'clearph_masonry_sizing', 'regular'|'tall'|etc.)`
- System auto-converts legacy to grid format when loading

**3. Rendering (class-frontend.php)**
- Retrieves grid sizing from meta → applies inline styles: `grid-column: span X; grid-row: span Y;`
- Falls back to legacy CSS classes if no grid sizing found
- Maps size to WordPress image size → generates custom `sizes` attribute for responsive loading

**4. CSS Grid Layout (public/css/gallery.css & admin/css/admin.css)**
- Micro-column grid: 2-6 visual columns = 4-12 micro-columns
- Base row height: 200px (frontend), 100px (admin)
- Inline styles override CSS classes for custom sizing

**5. Image Size Mapping**
Different container sizes load different WordPress image sizes for optimization:
- Regular/Small cells → `large`
- Tall cells → `large_featured`
- Wide cells → `wide`
- Large cells → `large_featured`
- XL cells → `full`

## Data Structures

### Post Meta Keys

**`_clearph_gallery_settings`** (array):
```php
[
  'masonry_enabled' => bool,
  'columns' => int (2-6),
  'lightbox_enabled' => bool,
  'image_size' => string (WP image size),
  'object_fit' => string ('cover'|'contain'|'fill'),
  'border_radius' => string ('0px' to '50px'),
  'column_margin' => string (CSS value like '20px')
]
```

**`_clearph_gallery_images`** (array):
- Array of attachment IDs in display order
- Modified by drag-drop in admin

**`clearph_grid_sizing`** (attachment meta, current):
- Stored per image attachment
- Format: `['column_span' => int(1-12), 'row_span' => int(1-12)]`
- Enables fractional column widths via micro-column system

**`clearph_masonry_sizing`** (attachment meta, legacy):
- Stored per image attachment
- Values: 'regular'|'tall'|'wide'|'large'|'xl'
- Auto-converted to grid sizing when loaded
- FileBird-compatible meta key naming

### Options

**`clearph_download_protection_scope`**:
- `galleries` (default) - Only protect gallery images
- `sitewide` - Protect all images for logged-out users

## Shortcode Usage

Display galleries using either ID or title:

```
[clearph_gallery id="123"]
[clearph_gallery title="Gallery Name"]
[clearph_gallery id="123" class="custom-class"]
```

Returns error message if gallery not found.

## Gallery Builder State Management

The admin interface (`admin/js/gallery-builder.js`) maintains complex client-side state:

```javascript
{
  orderHistory: [],          // Undo stack (max 10 states)
  currentOrderType: null,    // Active ordering button tracking
  viewMode: "grid"|"list",   // View toggle
  listState: {
    grouping: "first-word"|"none",  // Filename-based grouping
    collapsedGroups: Set(),         // Which groups are collapsed
    selectedIds: Set()              // Multi-selected images in list view
  }
}
```

**Grid View:** Visual WYSIWYG with masonry layout, jQuery UI Sortable for drag-drop

**List View:** Better for bulk operations, filename sorting, grouping by first word, multi-select, collapse/expand groups

State is saved to orderHistory before each change for undo functionality.

## Salient Theme Integration

This plugin has hard dependencies on Salient theme features:

- **GSAP:** Detected via `window.gsap` check, uses for viewport animations and hover effects (has CSS fallback)
- **FancyBox 3:** Uses `$.fancybox()` from Salient for lightbox (no fallback - required)
- **Image Sizes:** Expects Salient's custom image sizes (`large_featured`, `wide`, etc.)

The plugin will work with reduced functionality on other themes but lightbox will fail.

## Content Protection

Feature-flagged protection system for logged-out users:

**wp-config.php Constants:**
- `CLEARPH_DISABLE_PROTECTION` - Master kill switch
- `CLEARPH_PROTECT_DOWNGRADE_SIZES` - Cap image resolution at 2048px (default: false)
- `CLEARPH_PROTECT_RIGHTCLICK` - Block right-click/drag (default: true)
- `CLEARPH_PROTECT_BLOCK_ATTACHMENT` - Redirect attachment pages (default: true)

**Protection Scope:**
- Gallery-scoped (default): Only affects `.clearph-gallery img`
- Site-wide: Blocks all IMG elements when enabled in settings

**Implementation:** Client-side event listeners in capture phase + server-side filter hooks for image URLs

## Common Modification Patterns

### Adding New Gallery Settings
1. Add field to meta box in `class-gallery-post-type.php` → `gallery_settings_meta_box()`
2. Save in `save_gallery_meta()` method
3. Read in `class-frontend.php` → `render_gallery()` method
4. Apply in shortcode output or pass to JavaScript via data attributes

### Adding New Masonry Sizes
1. Update size validation in `class-media-handler.php` → `update_masonry_size()`
2. Add CSS Grid span rules in `public/css/gallery.css` and `admin/css/admin.css`
3. Add to image size mapping in `class-frontend.php` → `get_image_size_for_masonry()`
4. Add button in admin UI template (in `class-gallery-post-type.php`)
5. Update responsive breakpoints in CSS for new size

### Modifying Frontend Display
- **HTML structure:** `class-frontend.php` → `render_gallery()`
- **CSS styling:** `public/css/gallery.css`
- **JavaScript behavior:** `public/js/masonry-gallery.js` (ClearPHGallery class)
- **Animations:** Modify GSAP timeline in masonry-gallery.js or CSS transitions for fallback

### Modifying Admin Builder
- **Layout/styles:** `admin/css/admin.css`
- **Behavior:** `admin/js/gallery-builder.js`
- **Meta box HTML:** `class-gallery-post-type.php` → meta box methods

## File Organization

```
clearph-masonry-gallery/
├── clearph-masonry-gallery.php    # Bootstrap singleton
├── includes/                       # PHP class files (6 components)
├── admin/                          # Admin CSS/JS
├── public/                         # Frontend CSS/JS
├── README.md                       # User documentation
└── test-animations.html           # Developer testing guide
```

## Technical Notes

- **CSS Grid vs JavaScript Masonry:** Uses CSS Grid for better performance and simpler code, trade-off is less organic brick-wall layout
- **Lazy Loading:** IntersectionObserver API with 100px rootMargin (no polyfill - modern browsers only)
- **Responsive Strategy:** Breakpoints at 480px, 768px, 1024px with column reduction and masonry size adjustments
- **Performance:** Uses `will-change: transform`, hardware acceleration via `translateZ(0)`, conditional asset loading
- **Browser Support:** Modern browsers only (CSS Grid, IntersectionObserver, ES6 classes - no IE11)
