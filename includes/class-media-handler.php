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
     * Legacy method: Update masonry size using named sizes (regular, tall, wide, large, xl)
     * Kept for backward compatibility with existing admin UI
     */
    public function update_masonry_size() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id = absint($_POST['image_id']);
        $size = sanitize_text_field($_POST['size']);

        if (!$image_id || !in_array($size, array('regular', 'tall', 'wide', 'large', 'xl'))) {
            wp_die('Invalid parameters');
        }

        // Update the masonry sizing meta (using FileBird's field name)
        update_post_meta($image_id, 'clearph_masonry_sizing', $size);

        wp_send_json_success(array(
            'image_id' => $image_id,
            'size' => $size
        ));
    }

    /**
     * Legacy method: Get masonry size
     */
    public function get_masonry_size() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id = absint($_POST['image_id']);

        if (!$image_id) {
            wp_die('Invalid image ID');
        }

        $size = get_post_meta($image_id, 'clearph_masonry_sizing', true) ?: 'regular';

        wp_send_json_success(array(
            'image_id' => $image_id,
            'size' => $size
        ));
    }

    /**
     * New method: Update grid sizing using numeric column/row spans
     * Supports fractional column widths via micro-column system
     */
    public function update_grid_sizing() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id = absint($_POST['image_id']);
        $column_span = isset($_POST['column_span']) ? absint($_POST['column_span']) : 0;
        $row_span = isset($_POST['row_span']) ? absint($_POST['row_span']) : 0;

        // Validate parameters
        if (!$image_id) {
            wp_send_json_error('Invalid image ID');
        }

        // Column span: 1-12 micro-columns (supports up to 6 visual columns)
        if ($column_span < 1 || $column_span > 12) {
            wp_send_json_error('Column span must be between 1 and 12');
        }

        // Row span: 1-12 rows
        if ($row_span < 1 || $row_span > 12) {
            wp_send_json_error('Row span must be between 1 and 12');
        }

        // Store grid sizing data as array
        $grid_sizing = array(
            'column_span' => $column_span,
            'row_span' => $row_span
        );

        update_post_meta($image_id, 'clearph_grid_sizing', $grid_sizing);

        wp_send_json_success(array(
            'image_id' => $image_id,
            'column_span' => $column_span,
            'row_span' => $row_span
        ));
    }

    /**
     * New method: Get grid sizing
     * Returns numeric column/row spans, or converts legacy named size if needed
     */
    public function get_grid_sizing() {
        check_ajax_referer('clearph_gallery_nonce', 'nonce');

        $image_id = absint($_POST['image_id']);

        if (!$image_id) {
            wp_send_json_error('Invalid image ID');
        }

        // First check for new grid sizing format
        $grid_sizing = get_post_meta($image_id, 'clearph_grid_sizing', true);

        if ($grid_sizing && isset($grid_sizing['column_span']) && isset($grid_sizing['row_span'])) {
            wp_send_json_success(array(
                'image_id' => $image_id,
                'column_span' => $grid_sizing['column_span'],
                'row_span' => $grid_sizing['row_span'],
                'format' => 'grid'
            ));
        }

        // Fallback: check for legacy named size and convert
        $legacy_size = get_post_meta($image_id, 'clearph_masonry_sizing', true) ?: 'regular';
        $converted = $this->convert_legacy_size_to_grid($legacy_size);

        wp_send_json_success(array(
            'image_id' => $image_id,
            'column_span' => $converted['column_span'],
            'row_span' => $converted['row_span'],
            'legacy_size' => $legacy_size,
            'format' => 'legacy'
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
}
