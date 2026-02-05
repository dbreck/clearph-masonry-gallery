# Clear pH Masonry Gallery

A WordPress plugin for creating advanced masonry galleries with drag-drop ordering, bulk media selection, and GSAP animations.

## Features

- **Multiple Galleries**: Create and manage multiple gallery instances
- **Masonry Toggle**: Enable/disable masonry layout per gallery  
- **Flexible Columns**: 2-6 column layouts
- **Lightbox Integration**: Works with FancyBox 3 from Salient theme
- **Image Sizing**: Regular, Tall, Wide, and Large (Tall+Wide) options
- **Drag & Drop**: Reorder images with intuitive interface
- **Bulk Selection**: Select multiple images from media library
- **GSAP Animations**: Smooth scroll-triggered reveals and hover effects
- **Responsive**: Adapts to different screen sizes
- **Object Fit Control**: Cover, contain, or fill image sizing

## Usage

### Creating a Gallery

1. Go to **Masonry Galleries** in the WordPress admin
2. Click **Add New Gallery**
3. Configure gallery settings:
   - Enable/disable masonry layout
   - Choose number of columns (2-6)
   - Toggle lightbox functionality
   - Select image size and object-fit behavior
4. Add images using the **Add Images** button
5. Drag images to reorder
6. Click size buttons (R/T/W/L) to set masonry sizing
7. Publish the gallery

### Displaying a Gallery

Use the shortcode with your gallery ID:

```
[clearph_gallery id="123"]
```

Optional parameters:
```
[clearph_gallery id="123" class="custom-class"]
```

### Masonry Sizing

- **R (Regular)**: Standard single grid cell
- **T (Tall)**: Spans 2 rows vertically  
- **W (Wide)**: Spans 2 columns horizontally
- **L (Large)**: Spans 2 columns and 2 rows

## Requirements

- WordPress 5.0+
- PHP 7.4+
- Salient theme (for FancyBox integration)

## Installation

1. Upload plugin folder to `/wp-content/plugins/`
2. Activate the plugin
3. Visit **Masonry Galleries** to create your first gallery

## Technical Notes

- Uses CSS Grid for layout (not JavaScript masonry)
- Stores masonry sizing in FileBird compatible meta fields
- GSAP animations require GSAP to be loaded (included with Salient)
- Responsive breakpoints automatically adjust columns
- Works with existing WordPress image sizes

## File Structure

```
clearph-masonry-gallery/
├── clearph-masonry-gallery.php    # Main plugin file
├── includes/                      # Core classes
├── admin/                         # Admin interface assets
└── public/                        # Frontend assets
```
