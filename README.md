# Clear pH Masonry Gallery

A WordPress plugin for creating advanced masonry galleries with drag-drop ordering, bulk media selection, category filtering, and GSAP animations. Built for the Salient theme but works on other themes with CSS-only fallback animations.

## Features

- **Multiple Galleries**: Create and manage multiple gallery instances via custom post type
- **Masonry Toggle**: Enable/disable masonry layout per gallery
- **Flexible Columns**: 2-6 column layouts using CSS Grid with micro-column architecture
- **Category Filtering**: Assign categories to images and display animated filter buttons
- **Lightbox Integration**: Works with FancyBox 3 from Salient theme
- **Image Sizing**: Five presets (R/T/W/L/XL) plus custom Width/Height controls for fine-tuned cell sizing
- **Drag & Drop**: Reorder images with jQuery UI Sortable (grid view) or multi-select bulk operations (list view)
- **Bulk Selection**: Select multiple images from WordPress media library
- **GSAP Animations**: Smooth scroll-triggered reveals and hover effects (with CSS fallback)
- **Responsive**: Breakpoints at 480px, 768px, 1024px with automatic column reduction
- **Object Fit Control**: Cover, contain, or fill image sizing per gallery
- **Content Protection**: Optional right-click prevention and resolution capping for logged-out users
- **GitHub Auto-Updater**: Updates appear in WordPress admin like any plugin from wordpress.org

## Installation

1. Upload plugin folder to `/wp-content/plugins/`
2. Activate the plugin
3. Visit **Masonry Galleries** to create your first gallery

Updates are delivered via GitHub Releases and appear in **Plugins > Updates** in WP admin. Click "Check for updates" in the plugin row to force a check.

## Usage

### Creating a Gallery

1. Go to **Masonry Galleries** in the WordPress admin
2. Click **Add New Gallery**
3. Configure gallery settings:
   - Enable/disable masonry layout
   - Choose number of columns (2-6)
   - Toggle lightbox functionality
   - Select image size and object-fit behavior
   - Set border radius and column margin
4. Add images using the **Add Images** button
5. Drag images to reorder (grid view) or use grouping/multi-select (list view)
6. Set masonry sizing per image:
   - Click preset buttons (R/T/W/L/XL), or
   - Use Width/Height inputs for custom micro-column values
7. Optionally assign categories to images for frontend filtering
8. Publish the gallery

### Displaying a Gallery

Use the shortcode with gallery ID or title:

```
[clearph_gallery id="123"]
[clearph_gallery title="Gallery Name"]
[clearph_gallery id="123" class="custom-class"]
```

### Masonry Sizing

**Preset Sizes:**
- **R (Regular)**: 1 column x 2 rows (2 micro-cols x 2 rows)
- **T (Tall)**: 1 column x 4 rows (2 micro-cols x 4 rows)
- **W (Wide)**: 2 columns x 2 rows (4 micro-cols x 2 rows)
- **L (Large)**: 2 columns x 4 rows (4 micro-cols x 4 rows)
- **XL**: Full width x 6 rows (all micro-columns x 6 rows)

**Custom Sizing:**
Use the Width/Height controls to set any micro-column span (1-12) for precise control over each image's grid cell.

## Requirements

- WordPress 5.0+
- PHP 7.4+
- Salient theme recommended (for FancyBox lightbox and GSAP animations)

## Theme Compatibility

This plugin is designed for the Salient theme but works on any theme:

- **GSAP**: Detected at runtime via `typeof gsap !== "undefined"`. Falls back to CSS animations if absent.
- **FancyBox 3**: Required for lightbox. Uses `$.fancybox()` from Salient.
- **Image Sizes**: Uses Salient's custom sizes (`large_featured`, `wide`) with fallback to standard WordPress sizes.

**Important:** GSAP is intentionally NOT listed as a WordPress script dependency. See "GSAP Dependency" below.

## GSAP Dependency Warning

**Never add GSAP as a `wp_register_script` dependency.** Themes commonly deregister, rename, or swap GSAP script handles (e.g., to remove duplicates from CDN plugins). If GSAP is listed as a hard dependency and gets deregistered, WordPress will **silently skip loading the entire gallery JS file** with no error.

The plugin detects GSAP at runtime (`typeof gsap !== "undefined"`) and falls back to CSS animations. This is by design.

## Content Protection

Optional protection for logged-out users, controlled via `wp-config.php` constants:

- `CLEARPH_DISABLE_PROTECTION` - Master kill switch
- `CLEARPH_PROTECT_RIGHTCLICK` - Block right-click/drag (default: true)
- `CLEARPH_PROTECT_BLOCK_ATTACHMENT` - Redirect attachment pages (default: true)
- `CLEARPH_PROTECT_DOWNGRADE_SIZES` - Cap resolution at 2048px (default: false)

Protection scope (gallery-only or site-wide) is configurable in **Settings > Clear pH Gallery**.

## Updating

The plugin includes a built-in GitHub updater:

1. Updates from GitHub Releases appear in **Plugins > Updates**
2. Click "Check for updates" in the plugin row to force a fresh check
3. Install updates like any WordPress plugin

**Release workflow (for developers):**
1. Bump version in plugin header AND `CLEARPH_MASONRY_VERSION` constant
2. Commit and push to `master`
3. Create a tagged GitHub release (e.g., `v1.3.0`)

## Technical Notes

- Uses CSS Grid for layout (not JavaScript masonry libraries)
- Micro-column architecture enables fractional column widths (each visual column = 2 micro-columns)
- Gallery data is stored entirely in the database (custom post type, post meta, attachment meta) — swapping plugin files is always safe
- Lazy loading via native `loading="lazy"` attribute (no custom blur/fade placeholders)
- Category filters link to galleries via `data-gallery-id` attribute (not DOM traversal) for WPBakery compatibility
- Conditional asset loading — CSS/JS only load on pages with the shortcode
- Progressive enhancement: content is always visible even if JS fails to load

## File Structure

```
clearph-masonry-gallery/
├── clearph-masonry-gallery.php    # Bootstrap singleton
├── includes/                      # PHP class files
│   ├── class-gallery-post-type.php  # CPT, meta boxes, admin UI
│   ├── class-admin.php              # Admin assets, settings page
│   ├── class-frontend.php           # Shortcode rendering, lightbox
│   ├── class-media-handler.php      # AJAX endpoints for sizing
│   ├── class-assets.php             # Register (not enqueue) frontend assets
│   ├── class-content-protection.php # Feature-flagged protection
│   └── class-github-updater.php     # GitHub release updater
├── admin/                         # Admin CSS/JS
│   ├── css/admin.css
│   └── js/gallery-builder.js
├── public/                        # Frontend CSS/JS
│   ├── css/gallery.css
│   └── js/masonry-gallery.js
└── README.md
```
