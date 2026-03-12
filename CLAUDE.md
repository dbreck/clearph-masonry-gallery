# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Clear pH Masonry Gallery is a WordPress plugin that provides a drag-and-drop masonry gallery builder with GSAP animations, FancyBox lightbox integration, and content protection features. It uses CSS Grid for layout (not JavaScript masonry libraries) and is designed specifically for the Salient WordPress theme.

**Key Features:**
- Custom post type for reusable galleries with shortcode output
- Five masonry sizing options (Regular/Tall/Wide/Large/XL) per image
- Drag-drop gallery builder with grid/list views, grouping, and undo history
- YouTube video support (mixed into same grid with images and self-hosted videos)
- URL-based gallery pre-filtering (`?filter=` or `#filter-`)
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
- Mixed array of attachment IDs (integers) and YouTube placeholders (strings like `yt_dQw4w9WgXcQ`) in display order
- Modified by drag-drop in admin

**`_clearph_youtube_items`** (associative array, keyed by `yt_` ID):
```php
[
  'yt_dQw4w9WgXcQ' => [
    'video_id' => 'dQw4w9WgXcQ',
    'url' => 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    'is_short' => false
  ]
]
```

**`_clearph_youtube_sizing`** (associative array, keyed by `yt_` ID):
```php
[
  'yt_dQw4w9WgXcQ' => [
    'column_span' => 3,
    'row_span' => 4,
    'masonry_size' => 'custom'  // or 'regular'|'tall'|etc. for presets
  ]
]
```

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

This plugin is designed for use with the Salient theme but works on other themes with reduced functionality:

- **GSAP:** Detected via `typeof gsap !== "undefined"` at runtime. Uses for viewport animations and hover effects (has CSS fallback if GSAP absent)
- **FancyBox 3:** Uses `$.fancybox()` from Salient for lightbox (no fallback - required)
- **Image Sizes:** Expects Salient's custom image sizes (`large_featured`, `wide`, etc.)

### CRITICAL: GSAP Must NOT Be a Script Dependency

**Never add GSAP as a `wp_register_script` dependency.** Themes commonly deregister, rename, or swap GSAP script handles (e.g., to remove duplicates from CDN plugins). If GSAP is listed as a hard dependency and gets deregistered, WordPress will **silently skip loading the entire gallery JS file** with no error.

The correct pattern (in `class-assets.php`):
```php
// GOOD - only depend on jQuery, detect GSAP at runtime
wp_register_script('clearph-masonry-frontend', $url, array('jquery'), ...);

// BAD - will break if theme deregisters 'gsap' handle
wp_register_script('clearph-masonry-frontend', $url, array('jquery', 'gsap'), ...);
```

The JS already checks `typeof gsap !== "undefined"` before using GSAP and falls back to CSS animations.

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

## GitHub Updater

The plugin includes a built-in GitHub updater (`includes/class-github-updater.php`) that checks for new releases and integrates with WordPress's native plugin update system.

**How it works:**
- Hooks into `pre_set_site_transient_update_plugins` to check the GitHub Releases API
- Compares the latest release tag (e.g., `v1.2.1`) against the installed version
- Shows updates in **Plugins > Updates** like any wordpress.org plugin
- "Check for updates" link in plugin row clears the transient to force a fresh check
- After install, renames the extracted folder from `owner-repo-hash/` to `clearph-masonry-gallery/`

**Release workflow:**
1. Bump version in plugin header AND `CLEARPH_MASONRY_VERSION` constant
2. Commit and push to `master`
3. Create a tagged GitHub release (e.g., `v1.4.0`) — the updater checks releases, not commits
4. The repo remote uses SSH alias `github.com-dbreck` (not `github.com`) — see `~/.ssh/config`

## Progressive Enhancement Rules

**Never hide elements in CSS that depend on JS to reveal them.** If JS fails to load or execute, content must still be visible.

- Don't use `opacity: 0` on gallery items in CSS — let GSAP's `gsap.set()` handle hiding
- Don't use `filter: blur()` as a loading placeholder — native `loading="lazy"` handles lazy loading
- Don't add decorative CSS (`background`, `box-shadow`, `border-radius`) to `.gallery-item` base styles — these cause visual artifacts and should be opt-in via gallery settings

## Technical Notes

- **CSS Grid vs JavaScript Masonry:** Uses CSS Grid for better performance and simpler code, trade-off is less organic brick-wall layout
- **Lazy Loading:** Native `loading="lazy"` attribute on images. No custom IntersectionObserver blur/fade placeholder.
- **Responsive Strategy:** Breakpoints at 480px, 768px, 1024px with column reduction and masonry size adjustments
- **Performance:** Uses `will-change: transform`, hardware acceleration via `translateZ(0)`, conditional asset loading
- **Browser Support:** Modern browsers only (CSS Grid, IntersectionObserver, ES6 classes - no IE11)
- **Category Filtering:** Filter buttons and gallery are linked by `data-gallery-id` attribute (not DOM traversal) to work inside WPBakery wrappers
- **URL Pre-Filtering:** `?filter=CategoryName` or `#filter-CategoryName` triggers the matching filter button on page load (case-sensitive, must match exactly)

## YouTube Video Support (v1.4.0)

YouTube videos can be mixed into masonry galleries alongside images and self-hosted videos.

### Storage Design

YouTube items use a **unified mixed items array** — `_clearph_gallery_images` stores both integer attachment IDs and `yt_VIDEO_ID` string placeholders. YouTube metadata lives in separate post meta keys (`_clearph_youtube_items`, `_clearph_youtube_sizing`) keyed by `yt_` ID.

**Key design decision:** YouTube sizing is stored in hidden JSON fields on the page and saved with the post (no AJAX), since YouTube items don't have WordPress attachment meta.

### Data Flow (YouTube Items)

1. **Admin UI:** "Add YouTube Video" → prompt for URL → client-side `extractYouTubeId()` → `wp.template('youtube-item')` renders item → data written to `#youtube_items` and `#youtube_sizing` hidden inputs
2. **Sizing changes:** R/T/W/L/XL buttons and Apply button update the hidden JSON fields directly (no AJAX calls)
3. **Save:** `save_gallery_meta()` reads hidden inputs via `$_POST`, JSON decodes, sanitizes, saves to `_clearph_youtube_items` and `_clearph_youtube_sizing` post meta
4. **Frontend render:** `render_youtube_gallery_item()` reads meta, generates inline `grid-column`/`grid-row` styles, renders YouTube thumbnail (`maxresdefault.jpg` with `onerror` fallback to `hqdefault.jpg`), play button SVG overlay
5. **Lightbox:** YouTube items map to FancyBox `iframe` type → `youtube.com/embed/ID?autoplay=1&rel=0`

### Supported URL Formats

`extract_youtube_video_id()` (PHP) and `extractYouTubeId()` (JS) both support:
- `youtube.com/watch?v=ID`
- `youtu.be/ID`
- `youtube.com/shorts/ID` (auto-detected as Short → defaults to Tall size)
- `youtube.com/embed/ID`

### CRITICAL: Hidden Field JSON Must Be Objects, Not Arrays

**Bug found and fixed in v1.4.0:** When `_clearph_youtube_items` or `_clearph_youtube_sizing` are empty PHP arrays, `wp_json_encode([])` outputs `[]` (JSON array). JavaScript `JSON.parse("[]")` returns a JS array. Setting string-keyed properties on a JS array (`arr["yt_xxx"] = {...}`) works at runtime but **`JSON.stringify` silently drops non-numeric keys on arrays**. The hidden field then submits `[]` and all YouTube data is lost.

**Fix:** PHP uses `wp_json_encode($data ?: new stdClass())` to ensure empty values serialize as `{}`. JS helpers (`getYouTubeItems()`, `getYouTubeSizing()`) coerce parsed arrays to objects with `Array.isArray(raw) ? {} : raw`.

### Files Involved

- **Admin template/save:** `class-gallery-post-type.php` (`render_youtube_item()`, `save_gallery_meta()`)
- **Admin JS template:** `class-admin.php` (`tmpl-youtube-item`)
- **Admin JS logic:** `gallery-builder.js` (YouTube management section)
- **URL helpers:** `class-media-handler.php` (`extract_youtube_video_id()`, `is_youtube_short()`)
- **Frontend render:** `class-frontend.php` (`render_youtube_gallery_item()`)
- **Admin CSS:** `admin.css` (YouTube badge, URL input, red button)
- **Frontend CSS:** `gallery.css` (`.gallery-item--youtube`, `.gallery-youtube-badge`)
- **Frontend JS:** `masonry-gallery.js` (URL pre-filtering; YouTube items are excluded from video playback via `.gallery-item--video` selector and get image hover zoom via `<img>` element)

### Phase 2 (Future): Bulk Channel Import

Not yet implemented. Plan:
- "Add Channel Videos" button opens modal with channel URL + count input
- Requires YouTube Data API v3 key (stored in plugin settings)
- Uses `search.list` endpoint with `channelId` and `maxResults`
