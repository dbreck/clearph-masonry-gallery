<?php

class ClearPH_Media_Handler {

    public function __construct() {
        add_action('wp_ajax_clearph_update_masonry_size', array($this, 'update_masonry_size'));
        add_action('wp_ajax_clearph_get_masonry_size', array($this, 'get_masonry_size'));
        add_action('wp_ajax_clearph_update_grid_sizing', array($this, 'update_grid_sizing'));
        add_action('wp_ajax_clearph_get_grid_sizing', array($this, 'get_grid_sizing'));
        add_action('wp_ajax_clearph_get_image_categories', array($this, 'get_image_categories'));
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
}
