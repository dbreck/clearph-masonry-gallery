<?php

class ClearPH_Media_Handler {

    public function __construct() {
        add_action('wp_ajax_clearph_update_masonry_size', array($this, 'update_masonry_size'));
        add_action('wp_ajax_clearph_get_masonry_size', array($this, 'get_masonry_size'));
        add_action('wp_ajax_clearph_update_grid_sizing', array($this, 'update_grid_sizing'));
        add_action('wp_ajax_clearph_get_grid_sizing', array($this, 'get_grid_sizing'));
        add_action('wp_ajax_clearph_get_image_categories', array($this, 'get_image_categories'));
        add_action('wp_ajax_clearph_update_video_settings', array($this, 'update_video_settings'));
        add_action('wp_ajax_clearph_get_video_settings', array($this, 'get_video_settings'));
        add_action('wp_ajax_clearph_update_object_position', array($this, 'update_object_position'));
        add_action('wp_ajax_clearph_get_object_position', array($this, 'get_object_position'));
        add_action('wp_ajax_clearph_batch_update_sizing', array($this, 'batch_update_sizing'));
        add_action('wp_ajax_clearph_get_images_metadata', array($this, 'get_images_metadata'));
    }

    /**
     * Allowed object-position keyword values (matches the 9 presets in the UI).
     */
    public static function allowed_object_positions() {
        return array(
            'center center', 'center top', 'center bottom',
            'left top', 'left center', 'left bottom',
            'right top', 'right center', 'right bottom',
        );
    }

    /**
     * Update per-image object-position (for cover cropping alignment).
     * Empty string clears the override so the gallery-level default applies.
     */
    public function update_object_position() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id = absint($_POST['image_id']);
        $position = isset($_POST['position']) ? sanitize_text_field($_POST['position']) : '';

        if (!$image_id) {
            wp_send_json_error('Invalid image ID');
        }

        if ($position === '') {
            delete_post_meta($image_id, 'clearph_object_position');
            wp_send_json_success(array('image_id' => $image_id, 'position' => ''));
        }

        if (!in_array($position, self::allowed_object_positions(), true)) {
            wp_send_json_error('Invalid position value');
        }

        update_post_meta($image_id, 'clearph_object_position', $position);

        wp_send_json_success(array(
            'image_id' => $image_id,
            'position' => $position,
        ));
    }

    /**
     * Get per-image object-position (empty string means "inherit from gallery").
     */
    public function get_object_position() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id = absint($_POST['image_id']);
        if (!$image_id) {
            wp_send_json_error('Invalid image ID');
        }

        $position = get_post_meta($image_id, 'clearph_object_position', true);
        if (!in_array($position, self::allowed_object_positions(), true)) {
            $position = '';
        }

        wp_send_json_success(array(
            'image_id' => $image_id,
            'position' => $position,
        ));
    }

    /**
     * Helper: update a single image's sizing within gallery-scoped post meta.
     */
    private function set_image_sizing($post_id, $image_id, $column_span, $row_span) {
        $all_sizing = get_post_meta($post_id, '_clearph_image_sizing', true);
        if (!is_array($all_sizing)) $all_sizing = array();
        $all_sizing[strval($image_id)] = array(
            'column_span' => $column_span,
            'row_span'    => $row_span,
        );
        update_post_meta($post_id, '_clearph_image_sizing', $all_sizing);
    }

    /**
     * Update masonry size using named presets (regular, tall, wide, large, xl).
     * Stores in gallery-scoped post meta (_clearph_image_sizing).
     */
    public function update_masonry_size() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id = absint($_POST['image_id']);
        $post_id  = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        $size     = sanitize_text_field($_POST['size']);

        if (!$image_id || !$post_id || !in_array($size, array('regular', 'tall', 'wide', 'large', 'xl'))) {
            wp_die('Invalid parameters');
        }

        $converted = $this->convert_legacy_size_to_grid($size);
        $this->set_image_sizing($post_id, $image_id, $converted['column_span'], $converted['row_span']);

        wp_send_json_success(array(
            'image_id' => $image_id,
            'size' => $size,
            'column_span' => $converted['column_span'],
            'row_span' => $converted['row_span'],
        ));
    }

    /**
     * Get masonry size — reads from gallery-scoped post meta with attachment meta fallback.
     */
    public function get_masonry_size() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id = absint($_POST['image_id']);
        $post_id  = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;

        if (!$image_id) {
            wp_die('Invalid image ID');
        }

        // Gallery-scoped sizing
        if ($post_id) {
            $all_sizing = get_post_meta($post_id, '_clearph_image_sizing', true);
            if (is_array($all_sizing) && isset($all_sizing[strval($image_id)])) {
                $s = $all_sizing[strval($image_id)];
                $size = $this->convert_grid_to_legacy_name($s['column_span'], $s['row_span']);
                wp_send_json_success(array('image_id' => $image_id, 'size' => $size));
            }
        }

        // Legacy fallback
        $size = get_post_meta($image_id, 'clearph_masonry_sizing', true) ?: 'regular';
        wp_send_json_success(array('image_id' => $image_id, 'size' => $size));
    }

    /**
     * Update grid sizing — stores in gallery-scoped post meta.
     */
    public function update_grid_sizing() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id    = absint($_POST['image_id']);
        $post_id     = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        $column_span = isset($_POST['column_span']) ? absint($_POST['column_span']) : 0;
        $row_span    = isset($_POST['row_span']) ? absint($_POST['row_span']) : 0;

        if (!$image_id || !$post_id) {
            wp_send_json_error('Invalid image or gallery ID');
        }
        if ($column_span < 1 || $column_span > 12) {
            wp_send_json_error('Column span must be between 1 and 12');
        }
        if ($row_span < 1 || $row_span > 12) {
            wp_send_json_error('Row span must be between 1 and 12');
        }

        $this->set_image_sizing($post_id, $image_id, $column_span, $row_span);

        wp_send_json_success(array(
            'image_id' => $image_id,
            'column_span' => $column_span,
            'row_span' => $row_span
        ));
    }

    /**
     * Get grid sizing — reads from gallery-scoped post meta, falls back to attachment meta.
     */
    public function get_grid_sizing() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id = absint($_POST['image_id']);
        $post_id  = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;

        if (!$image_id) {
            wp_send_json_error('Invalid image ID');
        }

        // Gallery-scoped sizing
        if ($post_id) {
            $all_sizing = get_post_meta($post_id, '_clearph_image_sizing', true);
            if (is_array($all_sizing) && isset($all_sizing[strval($image_id)])) {
                $s = $all_sizing[strval($image_id)];
                wp_send_json_success(array(
                    'image_id'    => $image_id,
                    'column_span' => $s['column_span'],
                    'row_span'    => $s['row_span'],
                    'format'      => 'grid',
                ));
            }
        }

        // Fallback: attachment-level grid sizing (migration path)
        $grid_sizing = get_post_meta($image_id, 'clearph_grid_sizing', true);
        if ($grid_sizing && isset($grid_sizing['column_span']) && isset($grid_sizing['row_span'])) {
            wp_send_json_success(array(
                'image_id'    => $image_id,
                'column_span' => $grid_sizing['column_span'],
                'row_span'    => $grid_sizing['row_span'],
                'format'      => 'grid',
            ));
        }

        // Fallback: legacy named size
        $legacy_size = get_post_meta($image_id, 'clearph_masonry_sizing', true) ?: 'regular';
        $converted = $this->convert_legacy_size_to_grid($legacy_size);

        wp_send_json_success(array(
            'image_id'    => $image_id,
            'column_span' => $converted['column_span'],
            'row_span'    => $converted['row_span'],
            'legacy_size' => $legacy_size,
            'format'      => 'legacy',
        ));
    }

    /**
     * Convert legacy named sizes to micro-column grid spans
     * 1 visual column = 2 micro-columns
     */
    private function convert_legacy_size_to_grid($size) {
        $conversion_map = array(
            'regular' => array('column_span' => 2, 'row_span' => 2),  // 1 visual col × 2 rows
            'tall'    => array('column_span' => 2, 'row_span' => 4),  // 1 visual col × 4 rows
            'wide'    => array('column_span' => 4, 'row_span' => 2),  // 2 visual cols × 2 rows
            'large'   => array('column_span' => 4, 'row_span' => 4),  // 2 visual cols × 4 rows
            'xl'      => array('column_span' => 6, 'row_span' => 6),  // Full width (3 visual cols) × 6 rows
        );

        return isset($conversion_map[$size]) ? $conversion_map[$size] : $conversion_map['regular'];
    }

    private function convert_grid_to_legacy_name($column_span, $row_span) {
        if ($column_span == 2 && $row_span == 2) return 'regular';
        if ($column_span == 2 && $row_span == 4) return 'tall';
        if ($column_span == 4 && $row_span == 2) return 'wide';
        if ($column_span == 4 && $row_span == 4) return 'large';
        if ($column_span >= 6) return 'xl';
        return 'xl';
    }

    /**
     * Get image categories for a gallery
     */
    public function get_image_categories() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $post_id = absint($_POST['post_id']);

        if (!$post_id) {
            wp_send_json_error('Invalid post ID');
        }

        $image_categories = get_post_meta($post_id, '_clearph_image_categories', true);

        if (!$image_categories || !is_array($image_categories)) {
            $image_categories = array();
        }

        wp_send_json_success($image_categories);
    }

    /**
     * Extract YouTube video ID from various URL formats
     *
     * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/
     *
     * @param string $url YouTube URL
     * @return string|false Video ID or false if not a valid YouTube URL
     */
    public static function extract_youtube_video_id($url) {
        $patterns = array(
            '/(?:youtube\.com\/watch\?.*v=|youtube\.com\/watch\?.+&v=)([a-zA-Z0-9_-]{11})/',
            '/youtu\.be\/([a-zA-Z0-9_-]{11})/',
            '/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/',
            '/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/',
        );

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $url, $matches)) {
                return $matches[1];
            }
        }

        return false;
    }

    /**
     * Check if a YouTube URL is a Shorts URL
     *
     * @param string $url YouTube URL
     * @return bool
     */
    public static function is_youtube_short($url) {
        return (bool) preg_match('/youtube\.com\/shorts\//', $url);
    }

    /**
     * Update video-specific settings per attachment
     */
    public function update_video_settings() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id = absint($_POST['image_id']);
        if (!$image_id) {
            wp_send_json_error('Invalid attachment ID');
        }

        $autoplay = isset($_POST['autoplay']) ? sanitize_text_field($_POST['autoplay']) : 'hover';
        $show_badge = isset($_POST['show_badge']) ? sanitize_text_field($_POST['show_badge']) : 'yes';

        // Validate
        if (!in_array($autoplay, array('hover', 'always'), true)) {
            $autoplay = 'hover';
        }
        if (!in_array($show_badge, array('yes', 'no'), true)) {
            $show_badge = 'yes';
        }

        $video_settings = array(
            'autoplay' => $autoplay,
            'show_badge' => $show_badge
        );

        update_post_meta($image_id, 'clearph_video_settings', $video_settings);

        wp_send_json_success(array(
            'image_id' => $image_id,
            'autoplay' => $autoplay,
            'show_badge' => $show_badge
        ));
    }

    /**
     * Get video-specific settings for an attachment
     */
    public function get_video_settings() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id = absint($_POST['image_id']);
        if (!$image_id) {
            wp_send_json_error('Invalid attachment ID');
        }

        $video_settings = get_post_meta($image_id, 'clearph_video_settings', true);
        if (!$video_settings || !is_array($video_settings)) {
            $video_settings = array('autoplay' => 'hover', 'show_badge' => 'yes');
        }

        wp_send_json_success(array(
            'image_id' => $image_id,
            'autoplay' => $video_settings['autoplay'],
            'show_badge' => $video_settings['show_badge']
        ));
    }

    /**
     * Batch update grid sizing for multiple images in one request.
     * Stores in gallery-scoped post meta (_clearph_image_sizing).
     * Expects POST['sizing'] as JSON: { "123": { "column_span": 2, "row_span": 4 }, ... }
     */
    public function batch_update_sizing() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $post_id    = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        $sizing_raw = isset($_POST['sizing']) ? wp_unslash($_POST['sizing']) : '';
        $sizing     = json_decode($sizing_raw, true);

        if (!$post_id || !is_array($sizing) || empty($sizing)) {
            wp_send_json_error('Invalid sizing data');
        }

        $all_sizing = get_post_meta($post_id, '_clearph_image_sizing', true);
        if (!is_array($all_sizing)) $all_sizing = array();

        $results = array();

        foreach ($sizing as $image_id => $dims) {
            $image_id   = absint($image_id);
            $col_span   = isset($dims['column_span']) ? absint($dims['column_span']) : 0;
            $row_span   = isset($dims['row_span']) ? absint($dims['row_span']) : 0;

            if (!$image_id || $col_span < 1 || $col_span > 12 || $row_span < 1 || $row_span > 12) {
                continue;
            }

            $all_sizing[strval($image_id)] = array(
                'column_span' => $col_span,
                'row_span'    => $row_span,
            );

            $results[$image_id] = array('column_span' => $col_span, 'row_span' => $row_span);
        }

        update_post_meta($post_id, '_clearph_image_sizing', $all_sizing);

        wp_send_json_success(array('updated' => $results));
    }

    /**
     * Return image dimensions and aspect ratios for a list of attachment IDs.
     * Expects POST['image_ids'] as JSON array: [123, 456, ...]
     */
    public function get_images_metadata() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $ids_raw = isset($_POST['image_ids']) ? wp_unslash($_POST['image_ids']) : '';
        $ids = json_decode($ids_raw, true);

        if (!is_array($ids) || empty($ids)) {
            wp_send_json_error('Invalid image IDs');
        }

        $metadata = array();

        foreach ($ids as $id) {
            $id = absint($id);
            if (!$id) {
                continue;
            }

            $meta = wp_get_attachment_metadata($id);
            if (!$meta || empty($meta['width']) || empty($meta['height'])) {
                continue;
            }

            $w = (int) $meta['width'];
            $h = (int) $meta['height'];

            $metadata[$id] = array(
                'width'        => $w,
                'height'       => $h,
                'aspect_ratio' => round($w / $h, 3),
            );
        }

        wp_send_json_success($metadata);
    }
}
