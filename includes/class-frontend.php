<?php

class ClearPH_Frontend
{

    public function __construct()
    {
        add_shortcode('clearph_gallery', array($this, 'render_gallery_shortcode'));
        add_action('wp_footer', array($this, 'add_lightbox_javascript'));
        // Conditional site-wide image protection based on plugin setting
        add_action('wp_footer', array($this, 'maybe_add_site_right_click_block'));

        // Fix RankMath VideoObject schema — inject thumbnailUrl for YouTube embeds
        add_filter('rank_math/json_ld', array($this, 'fix_video_schema_thumbnails'), 99, 2);
    }

    private $lightbox_data = array();

    public function render_gallery_shortcode($atts)
    {
        $atts = shortcode_atts(array(
            'id' => 0,
            'title' => '',
            'class' => '',
            'lightbox_group' => ''
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
            return '<p>No media in this gallery.</p>';
        }

        // Load frontend assets
        wp_enqueue_script('clearph-masonry-frontend');
        wp_enqueue_style('clearph-masonry-frontend');

        return $this->render_gallery($gallery_id, $settings, $images, $atts['class'], $atts['lightbox_group']);
    }

    private function render_gallery($gallery_id, $settings, $images, $extra_class = '', $lightbox_group_override = '')
    {
        $defaults = array(
            'masonry_enabled' => true,
            'columns' => 4,
            'lightbox_enabled' => true,
            'image_size' => 'large',
            'object_fit' => 'cover',
            'object_position' => 'center center',
            'border_radius' => 8,
            'column_margin' => '20px',
            'label_show' => false,
            'label_show_on_hover' => false,
            'label_show_on_lightbox' => false,
            'label_placement' => 'bottom-center',
            'label_tag' => 'p',
            'label_extra_classes' => '',
            'label_color' => '#ffffff',
            'label_shadow' => false
        );
        $settings = wp_parse_args($settings, $defaults);

        // Load YouTube meta
        $youtube_items = get_post_meta($gallery_id, '_clearph_youtube_items', true);
        $youtube_sizing = get_post_meta($gallery_id, '_clearph_youtube_sizing', true);
        if (!$youtube_items || !is_array($youtube_items)) $youtube_items = array();
        if (!$youtube_sizing || !is_array($youtube_sizing)) $youtube_sizing = array();

        // Handle both old boolean and new integer format for lightbox
        $lightbox_enabled = !empty($settings['lightbox_enabled']) && $settings['lightbox_enabled'] !== '0' && $settings['lightbox_enabled'] !== 0;

        $gallery_class = 'clearph-gallery';
        if ($settings['masonry_enabled']) {
            $gallery_class .= ' masonry-enabled';
        }
        if ($extra_class) {
            $gallery_class .= ' ' . sanitize_html_class($extra_class);
        }

        // Lightbox grouping: custom (shared across galleries) or per-gallery default
        if (!empty($lightbox_group_override)) {
            $gallery_group = 'clearph-lightbox-' . sanitize_html_class($lightbox_group_override);
        } else {
            $gallery_group = 'clearph-gallery-' . $gallery_id;
        }

        // Load per-image labels (used both for in-grid labels and optional lightbox captions)
        $image_labels = get_post_meta($gallery_id, '_clearph_image_labels', true);
        if (!$image_labels || !is_array($image_labels)) $image_labels = array();

        $use_labels_for_lightbox = !empty($settings['label_show_on_lightbox']);

        // If lightbox is enabled, store data for JavaScript to handle
        if ($lightbox_enabled) {
            // Initialize only if this group hasn't been seen yet; shared groups append
            if (!isset($this->lightbox_data[$gallery_group])) {
                $this->lightbox_data[$gallery_group] = array();
            }
            // Always use full-size images in the lightbox per requirement
            $lightbox_size = 'full';
            foreach ($images as $item_id) {
                // Resolve caption: label text (when enabled) overrides alt
                $label_text = '';
                if ($use_labels_for_lightbox) {
                    $label_entry = isset($image_labels[strval($item_id)]) ? $image_labels[strval($item_id)] : null;
                    if ($label_entry && !empty($label_entry['text'])) {
                        $label_text = $label_entry['text'];
                    }
                }

                // YouTube items
                if (is_string($item_id) && strpos($item_id, 'yt_') === 0) {
                    $video_id = substr($item_id, 3);
                    $meta = isset($youtube_items[$item_id]) ? $youtube_items[$item_id] : array();
                    $this->lightbox_data[$gallery_group][] = array(
                        'id' => $item_id,
                        'gallery_id' => $gallery_id,
                        'src' => 'https://www.youtube.com/embed/' . $video_id . '?autoplay=1&rel=0',
                        'type' => 'iframe',
                        'caption' => $use_labels_for_lightbox ? $label_text : ''
                    );
                    continue;
                }

                $image_id = $item_id;
                $mime_type = get_post_mime_type($image_id);
                $is_video = strpos($mime_type, 'video/') === 0;
                $alt = get_post_meta($image_id, '_wp_attachment_image_alt', true);
                $caption = $use_labels_for_lightbox ? $label_text : $alt;

                if ($is_video) {
                    $video_url = wp_get_attachment_url($image_id);
                    if ($video_url) {
                        $this->lightbox_data[$gallery_group][] = array(
                            'id' => $image_id,
                            'gallery_id' => $gallery_id,
                            'src' => $video_url,
                            'type' => 'video',
                            'caption' => $caption
                        );
                    }
                } else {
                    $full_image = wp_get_attachment_image_src($image_id, $lightbox_size);
                    if ($full_image) {
                        $this->lightbox_data[$gallery_group][] = array(
                            'id' => $image_id,
                            'gallery_id' => $gallery_id,
                            'src' => $full_image[0],
                            'type' => 'image',
                            'caption' => $caption
                        );
                    }
                }
            }
        }

        // Load per-gallery image sizing
        $image_sizing = get_post_meta($gallery_id, '_clearph_image_sizing', true);
        if (!$image_sizing || !is_array($image_sizing)) $image_sizing = array();

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
        $html .= ' data-gallery-id="' . esc_attr($gallery_id) . '"';
        $html .= ' data-show-lightbox-captions="' . ($use_labels_for_lightbox ? 'true' : 'false') . '"';
        if (!empty($settings['label_show'])) {
            $html .= ' data-label-show="1"';
        }
        if (!empty($settings['label_show_on_hover'])) {
            $html .= ' data-label-hover="1"';
        }
        $html .= ' style="--border-radius: ' . esc_attr($settings['border_radius']) . 'px; --column-margin: ' . esc_attr($settings['column_margin']) . ';">';

        foreach ($images as $item_id) {
            if (is_string($item_id) && strpos($item_id, 'yt_') === 0) {
                $html .= $this->render_youtube_gallery_item($item_id, $youtube_items, $youtube_sizing, $settings, $gallery_group, $lightbox_enabled, $gallery_id, $image_labels);
            } else {
                $html .= $this->render_gallery_item($item_id, $settings, $gallery_group, $lightbox_enabled, $gallery_id, $image_labels, $image_sizing);
            }
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

        $all_btn = '<button class="filter-btn active" data-filter="*">All</button>';
        $all_last = !empty($settings['filter_all_last']);

        $html = '<div class="clearph-gallery-filters" data-gallery-id="' . esc_attr($gallery_id) . '">';

        if (!$all_last) {
            $html .= $all_btn;
        }

        foreach ($categories as $category) {
            $html .= '<button class="filter-btn" data-filter="' . esc_attr($category) . '">' . esc_html($category) . '</button>';
        }

        if ($all_last) {
            $html .= $all_btn;
        }

        $html .= '</div>';

        return $html;
    }

    private function render_youtube_gallery_item($yt_id, $youtube_items, $youtube_sizing, $settings, $gallery_group, $lightbox_enabled, $gallery_id, $image_labels = array())
    {
        $video_id = substr($yt_id, 3);
        $meta = isset($youtube_items[$yt_id]) ? $youtube_items[$yt_id] : array();
        $sizing = isset($youtube_sizing[$yt_id]) ? $youtube_sizing[$yt_id] : array();
        $is_short = isset($meta['is_short']) ? $meta['is_short'] : false;

        $masonry_size = isset($sizing['masonry_size']) ? $sizing['masonry_size'] : ($is_short ? 'tall' : 'regular');
        $column_span = isset($sizing['column_span']) ? absint($sizing['column_span']) : null;
        $row_span = isset($sizing['row_span']) ? absint($sizing['row_span']) : null;

        $inline_style = '';
        if ($column_span && $row_span && $settings['masonry_enabled']) {
            $inline_style = sprintf('grid-column: span %d; grid-row: span %d;', $column_span, $row_span);
        }

        // Get category
        $image_categories = get_post_meta($gallery_id, '_clearph_image_categories', true);
        $category = isset($image_categories[$yt_id]) ? $image_categories[$yt_id] : '';

        $item_class = 'gallery-item gallery-item--youtube size-' . $masonry_size;
        if ($lightbox_enabled) {
            $item_class .= ' lightbox-clickable';
        }

        $html = '<div class="' . esc_attr($item_class) . '"';
        $html .= ' data-image-id="' . esc_attr($yt_id) . '"';
        $html .= ' data-type="youtube"';

        if ($category) {
            $html .= ' data-category="' . esc_attr($category) . '"';
        }
        if ($column_span && $row_span) {
            $html .= ' data-column-span="' . esc_attr($column_span) . '"';
            $html .= ' data-row-span="' . esc_attr($row_span) . '"';
        }
        if ($inline_style) {
            $html .= ' style="' . esc_attr($inline_style) . '"';
        }

        $html .= '>';

        // YouTube thumbnail with maxresdefault, fallback to hqdefault
        $thumb_max = 'https://img.youtube.com/vi/' . esc_attr($video_id) . '/maxresdefault.jpg';
        $thumb_hq = 'https://img.youtube.com/vi/' . esc_attr($video_id) . '/hqdefault.jpg';

        $html .= '<img src="' . esc_url($thumb_max) . '"';
        $html .= ' onerror="this.onerror=null;this.src=\'' . esc_url($thumb_hq) . '\';"';
        $html .= ' alt="YouTube video" class="lazy-image"';
        $html .= ' style="object-fit: ' . esc_attr($settings['object_fit']) . '; object-position: ' . esc_attr($settings['object_position']) . '; width: 100%; height: 100%; cursor: ' . ($lightbox_enabled ? 'pointer' : 'default') . ';"';
        $html .= ' loading="lazy">';

        // Play button overlay
        $html .= '<span class="gallery-youtube-badge">';
        $html .= '<svg width="48" height="48" viewBox="0 0 68 48"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.63-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="rgba(255,0,0,0.85)"/><path d="M45 24L27 14v20" fill="#fff"/></svg>';
        $html .= '</span>';

        $html .= $this->render_label($yt_id, $settings, $image_labels);

        $html .= '</div>';

        return $html;
    }

    /**
     * Fix RankMath VideoObject schema by injecting thumbnailUrl for YouTube embeds.
     *
     * RankMath auto-detects YouTube videos on the page and generates VideoObject
     * schema, but omits thumbnailUrl — a required field per Google's rich results
     * spec. This filter patches that gap by extracting the video ID from the
     * embedUrl and adding the YouTube thumbnail.
     *
     * The rank_math/json_ld filter passes $data as an associative array keyed by
     * schema type (e.g., 'VideoObject', 'VideoObject-1', etc.), not as a raw
     * @graph array.
     *
     * @param array  $data    Associative array of schema entities keyed by type.
     * @param object $json_ld The RankMath JsonLd instance.
     * @return array Modified schema data.
     */
    public function fix_video_schema_thumbnails($data, $json_ld)
    {
        foreach ($data as $key => &$node) {
            // Match VideoObject, VideoObject-1, VideoObject-2, etc.
            if (!is_array($node) || !isset($node['@type']) || $node['@type'] !== 'VideoObject') {
                continue;
            }

            // Skip if thumbnailUrl already set
            if (!empty($node['thumbnailUrl'])) {
                continue;
            }

            // Extract YouTube video ID from embedUrl and add thumbnail
            if (!empty($node['embedUrl']) && preg_match('/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/', $node['embedUrl'], $matches)) {
                $node['thumbnailUrl'] = 'https://img.youtube.com/vi/' . $matches[1] . '/maxresdefault.jpg';
            }
        }

        return $data;
    }

    private function render_gallery_item($image_id, $settings, $gallery_group, $lightbox_enabled, $gallery_id, $image_labels = array(), $image_sizing = array())
    {
        $mime_type = get_post_mime_type($image_id);
        $is_video = strpos($mime_type, 'video/') === 0;

        $column_span = null;
        $row_span = null;
        $masonry_size = 'regular';
        $inline_style = '';

        // 1. Gallery-scoped sizing (preferred)
        $sizing = isset($image_sizing[strval($image_id)]) ? $image_sizing[strval($image_id)] : null;
        if ($sizing && isset($sizing['column_span']) && isset($sizing['row_span'])) {
            $column_span = absint($sizing['column_span']);
            $row_span = absint($sizing['row_span']);
        } else {
            // 2. Fallback: attachment-level grid sizing (migration path)
            $grid_sizing = get_post_meta($image_id, 'clearph_grid_sizing', true);
            if ($grid_sizing && isset($grid_sizing['column_span']) && isset($grid_sizing['row_span'])) {
                $column_span = absint($grid_sizing['column_span']);
                $row_span = absint($grid_sizing['row_span']);
            }
        }

        if ($column_span && $row_span) {
            if ($settings['masonry_enabled']) {
                $inline_style = sprintf('grid-column: span %d; grid-row: span %d;', $column_span, $row_span);
            }
            $masonry_size = $this->convert_grid_to_legacy_size($column_span, $row_span);
        } else {
            // 3. Fallback: legacy named size
            $masonry_size = get_post_meta($image_id, 'clearph_masonry_sizing', true) ?: 'regular';
        }

        $alt = get_post_meta($image_id, '_wp_attachment_image_alt', true);

        // Per-image object-position override (falls back to gallery setting)
        $item_object_position = get_post_meta($image_id, 'clearph_object_position', true);
        $allowed_positions = array(
            'center center', 'center top', 'center bottom',
            'left top', 'left center', 'left bottom',
            'right top', 'right center', 'right bottom',
        );
        $object_position = in_array($item_object_position, $allowed_positions, true)
            ? $item_object_position
            : $settings['object_position'];

        // Get image category
        $image_categories = get_post_meta($gallery_id, '_clearph_image_categories', true);
        $category = isset($image_categories[$image_id]) ? $image_categories[$image_id] : '';

        // Build classes
        $item_class = 'gallery-item size-' . $masonry_size;

        if ($is_video) {
            $item_class .= ' gallery-item--video';
        }

        if ($lightbox_enabled) {
            $item_class .= ' lightbox-clickable';
        }

        // Build item HTML
        $html = '<div class="' . esc_attr($item_class) . '"';
        $html .= ' data-image-id="' . esc_attr($image_id) . '"';
        $html .= ' data-type="' . ($is_video ? 'video' : 'image') . '"';

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

        if ($is_video) {
            $video_url = wp_get_attachment_url($image_id);
            $poster = '';
            // Use featured image as poster if set on the video attachment
            $poster_id = get_post_thumbnail_id($image_id);
            if ($poster_id) {
                $poster_src = wp_get_attachment_image_url($poster_id, 'large');
                if ($poster_src) {
                    $poster = $poster_src;
                }
            }

            // Get per-video settings
            $video_settings = get_post_meta($image_id, 'clearph_video_settings', true);
            if (!$video_settings || !is_array($video_settings)) {
                $video_settings = array('autoplay' => 'hover', 'show_badge' => 'yes');
            }
            $video_autoplay = isset($video_settings['autoplay']) ? $video_settings['autoplay'] : 'hover';
            $video_show_badge = isset($video_settings['show_badge']) ? $video_settings['show_badge'] : 'yes';

            $html .= '<video class="gallery-video" muted loop playsinline preload="metadata"';
            $html .= ' data-autoplay="' . esc_attr($video_autoplay) . '"';
            $html .= ' style="object-fit: ' . esc_attr($settings['object_fit']) . '; object-position: ' . esc_attr($object_position) . '; width: 100%; height: 100%;"';
            if ($video_autoplay === 'always') {
                $html .= ' autoplay';
            }
            if ($poster) {
                $html .= ' poster="' . esc_url($poster) . '"';
            }
            $html .= '>';
            $html .= '<source src="' . esc_url($video_url) . '" type="' . esc_attr($mime_type) . '">';
            $html .= '</video>';
            if ($video_show_badge === 'yes') {
                $html .= '<span class="gallery-video-badge">&#9654;</span>';
            }
        } else {
            $image_size = $this->get_image_size_for_masonry($masonry_size, $settings['image_size']);
            $image_attrs = array(
                'class' => 'lazy-image',
                'style' => 'object-fit: ' . esc_attr($settings['object_fit']) . '; object-position: ' . esc_attr($object_position) . '; width: 100%; height: 100%; cursor: ' . ($lightbox_enabled ? 'pointer' : 'default') . ';',
                'loading' => 'lazy',
                'alt' => $alt,
                'sizes' => $this->get_sizes_attribute_for_grid($column_span, $row_span, $masonry_size, $settings['columns'])
            );
            $html .= wp_get_attachment_image($image_id, $image_size, false, $image_attrs);
        }

        $html .= $this->render_label($image_id, $settings, $image_labels);

        $html .= '</div>';

        return $html;
    }

    /**
     * Render a label overlay element for a gallery item.
     */
    private function render_label($item_id, $settings, $image_labels)
    {
        if (empty($settings['label_show']) && empty($settings['label_show_on_hover'])) {
            return '';
        }

        $label_data = isset($image_labels[strval($item_id)]) ? $image_labels[strval($item_id)] : null;
        if (!$label_data || empty($label_data['text'])) {
            return '';
        }

        $tag = isset($settings['label_tag']) ? $settings['label_tag'] : 'p';
        $allowed_tags = array('h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div');
        if (!in_array($tag, $allowed_tags, true)) $tag = 'p';

        $placement = isset($settings['label_placement']) ? $settings['label_placement'] : 'bottom-center';
        $extra_classes = isset($settings['label_extra_classes']) ? $settings['label_extra_classes'] : '';

        $classes = 'clearph-gallery-label clearph-gallery-label--' . esc_attr($placement);
        if ($extra_classes) {
            $classes .= ' ' . esc_attr($extra_classes);
        }

        // Color: per-image override > global
        $color = !empty($label_data['color']) ? $label_data['color'] : $settings['label_color'];

        // Shadow: per-image override (empty=inherit, "1"=on, "0"=off) > global
        $shadow_override = isset($label_data['shadow']) ? $label_data['shadow'] : '';
        if ($shadow_override === '1') {
            $use_shadow = true;
        } elseif ($shadow_override === '0') {
            $use_shadow = false;
        } else {
            $use_shadow = !empty($settings['label_shadow']);
        }

        $style = 'color: ' . esc_attr($color) . ';';
        if ($use_shadow) {
            $style .= ' text-shadow: 0 1px 3px rgba(0,0,0,0.6), 0 0 8px rgba(0,0,0,0.3);';
        }

        return '<' . $tag . ' class="' . $classes . '" style="' . $style . '">'
            . esc_html($label_data['text'])
            . '</' . $tag . '>';
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

                    // Pause any playing video in the gallery item
                    var video = $(this).find('video')[0];
                    if (video) video.pause();

                    const $galleryEl = $(this).closest('.clearph-gallery');
                    const galleryGroup = $galleryEl.data('gallery-group');
                    const sourceGalleryId = $galleryEl.data('gallery-id');
                    const showCaptions = $galleryEl.data('show-lightbox-captions') === true || $galleryEl.data('show-lightbox-captions') === 'true';
                    const imageId = $(this).data('image-id');
                    const lightboxData = window.clearphLightboxData[galleryGroup];

                    if (!lightboxData || typeof $.fancybox === 'undefined') {
                        console.log('FancyBox not available or no lightbox data');
                        return;
                    }

                    // Find current image index (match on source gallery + image id, so
                    // shared lightbox groups don't jump to a duplicate in another gallery)
                    let currentIndex = 0;
                    for (let i = 0; i < lightboxData.length; i++) {
                        if (lightboxData[i].id == imageId && (lightboxData[i].gallery_id == sourceGalleryId || typeof lightboxData[i].gallery_id === 'undefined')) {
                            currentIndex = i;
                            break;
                        }
                    }

                    // Build FancyBox button set based on auth
                    var buttons = clearphIsLoggedIn ? ["zoom", "slideShow", "fullScreen", "download", "close"] : ["zoom", "slideShow", "fullScreen", "close"]; // no download when logged out

                    // Open FancyBox
                    $.fancybox.open(lightboxData.map(function(item) {
                        if (item.type === 'iframe') {
                            return {
                                src: item.src,
                                type: 'iframe',
                                opts: {
                                    iframe: {
                                        attr: { allow: 'autoplay; encrypted-media', allowfullscreen: true }
                                    }
                                },
                                caption: item.caption || ''
                            };
                        }
                        if (item.type === 'video') {
                            return {
                                src: '<video controls autoplay style="max-width:100%;max-height:80vh;"><source src="' + item.src + '"></video>',
                                type: 'html',
                                caption: item.caption || ''
                            };
                        }
                        return {
                            src: item.src,
                            type: 'image',
                            caption: item.caption || ''
                        };
                    }), {
                        baseClass: showCaptions ? 'clearph-fancybox-captioned' : '',
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
