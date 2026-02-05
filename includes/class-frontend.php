<?php

class ClearPH_Frontend
{

    public function __construct()
    {
        add_shortcode('clearph_gallery', array($this, 'render_gallery_shortcode'));
        add_action('wp_footer', array($this, 'add_lightbox_javascript'));
        // Conditional site-wide image protection based on plugin setting
        add_action('wp_footer', array($this, 'maybe_add_site_right_click_block'));
    }

    private $lightbox_data = array();

    public function render_gallery_shortcode($atts)
    {
        $atts = shortcode_atts(array(
            'id' => 0,
            'title' => '',
            'class' => ''
        ), $atts);

        $gallery_id = 0;

        // Find gallery by ID or title
        if ($atts['id']) {
            $gallery_id = absint($atts['id']);
        } elseif ($atts['title']) {
            $gallery = get_page_by_title($atts['title'], OBJECT, 'clearph_gallery');
            if ($gallery) {
                $gallery_id = $gallery->ID;
            }
        }

        if (!$gallery_id || get_post_type($gallery_id) !== 'clearph_gallery') {
            return '<p>Gallery not found.</p>';
        }

        $settings = get_post_meta($gallery_id, '_clearph_gallery_settings', true);
        $images = get_post_meta($gallery_id, '_clearph_gallery_images', true);

        if (empty($images)) {
            return '<p>No images in this gallery.</p>';
        }

        // Load frontend assets
        wp_enqueue_script('clearph-masonry-frontend');
        wp_enqueue_style('clearph-masonry-frontend');

        return $this->render_gallery($gallery_id, $settings, $images, $atts['class']);
    }

    private function render_gallery($gallery_id, $settings, $images, $extra_class = '')
    {
        $defaults = array(
            'masonry_enabled' => true,
            'columns' => 4,
            'lightbox_enabled' => true,
            'image_size' => 'large',
            'object_fit' => 'cover',
            'border_radius' => 8,
            'column_margin' => '20px'
        );
        $settings = wp_parse_args($settings, $defaults);

        // Handle both old boolean and new integer format for lightbox
        $lightbox_enabled = !empty($settings['lightbox_enabled']) && $settings['lightbox_enabled'] !== '0' && $settings['lightbox_enabled'] !== 0;

        $gallery_class = 'clearph-gallery';
        if ($settings['masonry_enabled']) {
            $gallery_class .= ' masonry-enabled';
        }
        if ($extra_class) {
            $gallery_class .= ' ' . sanitize_html_class($extra_class);
        }

        // Generate unique gallery ID for lightbox grouping
        $gallery_group = 'clearph-gallery-' . $gallery_id;

        // If lightbox is enabled, store data for JavaScript to handle
        if ($lightbox_enabled) {
            $this->lightbox_data[$gallery_group] = array();
            // Always use full-size images in the lightbox per requirement
            $lightbox_size = 'full';
            foreach ($images as $image_id) {
                $full_image = wp_get_attachment_image_src($image_id, $lightbox_size);
                $alt = get_post_meta($image_id, '_wp_attachment_image_alt', true);
                if ($full_image) {
                    $this->lightbox_data[$gallery_group][] = array(
                        'id' => $image_id,
                        'src' => $full_image[0],
                        'caption' => $alt
                    );
                }
            }
        }

        // Build output
        $html = '';

        // Add filter buttons if enabled
        if (!empty($settings['filter_enabled']) && !empty($settings['filter_categories'])) {
            $html .= $this->render_category_filters($gallery_id, $settings);
        }

        // Create the gallery container
        $html .= '<div class="' . esc_attr($gallery_class) . '"';
        $html .= ' data-columns="' . esc_attr($settings['columns']) . '"';
        $html .= ' data-lightbox="' . ($lightbox_enabled ? 'true' : 'false') . '"';
        $html .= ' data-object-fit="' . esc_attr($settings['object_fit']) . '"';
        $html .= ' data-masonry="' . ($settings['masonry_enabled'] ? 'true' : 'false') . '"';
        $html .= ' data-border-radius="' . esc_attr($settings['border_radius']) . '"';
        $html .= ' data-column-margin="' . esc_attr($settings['column_margin']) . '"';
        $html .= ' data-gallery-group="' . esc_attr($gallery_group) . '"';
        $html .= ' style="--border-radius: ' . esc_attr($settings['border_radius']) . 'px; --column-margin: ' . esc_attr($settings['column_margin']) . ';">';

        foreach ($images as $image_id) {
            $html .= $this->render_gallery_item($image_id, $settings, $gallery_group, $lightbox_enabled, $gallery_id);
        }

        $html .= '</div>';

        return $html;
    }

    private function get_image_size_for_masonry($masonry_size, $default_size)
    {
        $size_map = array(
            'regular' => $default_size,
            'tall' => 'large_featured',     // Use larger size for tall images
            'wide' => 'wide',              // Use your wide image size
            'large' => 'large_featured',   // Use larger size for large images
            'xl' => 'full'                 // Keep full size for XL
        );

        return isset($size_map[$masonry_size]) ? $size_map[$masonry_size] : $default_size;
    }

    private function render_category_filters($gallery_id, $settings)
    {
        $categories = array_map('trim', explode(',', $settings['filter_categories']));
        $categories = array_filter($categories); // Remove empty values

        if (empty($categories)) {
            return '';
        }

        $html = '<div class="clearph-gallery-filters" data-gallery-id="' . esc_attr($gallery_id) . '">';
        $html .= '<button class="filter-btn active" data-filter="*">All</button>';

        foreach ($categories as $category) {
            $html .= '<button class="filter-btn" data-filter="' . esc_attr($category) . '">' . esc_html($category) . '</button>';
        }

        $html .= '</div>';

        return $html;
    }

    private function render_gallery_item($image_id, $settings, $gallery_group, $lightbox_enabled, $gallery_id)
    {
        // Check for new grid sizing format first
        $grid_sizing = get_post_meta($image_id, 'clearph_grid_sizing', true);

        $column_span = null;
        $row_span = null;
        $masonry_size = 'regular'; // Default fallback
        $inline_style = '';

        if ($grid_sizing && isset($grid_sizing['column_span']) && isset($grid_sizing['row_span'])) {
            // New grid sizing format - use inline styles
            $column_span = absint($grid_sizing['column_span']);
            $row_span = absint($grid_sizing['row_span']);

            if ($settings['masonry_enabled']) {
                $inline_style = sprintf('grid-column: span %d; grid-row: span %d;', $column_span, $row_span);
            }

            // Convert to legacy size name for image size selection
            $masonry_size = $this->convert_grid_to_legacy_size($column_span, $row_span);
        } else {
            // Legacy masonry sizing format - use CSS classes
            $masonry_size = get_post_meta($image_id, 'clearph_masonry_sizing', true) ?: 'regular';
        }

        $image_size = $this->get_image_size_for_masonry($masonry_size, $settings['image_size']);
        $alt = get_post_meta($image_id, '_wp_attachment_image_alt', true);

        // Get image category
        $image_categories = get_post_meta($gallery_id, '_clearph_image_categories', true);
        $category = isset($image_categories[$image_id]) ? $image_categories[$image_id] : '';

        // Build classes - always include size class for backward compatibility
        $item_class = 'gallery-item size-' . $masonry_size;

        if ($lightbox_enabled) {
            $item_class .= ' lightbox-clickable';
        }

        // Use wp_get_attachment_image for responsive images with srcset
        $image_attrs = array(
            'class' => 'lazy-image',
            'style' => 'object-fit: ' . esc_attr($settings['object_fit']) . '; width: 100%; height: 100%; cursor: ' . ($lightbox_enabled ? 'pointer' : 'default') . ';',
            'loading' => 'lazy',
            'alt' => $alt,
            'sizes' => $this->get_sizes_attribute_for_grid($column_span, $row_span, $masonry_size, $settings['columns'])
        );

        // Build item HTML with optional inline grid styles and data attributes
        $html = '<div class="' . esc_attr($item_class) . '"';
        $html .= ' data-image-id="' . esc_attr($image_id) . '"';

        // Add category data attribute if category is set
        if ($category) {
            $html .= ' data-category="' . esc_attr($category) . '"';
        }

        if ($column_span !== null && $row_span !== null) {
            $html .= ' data-column-span="' . esc_attr($column_span) . '"';
            $html .= ' data-row-span="' . esc_attr($row_span) . '"';
        }

        if ($inline_style) {
            $html .= ' style="' . esc_attr($inline_style) . '"';
        }

        $html .= '>';
        $html .= wp_get_attachment_image($image_id, $image_size, false, $image_attrs);
        $html .= '</div>';

        return $html;
    }

    /**
     * Convert grid sizing back to legacy size name for image size selection
     */
    private function convert_grid_to_legacy_size($column_span, $row_span)
    {
        // Map common grid spans back to legacy sizes
        if ($column_span == 2 && $row_span == 2) return 'regular';
        if ($column_span == 2 && $row_span == 4) return 'tall';
        if ($column_span == 4 && $row_span == 2) return 'wide';
        if ($column_span == 4 && $row_span == 4) return 'large';
        if ($column_span >= 6) return 'xl';

        // For custom/non-standard grid spans, use full size to avoid hard crops
        // This preserves image content for portrait/landscape images with custom ratios
        return 'xl';  // xl maps to 'full' size which is uncropped
    }

    /**
     * Generate sizes attribute for responsive images
     * Supports both new grid sizing (column_span/row_span) and legacy masonry sizes
     */
    private function get_sizes_attribute_for_grid($column_span, $row_span, $masonry_size, $columns)
    {
        // Calculate size based on column span if using new grid system
        if ($column_span !== null) {
            // Micro-column system: each visual column = 2 micro-columns
            $micro_columns_total = $columns * 2;
            $size_percentage = ($column_span / $micro_columns_total) * 100;
        } else {
            // Legacy system: use masonry size
            $base_size = 100 / $columns;

            switch ($masonry_size) {
                case 'wide':
                    $size_percentage = $base_size * 2; // Wide spans 2 columns
                    break;
                case 'large':
                    $size_percentage = $base_size * 2; // Large spans 2 columns
                    break;
                case 'xl':
                    $size_percentage = 100; // XL spans all columns
                    break;
                default:
                    $size_percentage = $base_size; // Regular and tall span 1 column
                    break;
            }
        }

        // Generate responsive sizes based on breakpoints
        $sizes = array(
            "(max-width: 480px) 100vw", // Mobile: single column
            "(max-width: 768px) 50vw",  // Tablet: 2 columns max
            "(max-width: 1024px) {$size_percentage}vw", // Desktop: calculated size
            "{$size_percentage}vw" // Default
        );

        return implode(', ', $sizes);
    }

    public function add_lightbox_javascript()
    {
        if (empty($this->lightbox_data)) {
            return;
        }
?>
        <script type="text/javascript">
            jQuery(document).ready(function($) {
                // Add lightbox data to window
                window.clearphLightboxData = <?php echo json_encode($this->lightbox_data); ?>;
                var clearphIsLoggedIn = <?php echo is_user_logged_in() ? 'true' : 'false'; ?>;

                // Add click handlers for lightbox
                $('.lightbox-clickable').on('click', function(e) {
                    e.preventDefault();

                    const galleryGroup = $(this).closest('.clearph-gallery').data('gallery-group');
                    const imageId = $(this).data('image-id');
                    const lightboxData = window.clearphLightboxData[galleryGroup];

                    if (!lightboxData || typeof $.fancybox === 'undefined') {
                        console.log('FancyBox not available or no lightbox data');
                        return;
                    }

                    // Find current image index
                    let currentIndex = 0;
                    for (let i = 0; i < lightboxData.length; i++) {
                        if (lightboxData[i].id == imageId) {
                            currentIndex = i;
                            break;
                        }
                    }

                    // Build FancyBox button set based on auth
                    var buttons = clearphIsLoggedIn ? ["zoom", "slideShow", "fullScreen", "download", "close"] : ["zoom", "slideShow", "fullScreen", "close"]; // no download when logged out

                    // Open FancyBox
                    $.fancybox.open(lightboxData.map(function(item) {
                        return {
                            src: item.src,
                            type: 'image',
                            caption: item.caption || ''
                        };
                    }), {
                        buttons: buttons,
                        loop: true,
                        protect: <?php echo is_user_logged_in() ? 'false' : 'true'; ?>,
                        animationEffect: "fade",
                        transitionEffect: "slide"
                    }, currentIndex);
                });

                // Gallery-scoped right-click prevention for logged-out users
                if (!clearphIsLoggedIn) {
                    // Block context menu on gallery images
                    $(document).on('contextmenu', '.clearph-gallery img', function(e) {
                        e.preventDefault();
                    });
                    // Also block context menu inside FancyBox images
                    $(document).on('contextmenu', '.fancybox-image', function(e) {
                        e.preventDefault();
                    });
                    // Optional: prevent dragging images to new tab
                    $(document).on('dragstart', '.clearph-gallery img, .fancybox-image', function(e) {
                        e.preventDefault();
                        return false;
                    });
                }
            });
        </script>
    <?php
    }

    /**
     * Site-wide right-click/drag prevention for images when logged-out
     */
    public function maybe_add_site_right_click_block()
    {
        if (is_user_logged_in()) {
            return;
        }
        $scope = get_option('clearph_download_protection_scope', 'gallery');
        if ($scope !== 'site') {
            return; // respect Galleries Only default
        }
    ?>
        <script type="text/javascript">
            (function() {
                // Block context menu and drag on images site-wide (logged-out only)
                document.addEventListener('contextmenu', function(e) {
                    var t = e.target;
                    if (t && t.tagName === 'IMG') {
                        e.preventDefault();
                    }
                }, {
                    capture: true
                });
                document.addEventListener('dragstart', function(e) {
                    var t = e.target;
                    if (t && t.tagName === 'IMG') {
                        e.preventDefault();
                        return false;
                    }
                }, {
                    capture: true
                });
            })();
        </script>
<?php
    }
}
