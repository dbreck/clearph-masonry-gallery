<?php

class ClearPH_Gallery_Post_Type
{

    public function __construct()
    {
        add_action('init', array($this, 'register_post_type'));
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post', array($this, 'save_gallery_meta'));
    }

    public function register_post_type()
    {
        $args = array(
            'labels' => array(
                'name' => 'Masonry Galleries',
                'singular_name' => 'Gallery',
                'add_new' => 'Add New Gallery',
                'add_new_item' => 'Add New Gallery',
                'edit_item' => 'Edit Gallery',
                'new_item' => 'New Gallery',
                'view_item' => 'View Gallery',
                'search_items' => 'Search Galleries',
                'not_found' => 'No galleries found',
                'not_found_in_trash' => 'No galleries found in trash',
                'menu_name' => 'Masonry Galleries'
            ),
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => true,
            'capability_type' => 'post',
            'hierarchical' => false,
            'supports' => array('title'),
            'menu_icon' => 'dashicons-format-gallery',
            'menu_position' => 26
        );

        register_post_type('clearph_gallery', $args);
    }

    public function add_meta_boxes()
    {
        add_meta_box(
            'gallery-shortcode',
            'Shortcode',
            array($this, 'gallery_shortcode_meta_box'),
            'clearph_gallery',
            'side',
            'high'
        );

        add_meta_box(
            'gallery-settings',
            'Gallery Settings',
            array($this, 'gallery_settings_meta_box'),
            'clearph_gallery',
            'normal',
            'high'
        );

        add_meta_box(
            'gallery-images',
            'Gallery Images',
            array($this, 'gallery_images_meta_box'),
            'clearph_gallery',
            'normal',
            'high'
        );
    }

    public function gallery_shortcode_meta_box($post)
    {
        if ($post->post_status === 'publish') {
?>
            <div class="shortcode-display">
                <p><strong>By ID:</strong></p>
                <div class="shortcode-copy-wrapper">
                    <input type="text" readonly value='[clearph_gallery id="<?php echo $post->ID; ?>"]' class="shortcode-input">
                    <button type="button" class="button copy-shortcode">Copy</button>
                </div>

                <p><strong>By Title:</strong></p>
                <div class="shortcode-copy-wrapper">
                    <input type="text" readonly value='[clearph_gallery title="<?php echo esc_attr($post->post_title); ?>"]' class="shortcode-input">
                    <button type="button" class="button copy-shortcode">Copy</button>
                </div>
            </div>
            <style>
                .shortcode-copy-wrapper {
                    display: flex;
                    gap: 5px;
                    margin-bottom: 15px;
                }

                .shortcode-input {
                    flex: 1;
                    font-family: monospace;
                    font-size: 12px;
                }

                .copy-shortcode {
                    white-space: nowrap;
                }
            </style>
        <?php
        } else {
            echo '<p>Shortcodes will be available after publishing this gallery.</p>';
        }
    }

    public function gallery_settings_meta_box($post)
    {
        wp_nonce_field('clearph_gallery_meta', 'clearph_gallery_nonce');

        $settings = get_post_meta($post->ID, '_clearph_gallery_settings', true);
        $defaults = array(
            'masonry_enabled' => true,
            'columns' => 4,
            'lightbox_enabled' => true,
            'image_size' => 'large',
            'object_fit' => 'cover',
            'border_radius' => 8,
            'column_margin' => '20px',
            'filter_enabled' => false,
            'filter_categories' => 'Residences, Amenities, Lifestyle, Local'
        );
        $settings = wp_parse_args($settings, $defaults);
        ?>
        <table class="form-table">
            <tr>
                <th><label for="masonry_enabled">Enable Masonry</label></th>
                <td>
                    <input type="checkbox" id="masonry_enabled" name="masonry_enabled" value="1" <?php checked($settings['masonry_enabled']); ?>>
                    <p class="description">When disabled, images display in equal-height rows</p>
                </td>
            </tr>
            <tr>
                <th><label for="columns">Columns</label></th>
                <td>
                    <select id="columns" name="columns">
                        <?php for ($i = 2; $i <= 6; $i++): ?>
                            <option value="<?php echo $i; ?>" <?php selected($settings['columns'], $i); ?>><?php echo $i; ?></option>
                        <?php endfor; ?>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="column_margin">Column Margin</label></th>
                <td>
                    <input type="text" id="column_margin" name="column_margin" value="<?php echo esc_attr($settings['column_margin']); ?>" placeholder="20px">
                    <p class="description">Gap between columns (e.g. 20px, 5vw, 2em)</p>
                </td>
            </tr>
            <tr>
                <th><label for="lightbox_enabled">Enable Lightbox</label></th>
                <td>
                    <input type="checkbox" id="lightbox_enabled" name="lightbox_enabled" value="1" <?php checked($settings['lightbox_enabled']); ?>>
                    <p class="description">Uses FancyBox 3 from Salient theme settings</p>
                </td>
            </tr>
            <tr>
                <th><label for="image_size">Image Size</label></th>
                <td>
                    <select id="image_size" name="image_size">
                        <?php
                        $sizes = get_intermediate_image_sizes();
                        $sizes[] = 'full';
                        foreach ($sizes as $size):
                        ?>
                            <option value="<?php echo $size; ?>" <?php selected($settings['image_size'], $size); ?>><?php echo $size; ?></option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="object_fit">Image Fit</label></th>
                <td>
                    <select id="object_fit" name="object_fit">
                        <option value="cover" <?php selected($settings['object_fit'], 'cover'); ?>>Cover (crop to fit)</option>
                        <option value="contain" <?php selected($settings['object_fit'], 'contain'); ?>>Contain (fit within)</option>
                        <option value="fill" <?php selected($settings['object_fit'], 'fill'); ?>>Fill (stretch)</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="border_radius">Border Radius</label></th>
                <td>
                    <input type="number" id="border_radius" name="border_radius" value="<?php echo esc_attr($settings['border_radius']); ?>" min="0" max="50" step="1">
                    <span>px</span>
                    <p class="description">Rounded corners for gallery items</p>
                </td>
            </tr>
            <tr>
                <th><label for="filter_enabled">Enable Filtering</label></th>
                <td>
                    <input type="checkbox" id="filter_enabled" name="filter_enabled" value="1" <?php checked($settings['filter_enabled']); ?>>
                    <p class="description">Show category filter menu above gallery</p>
                </td>
            </tr>
            <tr>
                <th><label for="filter_categories">Filter Categories</label></th>
                <td>
                    <input type="text" id="filter_categories" name="filter_categories" value="<?php echo esc_attr($settings['filter_categories']); ?>" style="width: 100%; max-width: 500px;">
                    <p class="description">Comma-separated list of categories (e.g., "Residences, Amenities, Lifestyle, Local")</p>
                </td>
            </tr>
        </table>

        <?php if (defined('WP_DEBUG') && WP_DEBUG): ?>
            <div style="background: #f1f1f1; padding: 10px; margin-top: 20px;">
                <strong>DEBUG INFO:</strong><br>
                Current settings: <?php echo esc_html(print_r($settings, true)); ?>
            </div>
        <?php endif; ?>

    <?php
    }

    public function gallery_images_meta_box($post)
    {
        $images = get_post_meta($post->ID, '_clearph_gallery_images', true);
        $settings = get_post_meta($post->ID, '_clearph_gallery_settings', true);

        if (!$images) $images = array();

        $defaults = array(
            'masonry_enabled' => true,
            'columns' => 4
        );
        $settings = wp_parse_args($settings, $defaults);

        // Build gallery classes for initial preview
        $gallery_classes = 'sortable-gallery columns-' . $settings['columns'];
        if ($settings['masonry_enabled']) {
            $gallery_classes .= ' masonry-enabled';
        }
    ?>
        <div id="gallery-builder">
            <div class="gallery-actions">
                <button type="button" class="button" id="add-images">Add Images</button>
                <button type="button" class="button" id="clear-gallery">Clear All</button>

                <div class="gallery-ordering-controls">
                    <div class="button-group">
                        <button type="button" class="button ordering-btn" id="reverse-order" title="Reverse current order">Reverse Order</button>
                        <button type="button" class="button ordering-btn" id="randomize-order" title="Randomize image order">Randomize</button>
                        <button type="button" class="button ordering-btn" id="sort-filename-asc" data-direction="asc" title="Sort by filename A-Z">Sort A-Z</button>
                        <button type="button" class="button ordering-btn" id="sort-filename-desc" data-direction="desc" title="Sort by filename Z-A">Sort Z-A</button>
                        <button type="button" class="button" id="undo-order" title="Undo last ordering change" disabled>Undo</button>
                    </div>
                </div>

                <div class="gallery-view-toggle">
                    <span class="label">View:</span>
                    <div class="button-group">
                        <button type="button" class="button view-toggle active" data-view="grid">Grid</button>
                        <button type="button" class="button view-toggle" data-view="list">List</button>
                    </div>
                    <div class="grouping-controls" style="display:none">
                        <label for="gallery-grouping" class="label">Group by:</label>
                        <select id="gallery-grouping">
                            <option value="first-word" selected>First Word</option>
                            <option value="none">None</option>
                        </select>
                        <button type="button" class="button" id="collapse-all-groups">Collapse All</button>
                        <button type="button" class="button" id="expand-all-groups">Expand All</button>
                    </div>
                </div>
            </div>
            <div id="gallery-preview" class="<?php echo esc_attr($gallery_classes); ?>">
                <?php if (!empty($images)): ?>
                    <?php foreach ($images as $image_id): ?>
                        <?php $this->render_image_item($image_id); ?>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
            <div id="gallery-list-view" style="display:none">
                <div class="list-legend">
                    <span class="drag-hint">Drag groups or individual filenames to reorder. Changes are saved when you update the post.</span>
                </div>
                <div class="group-list" id="gallery-group-list">
                    <!-- Populated by JS -->
                </div>
            </div>
            <input type="hidden" id="gallery_images" name="gallery_images" value="<?php echo esc_attr(implode(',', $images)); ?>">
            <input type="hidden" id="image_categories" name="image_categories" value="">
        </div>
    <?php
    }

    private function render_image_item($image_id)
    {
        $image = wp_get_attachment_image_src($image_id, 'medium');
        $masonry_size = get_post_meta($image_id, 'clearph_masonry_sizing', true) ?: 'regular';

        if (!$image) return;

        // Get attachment data for filename
        $attachment = get_post($image_id);
        $filename = $attachment ? basename(get_attached_file($image_id)) : 'Unknown filename';

        // Calculate aspect ratio for proper display
        $width = $image[1];
        $height = $image[2];
    ?>
        <div class="gallery-item size-<?php echo esc_attr($masonry_size); ?>" data-id="<?php echo $image_id; ?>">
            <div class="image-container">
                <img src="<?php echo $image[0]; ?>" alt="">
            </div>
            <button type="button" class="remove-item">×</button>
            <div class="item-controls">
                <div class="masonry-controls">
                    <button type="button" class="size-btn <?php echo $masonry_size === 'regular' ? 'active' : ''; ?>" data-size="regular">R</button>
                    <button type="button" class="size-btn <?php echo $masonry_size === 'tall' ? 'active' : ''; ?>" data-size="tall">T</button>
                    <button type="button" class="size-btn <?php echo $masonry_size === 'wide' ? 'active' : ''; ?>" data-size="wide">W</button>
                    <button type="button" class="size-btn <?php echo $masonry_size === 'large' ? 'active' : ''; ?>" data-size="large">L</button>
                    <button type="button" class="size-btn <?php echo $masonry_size === 'xl' ? 'active' : ''; ?>" data-size="xl">XL</button>
                </div>
                <div class="grid-sizing-controls" style="margin-top: 8px;">
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: center;">
                        <label style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                            <span style="font-size: 9px; color: #fff; opacity: 0.8;">Width</span>
                            <input type="number" class="grid-column-input" min="1" max="12" value="2"
                                   style="width: 40px; height: 24px; text-align: center; font-size: 11px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;" />
                        </label>
                        <label style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                            <span style="font-size: 9px; color: #fff; opacity: 0.8;">Height</span>
                            <input type="number" class="grid-row-input" min="1" max="12" value="2"
                                   style="width: 40px; height: 24px; text-align: center; font-size: 11px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;" />
                        </label>
                        <button type="button" class="grid-apply-btn"
                                style="height: 24px; padding: 0 8px; font-size: 10px; background: #0073aa; color: #fff; border: 1px solid #fff; border-radius: 2px; cursor: pointer;">
                            Apply
                        </button>
                    </div>
                    <div style="font-size: 8px; color: #fff; opacity: 0.7; margin-top: 4px; text-align: center;">
                        Micro-columns (1 col = 2, 1.5 col = 3)
                    </div>
                </div>
                <div class="category-controls" style="margin-top: 8px;">
                    <select class="image-category-select" style="width: 90%; padding: 4px; font-size: 10px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;">
                        <option value="">No Category</option>
                    </select>
                </div>
                <div class="image-filename"><?php echo esc_html($filename); ?></div>
            </div>
        </div>
<?php
    }

    public function save_gallery_meta($post_id)
    {
        if (!isset($_POST['clearph_gallery_nonce']) || !wp_verify_nonce($_POST['clearph_gallery_nonce'], 'clearph_gallery_meta')) {
            return;
        }

        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        // Save settings
        $settings = array(
            'masonry_enabled' => isset($_POST['masonry_enabled']) ? 1 : 0,
            'columns' => absint($_POST['columns']),
            'lightbox_enabled' => isset($_POST['lightbox_enabled']) ? 1 : 0,
            'image_size' => sanitize_text_field($_POST['image_size']),
            'object_fit' => sanitize_text_field($_POST['object_fit']),
            'border_radius' => absint($_POST['border_radius']),
            'column_margin' => sanitize_text_field($_POST['column_margin']),
            'filter_enabled' => isset($_POST['filter_enabled']) ? 1 : 0,
            'filter_categories' => sanitize_text_field($_POST['filter_categories'])
        );

        update_post_meta($post_id, '_clearph_gallery_settings', $settings);

        // Save image categories (per-gallery category assignments)
        if (isset($_POST['image_categories'])) {
            $image_categories = array();
            parse_str($_POST['image_categories'], $image_categories);
            // Sanitize each category value
            foreach ($image_categories as $image_id => $category) {
                $image_categories[$image_id] = sanitize_text_field($category);
            }
            update_post_meta($post_id, '_clearph_image_categories', $image_categories);
        }

        // Save images
        if (isset($_POST['gallery_images'])) {
            $images = array_filter(array_map('absint', explode(',', $_POST['gallery_images'])));
            update_post_meta($post_id, '_clearph_gallery_images', $images);
        }

        // Debug log
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('Gallery ' . $post_id . ' settings saved: ' . print_r($settings, true));
        }
    }
}
