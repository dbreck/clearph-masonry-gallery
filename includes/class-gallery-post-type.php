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
            'object_position' => 'center center',
            'border_radius' => 8,
            'column_margin' => '20px',
            'filter_enabled' => false,
            'filter_categories' => 'Residences, Amenities, Lifestyle, Local',
            'filter_all_last' => false,
            'label_show' => false,
            'label_show_on_hover' => false,
            'label_placement' => 'bottom-center',
            'label_tag' => 'p',
            'label_extra_classes' => '',
            'label_color' => '#ffffff',
            'label_shadow' => false
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
                <th><label for="object_position">Image Position</label></th>
                <td>
                    <select id="object_position" name="object_position">
                        <?php
                        $position_options = array(
                            'center center' => 'Center Center',
                            'center top'    => 'Center Top',
                            'center bottom' => 'Center Bottom',
                            'left top'      => 'Left Top',
                            'left center'   => 'Left Center',
                            'left bottom'   => 'Left Bottom',
                            'right top'     => 'Right Top',
                            'right center'  => 'Right Center',
                            'right bottom'  => 'Right Bottom',
                        );
                        foreach ($position_options as $value => $label) :
                        ?>
                            <option value="<?php echo esc_attr($value); ?>" <?php selected($settings['object_position'], $value); ?>><?php echo esc_html($label); ?></option>
                        <?php endforeach; ?>
                    </select>
                    <p class="description">Controls which part of cropped images stays visible (applies when Image Fit is Cover)</p>
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
            <tr>
                <th><label for="filter_all_last">All Link Position</label></th>
                <td>
                    <input type="checkbox" id="filter_all_last" name="filter_all_last" value="1" <?php checked($settings['filter_all_last']); ?>>
                    <label for="filter_all_last">Place "All" link at end of filter list</label>
                </td>
            </tr>
        </table>

        <h3 style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">Image Labels</h3>
        <table class="form-table">
            <tr>
                <th>Label Visibility</th>
                <td>
                    <label style="display: block; margin-bottom: 6px;">
                        <input type="checkbox" id="label_show" name="label_show" value="1" <?php checked($settings['label_show']); ?>>
                        Show labels
                    </label>
                    <label style="display: block;">
                        <input type="checkbox" id="label_show_on_hover" name="label_show_on_hover" value="1" <?php checked($settings['label_show_on_hover']); ?>>
                        Show labels on hover only
                    </label>
                    <p class="description">Check one or both. If neither is checked, labels are hidden.</p>
                </td>
            </tr>
            <tr class="clearph-label-options">
                <th><label for="label_placement">Label Placement</label></th>
                <td>
                    <select id="label_placement" name="label_placement">
                        <?php
                        $placements = array(
                            'bottom-center' => 'Bottom Center',
                            'bottom-left'   => 'Bottom Left',
                            'bottom-right'  => 'Bottom Right',
                            'middle-left'   => 'Middle Left',
                            'middle-center' => 'Middle Center',
                            'middle-right'  => 'Middle Right',
                            'top-left'      => 'Top Left',
                            'top-center'    => 'Top Center',
                            'top-right'     => 'Top Right',
                        );
                        foreach ($placements as $value => $label) :
                        ?>
                            <option value="<?php echo esc_attr($value); ?>" <?php selected($settings['label_placement'], $value); ?>><?php echo esc_html($label); ?></option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
            <tr class="clearph-label-options">
                <th><label for="label_tag">Label Tag</label></th>
                <td>
                    <select id="label_tag" name="label_tag">
                        <?php
                        $tags = array('h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div');
                        foreach ($tags as $tag) :
                        ?>
                            <option value="<?php echo esc_attr($tag); ?>" <?php selected($settings['label_tag'], $tag); ?>><?php echo esc_html(strtoupper($tag)); ?></option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
            <tr class="clearph-label-options">
                <th><label for="label_extra_classes">Extra CSS Classes</label></th>
                <td>
                    <input type="text" id="label_extra_classes" name="label_extra_classes" value="<?php echo esc_attr($settings['label_extra_classes']); ?>" style="width: 100%; max-width: 400px;" placeholder="e.g. eyebrow caption-overlay">
                </td>
            </tr>
            <tr class="clearph-label-options">
                <th><label for="label_color">Font Color</label></th>
                <td>
                    <input type="text" id="label_color" name="label_color" value="<?php echo esc_attr($settings['label_color']); ?>" class="clearph-color-field" placeholder="#ffffff" style="width: 100px;">
                </td>
            </tr>
            <tr class="clearph-label-options">
                <th>Text Shadow</th>
                <td>
                    <label>
                        <input type="checkbox" id="label_shadow" name="label_shadow" value="1" <?php checked($settings['label_shadow']); ?>>
                        Enable subtle text shadow for readability over light backgrounds
                    </label>
                </td>
            </tr>
        </table>

        <script>
        jQuery(function($){
            function toggleLabelOptions() {
                var show = $('#label_show').is(':checked') || $('#label_show_on_hover').is(':checked');
                $('.clearph-label-options').toggle(show);
            }
            $('#label_show, #label_show_on_hover').on('change', toggleLabelOptions);
            toggleLabelOptions();
        });
        </script>

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
        $youtube_items = get_post_meta($post->ID, '_clearph_youtube_items', true);
        $youtube_sizing = get_post_meta($post->ID, '_clearph_youtube_sizing', true);
        $image_labels = get_post_meta($post->ID, '_clearph_image_labels', true);
        $image_sizing = get_post_meta($post->ID, '_clearph_image_sizing', true);

        if (!$images) $images = array();
        if (!$youtube_items || !is_array($youtube_items)) $youtube_items = array();
        if (!$youtube_sizing || !is_array($youtube_sizing)) $youtube_sizing = array();
        if (!$image_labels || !is_array($image_labels)) $image_labels = array();
        if (!$image_sizing || !is_array($image_sizing)) $image_sizing = array();

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
                <button type="button" class="button" id="add-youtube">Add YouTube Video</button>
                <button type="button" class="button button-primary" id="order-visually">Order Visually</button>
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
                    <?php foreach ($images as $item_id): ?>
                        <?php
                        if (is_string($item_id) && strpos($item_id, 'yt_') === 0) {
                            $this->render_youtube_item($item_id, $youtube_items, $youtube_sizing);
                        } else {
                            $this->render_image_item($item_id, $image_sizing);
                        }
                        ?>
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
            <input type="hidden" id="youtube_items" name="youtube_items" value="<?php echo esc_attr(wp_json_encode($youtube_items ?: new stdClass())); ?>">
            <input type="hidden" id="youtube_sizing" name="youtube_sizing" value="<?php echo esc_attr(wp_json_encode($youtube_sizing ?: new stdClass())); ?>">
            <input type="hidden" id="image_labels" name="image_labels" value="<?php echo esc_attr(wp_json_encode($image_labels ?: new stdClass())); ?>">
            <input type="hidden" id="image_sizing" name="image_sizing" value="<?php echo esc_attr(wp_json_encode($image_sizing ?: new stdClass())); ?>">
        </div>

        <div id="clearph-order-modal" class="clearph-order-modal" style="display:none" aria-hidden="true" data-mode="order">
            <div class="clearph-order-modal__backdrop"></div>
            <div class="clearph-order-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="clearph-order-modal-title">
                <div class="clearph-order-modal__header">
                    <h2 id="clearph-order-modal-title">Gallery Editor</h2>
                    <div class="clearph-order-modal__mode-switch" role="tablist">
                        <button type="button" class="clearph-mode-btn is-active" data-mode="order" role="tab" aria-selected="true">Order</button>
                        <button type="button" class="clearph-mode-btn" data-mode="layout" role="tab" aria-selected="false">Layout</button>
                    </div>
                    <div class="clearph-order-modal__header-tools">
                        <div class="clearph-layout-bulk-actions" data-tool-layout-only style="display:none">
                            <button type="button" class="button" id="clearph-randomize-layout" title="Apply random varied layout to all items">Randomize Layout</button>
                            <button type="button" class="button" id="clearph-smart-layout" title="Size items based on image proportions">Smart Layout</button>
                        </div>
                        <label class="clearph-order-modal__size-control" data-tool-layout-only style="display:none">
                            Container width
                            <input type="range" id="clearph-layout-width" min="30" max="100" step="5" value="85">
                            <span id="clearph-layout-width-value">85%</span>
                        </label>
                        <label class="clearph-order-modal__size-control">
                            Thumbnail size
                            <input type="range" id="clearph-order-modal-size" min="60" max="220" step="10" value="110">
                        </label>
                        <button type="button" class="button button-primary" id="clearph-order-modal-save">Save &amp; Close</button>
                        <button type="button" class="button" id="clearph-order-modal-cancel">Cancel</button>
                    </div>
                </div>
                <div class="clearph-order-modal__hint" data-hint-order>Drag tiles to reorder. Left to right, top to bottom is the final order. Changes are not saved until you click Save &amp; Close.</div>
                <div class="clearph-order-modal__hint" data-hint-layout style="display:none">Click a tile to edit its size and settings in the right panel. Changes save automatically.</div>

                <div class="clearph-order-modal__body clearph-order-modal__body--order">
                    <div id="clearph-order-modal-grid" class="clearph-order-modal__grid"></div>
                </div>

                <div class="clearph-order-modal__body clearph-order-modal__body--layout" style="display:none">
                    <div class="clearph-order-modal__layout-scroll">
                        <div id="clearph-layout-grid" class="clearph-order-modal__layout-grid"></div>
                    </div>
                    <aside id="clearph-layout-panel" class="clearph-order-modal__panel">
                        <div class="clearph-layout-panel__empty">Select a tile to edit its settings.</div>
                        <div class="clearph-layout-panel__content" style="display:none">
                            <div class="clearph-layout-panel__preview"></div>
                            <div class="clearph-layout-panel__filename"></div>

                            <div class="clearph-layout-panel__section">
                                <label class="clearph-layout-panel__label">Preset Size</label>
                                <div class="clearph-layout-panel__presets">
                                    <button type="button" class="layout-size-btn" data-size="regular">R</button>
                                    <button type="button" class="layout-size-btn" data-size="tall">T</button>
                                    <button type="button" class="layout-size-btn" data-size="wide">W</button>
                                    <button type="button" class="layout-size-btn" data-size="large">L</button>
                                    <button type="button" class="layout-size-btn" data-size="xl">XL</button>
                                </div>
                            </div>

                            <div class="clearph-layout-panel__section">
                                <label class="clearph-layout-panel__label">Custom Size (micro-columns)</label>
                                <div class="clearph-layout-panel__wh">
                                    <label>
                                        Width
                                        <input type="number" class="layout-grid-column-input" min="1" max="12" value="2">
                                    </label>
                                    <label>
                                        Height
                                        <input type="number" class="layout-grid-row-input" min="1" max="12" value="2">
                                    </label>
                                    <button type="button" class="button button-primary layout-grid-apply-btn">Apply</button>
                                </div>
                                <div class="clearph-layout-panel__hint-small">1 visual col = 2, 1.5 col = 3</div>
                            </div>

                            <div class="clearph-layout-panel__section">
                                <label class="clearph-layout-panel__label">Image Position</label>
                                <select class="layout-position-select">
                                    <option value="">Inherit</option>
                                    <option value="center center">Center Center</option>
                                    <option value="center top">Center Top</option>
                                    <option value="center bottom">Center Bottom</option>
                                    <option value="left top">Left Top</option>
                                    <option value="left center">Left Center</option>
                                    <option value="left bottom">Left Bottom</option>
                                    <option value="right top">Right Top</option>
                                    <option value="right center">Right Center</option>
                                    <option value="right bottom">Right Bottom</option>
                                </select>
                            </div>

                            <div class="clearph-layout-panel__section">
                                <label class="clearph-layout-panel__label">Label</label>
                                <input type="text" class="layout-label-text" placeholder="Enter image label...">
                            </div>

                            <div class="clearph-layout-panel__section">
                                <label class="clearph-layout-panel__label">Label Color Override</label>
                                <input type="text" class="layout-label-color" placeholder="Inherit from gallery" style="width: 100px;">
                                <span class="clearph-layout-panel__hint-small">Leave blank to use gallery default</span>
                            </div>

                            <div class="clearph-layout-panel__section">
                                <label class="clearph-layout-panel__label">Label Text Shadow</label>
                                <select class="layout-label-shadow">
                                    <option value="">Inherit from gallery</option>
                                    <option value="1">On</option>
                                    <option value="0">Off</option>
                                </select>
                            </div>

                            <div class="clearph-layout-panel__section clearph-layout-panel__section--category">
                                <label class="clearph-layout-panel__label">Category</label>
                                <select class="layout-category-select">
                                    <option value="">No Category</option>
                                </select>
                            </div>

                            <div class="clearph-layout-panel__section clearph-layout-panel__section--video" style="display:none">
                                <label class="clearph-layout-panel__label">Video Settings</label>
                                <label class="clearph-layout-panel__sub-label">Autoplay
                                    <select class="layout-video-autoplay-select">
                                        <option value="hover">On Hover</option>
                                        <option value="always">Always</option>
                                    </select>
                                </label>
                                <label class="clearph-layout-panel__sub-label">Play Badge
                                    <select class="layout-video-badge-select">
                                        <option value="yes">Show</option>
                                        <option value="no">Hide</option>
                                    </select>
                                </label>
                            </div>

                            <div class="clearph-layout-panel__section clearph-layout-panel__section--youtube" style="display:none">
                                <label class="clearph-layout-panel__label">YouTube URL</label>
                                <input type="text" class="layout-youtube-url-input" placeholder="https://youtube.com/...">
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    <?php
    }

    private function render_youtube_item($yt_id, $youtube_items, $youtube_sizing)
    {
        $video_id = substr($yt_id, 3); // Strip 'yt_' prefix
        $meta = isset($youtube_items[$yt_id]) ? $youtube_items[$yt_id] : array();
        $sizing = isset($youtube_sizing[$yt_id]) ? $youtube_sizing[$yt_id] : array();

        $url = isset($meta['url']) ? $meta['url'] : '';
        $is_short = isset($meta['is_short']) ? $meta['is_short'] : false;

        $masonry_size = isset($sizing['masonry_size']) ? $sizing['masonry_size'] : ($is_short ? 'tall' : 'regular');
        $column_span = isset($sizing['column_span']) ? $sizing['column_span'] : '';
        $row_span = isset($sizing['row_span']) ? $sizing['row_span'] : '';

        $thumb_url = 'https://img.youtube.com/vi/' . esc_attr($video_id) . '/hqdefault.jpg';
    ?>
        <div class="gallery-item size-<?php echo esc_attr($masonry_size); ?>" data-id="<?php echo esc_attr($yt_id); ?>" data-type="youtube"<?php
            if ($column_span && $row_span) {
                echo ' style="grid-column: span ' . absint($column_span) . '; grid-row: span ' . absint($row_span) . ';"';
            }
        ?>>
            <div class="image-container">
                <img src="<?php echo esc_url($thumb_url); ?>" alt="YouTube video">
                <span class="youtube-badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M10 8.64L15.27 12 10 15.36V8.64M8 5v14l11-7L8 5z"/></svg>
                </span>
            </div>
            <button type="button" class="remove-item">&times;</button>
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
                            <input type="number" class="grid-column-input" min="1" max="12" value="<?php echo $column_span ? absint($column_span) : 2; ?>"
                                   style="width: 40px; height: 24px; text-align: center; font-size: 11px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;" />
                        </label>
                        <label style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                            <span style="font-size: 9px; color: #fff; opacity: 0.8;">Height</span>
                            <input type="number" class="grid-row-input" min="1" max="12" value="<?php echo $row_span ? absint($row_span) : 2; ?>"
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
                <div class="object-position-controls" style="margin-top: 8px; text-align: center;">
                    <label style="display: inline-flex; flex-direction: column; align-items: center; gap: 2px;">
                        <span style="font-size: 9px; color: #fff; opacity: 0.8;">Image Position</span>
                        <select class="image-position-select" style="width: 140px; padding: 4px; font-size: 10px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;">
                            <option value="">Inherit</option>
                            <option value="center center">Center Center</option>
                            <option value="center top">Center Top</option>
                            <option value="center bottom">Center Bottom</option>
                            <option value="left top">Left Top</option>
                            <option value="left center">Left Center</option>
                            <option value="left bottom">Left Bottom</option>
                            <option value="right top">Right Top</option>
                            <option value="right center">Right Center</option>
                            <option value="right bottom">Right Bottom</option>
                        </select>
                    </label>
                </div>
                <div class="youtube-url-controls" style="margin-top: 8px;">
                    <input type="text" class="youtube-url-input" value="<?php echo esc_attr($url); ?>" placeholder="YouTube URL"
                           style="width: 90%; padding: 4px; font-size: 10px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;" />
                </div>
                <div class="category-controls" style="margin-top: 8px;">
                    <select class="image-category-select" style="width: 90%; padding: 4px; font-size: 10px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;">
                        <option value="">No Category</option>
                    </select>
                </div>
                <div class="image-filename">YouTube: <?php echo esc_html($video_id); ?></div>
            </div>
        </div>
    <?php
    }

    private function render_image_item($image_id, $image_sizing = array())
    {
        $attachment = get_post($image_id);
        if (!$attachment) return;

        $mime_type = get_post_mime_type($image_id);
        $is_video = strpos($mime_type, 'video/') === 0;

        // Read sizing from gallery-scoped data, fall back to legacy attachment meta
        $sizing = isset($image_sizing[strval($image_id)]) ? $image_sizing[strval($image_id)] : null;
        $col_span = 2;
        $row_span = 2;
        $has_grid_sizing = false;
        if ($sizing && isset($sizing['column_span']) && isset($sizing['row_span'])) {
            $col_span = absint($sizing['column_span']);
            $row_span = absint($sizing['row_span']);
            $masonry_size = $this->convert_grid_to_legacy_size($col_span, $row_span);
            $has_grid_sizing = true;
        } else {
            // Legacy fallback: check attachment meta
            $grid_sizing = get_post_meta($image_id, 'clearph_grid_sizing', true);
            if ($grid_sizing && isset($grid_sizing['column_span']) && isset($grid_sizing['row_span'])) {
                $col_span = absint($grid_sizing['column_span']);
                $row_span = absint($grid_sizing['row_span']);
                $masonry_size = $this->convert_grid_to_legacy_size($col_span, $row_span);
                $has_grid_sizing = true;
            } else {
                $masonry_size = get_post_meta($image_id, 'clearph_masonry_sizing', true) ?: 'regular';
                $converted = $this->convert_legacy_name_to_grid($masonry_size);
                $col_span = $converted['column_span'];
                $row_span = $converted['row_span'];
            }
        }
        $filename = basename(get_attached_file($image_id));

        if ($is_video) {
            $video_url = wp_get_attachment_url($image_id);
            if (!$video_url) return;
    ?>
        <div class="gallery-item size-<?php echo esc_attr($masonry_size); ?>" data-id="<?php echo $image_id; ?>" data-type="video"<?php if ($has_grid_sizing) echo ' style="grid-column: span ' . $col_span . '; grid-row: span ' . $row_span . ';"'; ?>>
            <div class="image-container">
                <video src="<?php echo esc_url($video_url); ?>" muted preload="metadata"></video>
                <span class="video-badge">&#9654;</span>
            </div>
            <button type="button" class="remove-item">&times;</button>
            <div class="item-controls">
                <div class="masonry-controls">
                    <button type="button" class="size-btn <?php echo !$has_grid_sizing && $masonry_size === 'regular' ? 'active' : ''; ?>" data-size="regular">R</button>
                    <button type="button" class="size-btn <?php echo !$has_grid_sizing && $masonry_size === 'tall' ? 'active' : ''; ?>" data-size="tall">T</button>
                    <button type="button" class="size-btn <?php echo !$has_grid_sizing && $masonry_size === 'wide' ? 'active' : ''; ?>" data-size="wide">W</button>
                    <button type="button" class="size-btn <?php echo !$has_grid_sizing && $masonry_size === 'large' ? 'active' : ''; ?>" data-size="large">L</button>
                    <button type="button" class="size-btn <?php echo !$has_grid_sizing && $masonry_size === 'xl' ? 'active' : ''; ?>" data-size="xl">XL</button>
                </div>
                <div class="grid-sizing-controls" style="margin-top: 8px;">
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: center;">
                        <label style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                            <span style="font-size: 9px; color: #fff; opacity: 0.8;">Width</span>
                            <input type="number" class="grid-column-input" min="1" max="12" value="<?php echo esc_attr($col_span); ?>"
                                   style="width: 40px; height: 24px; text-align: center; font-size: 11px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;" />
                        </label>
                        <label style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                            <span style="font-size: 9px; color: #fff; opacity: 0.8;">Height</span>
                            <input type="number" class="grid-row-input" min="1" max="12" value="<?php echo esc_attr($row_span); ?>"
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
                <div class="object-position-controls" style="margin-top: 8px; text-align: center;">
                    <label style="display: inline-flex; flex-direction: column; align-items: center; gap: 2px;">
                        <span style="font-size: 9px; color: #fff; opacity: 0.8;">Image Position</span>
                        <select class="image-position-select" style="width: 140px; padding: 4px; font-size: 10px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;">
                            <option value="">Inherit</option>
                            <option value="center center">Center Center</option>
                            <option value="center top">Center Top</option>
                            <option value="center bottom">Center Bottom</option>
                            <option value="left top">Left Top</option>
                            <option value="left center">Left Center</option>
                            <option value="left bottom">Left Bottom</option>
                            <option value="right top">Right Top</option>
                            <option value="right center">Right Center</option>
                            <option value="right bottom">Right Bottom</option>
                        </select>
                    </label>
                </div>
                <div class="video-settings-controls">
                    <span class="video-settings-label">Video Settings</span>
                    <label>
                        Autoplay:
                        <select class="video-autoplay-select">
                            <option value="hover">On Hover</option>
                            <option value="always">Always</option>
                        </select>
                    </label>
                    <label>
                        Play Badge:
                        <select class="video-badge-select">
                            <option value="yes">Show</option>
                            <option value="no">Hide</option>
                        </select>
                    </label>
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
        } else {
            $image = wp_get_attachment_image_src($image_id, 'medium');
            if (!$image) return;
    ?>
        <div class="gallery-item size-<?php echo esc_attr($masonry_size); ?>" data-id="<?php echo $image_id; ?>" data-type="image"<?php if ($has_grid_sizing) echo ' style="grid-column: span ' . $col_span . '; grid-row: span ' . $row_span . ';"'; ?>>
            <div class="image-container">
                <img src="<?php echo $image[0]; ?>" alt="">
            </div>
            <button type="button" class="remove-item">&times;</button>
            <div class="item-controls">
                <div class="masonry-controls">
                    <button type="button" class="size-btn <?php echo !$has_grid_sizing && $masonry_size === 'regular' ? 'active' : ''; ?>" data-size="regular">R</button>
                    <button type="button" class="size-btn <?php echo !$has_grid_sizing && $masonry_size === 'tall' ? 'active' : ''; ?>" data-size="tall">T</button>
                    <button type="button" class="size-btn <?php echo !$has_grid_sizing && $masonry_size === 'wide' ? 'active' : ''; ?>" data-size="wide">W</button>
                    <button type="button" class="size-btn <?php echo !$has_grid_sizing && $masonry_size === 'large' ? 'active' : ''; ?>" data-size="large">L</button>
                    <button type="button" class="size-btn <?php echo !$has_grid_sizing && $masonry_size === 'xl' ? 'active' : ''; ?>" data-size="xl">XL</button>
                </div>
                <div class="grid-sizing-controls" style="margin-top: 8px;">
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: center;">
                        <label style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                            <span style="font-size: 9px; color: #fff; opacity: 0.8;">Width</span>
                            <input type="number" class="grid-column-input" min="1" max="12" value="<?php echo esc_attr($col_span); ?>"
                                   style="width: 40px; height: 24px; text-align: center; font-size: 11px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;" />
                        </label>
                        <label style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                            <span style="font-size: 9px; color: #fff; opacity: 0.8;">Height</span>
                            <input type="number" class="grid-row-input" min="1" max="12" value="<?php echo esc_attr($row_span); ?>"
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
                <div class="object-position-controls" style="margin-top: 8px; text-align: center;">
                    <label style="display: inline-flex; flex-direction: column; align-items: center; gap: 2px;">
                        <span style="font-size: 9px; color: #fff; opacity: 0.8;">Image Position</span>
                        <select class="image-position-select" style="width: 140px; padding: 4px; font-size: 10px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;">
                            <option value="">Inherit</option>
                            <option value="center center">Center Center</option>
                            <option value="center top">Center Top</option>
                            <option value="center bottom">Center Bottom</option>
                            <option value="left top">Left Top</option>
                            <option value="left center">Left Center</option>
                            <option value="left bottom">Left Bottom</option>
                            <option value="right top">Right Top</option>
                            <option value="right center">Right Center</option>
                            <option value="right bottom">Right Bottom</option>
                        </select>
                    </label>
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
    }

    private function sanitize_object_position($value)
    {
        $allowed = array(
            'center center', 'center top', 'center bottom',
            'left top', 'left center', 'left bottom',
            'right top', 'right center', 'right bottom',
        );
        return in_array($value, $allowed, true) ? $value : 'center center';
    }

    private function sanitize_label_placement($value)
    {
        $allowed = array(
            'bottom-center', 'bottom-left', 'bottom-right',
            'middle-left', 'middle-center', 'middle-right',
            'top-left', 'top-center', 'top-right',
        );
        return in_array($value, $allowed, true) ? $value : 'bottom-center';
    }

    private function sanitize_label_tag($value)
    {
        $allowed = array('h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div');
        return in_array($value, $allowed, true) ? $value : 'p';
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
            'object_position' => $this->sanitize_object_position(isset($_POST['object_position']) ? $_POST['object_position'] : ''),
            'border_radius' => absint($_POST['border_radius']),
            'column_margin' => sanitize_text_field($_POST['column_margin']),
            'filter_enabled' => isset($_POST['filter_enabled']) ? 1 : 0,
            'filter_categories' => sanitize_text_field($_POST['filter_categories']),
            'filter_all_last' => isset($_POST['filter_all_last']) ? 1 : 0,
            'label_show' => isset($_POST['label_show']) ? 1 : 0,
            'label_show_on_hover' => isset($_POST['label_show_on_hover']) ? 1 : 0,
            'label_placement' => $this->sanitize_label_placement(isset($_POST['label_placement']) ? $_POST['label_placement'] : ''),
            'label_tag' => $this->sanitize_label_tag(isset($_POST['label_tag']) ? $_POST['label_tag'] : ''),
            'label_extra_classes' => sanitize_text_field(isset($_POST['label_extra_classes']) ? $_POST['label_extra_classes'] : ''),
            'label_color' => sanitize_hex_color(isset($_POST['label_color']) ? $_POST['label_color'] : '') ?: '#ffffff',
            'label_shadow' => isset($_POST['label_shadow']) ? 1 : 0,
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

        // Save images (mixed: integer attachment IDs + yt_ YouTube placeholders)
        if (isset($_POST['gallery_images'])) {
            $raw_items = explode(',', $_POST['gallery_images']);
            $images = array();
            foreach ($raw_items as $item) {
                $item = trim($item);
                if (strpos($item, 'yt_') === 0) {
                    // YouTube placeholder - sanitize the video ID portion
                    $video_id = preg_replace('/[^a-zA-Z0-9_-]/', '', substr($item, 3));
                    if ($video_id) {
                        $images[] = 'yt_' . $video_id;
                    }
                } else {
                    $int_val = absint($item);
                    if ($int_val) {
                        $images[] = $int_val;
                    }
                }
            }
            update_post_meta($post_id, '_clearph_gallery_images', $images);
        }

        // Save YouTube items metadata
        if (isset($_POST['youtube_items'])) {
            $youtube_items = json_decode(stripslashes($_POST['youtube_items']), true);
            if (is_array($youtube_items)) {
                $sanitized = array();
                foreach ($youtube_items as $yt_id => $meta) {
                    $yt_id = sanitize_text_field($yt_id);
                    if (strpos($yt_id, 'yt_') !== 0) continue;
                    $sanitized[$yt_id] = array(
                        'video_id' => sanitize_text_field(isset($meta['video_id']) ? $meta['video_id'] : ''),
                        'url' => esc_url_raw(isset($meta['url']) ? $meta['url'] : ''),
                        'is_short' => !empty($meta['is_short']),
                    );
                }
                update_post_meta($post_id, '_clearph_youtube_items', $sanitized);
            }
        }

        // Save YouTube sizing
        if (isset($_POST['youtube_sizing'])) {
            $youtube_sizing = json_decode(stripslashes($_POST['youtube_sizing']), true);
            if (is_array($youtube_sizing)) {
                $sanitized = array();
                foreach ($youtube_sizing as $yt_id => $sizing) {
                    $yt_id = sanitize_text_field($yt_id);
                    if (strpos($yt_id, 'yt_') !== 0) continue;
                    $sanitized[$yt_id] = array(
                        'column_span' => absint(isset($sizing['column_span']) ? $sizing['column_span'] : 2),
                        'row_span' => absint(isset($sizing['row_span']) ? $sizing['row_span'] : 2),
                        'masonry_size' => sanitize_text_field(isset($sizing['masonry_size']) ? $sizing['masonry_size'] : 'regular'),
                    );
                }
                update_post_meta($post_id, '_clearph_youtube_sizing', $sanitized);
            }
        }

        // Save image labels (per-gallery labels stored as JSON)
        if (isset($_POST['image_labels'])) {
            $raw_labels = json_decode(stripslashes($_POST['image_labels']), true);
            if (is_array($raw_labels)) {
                $sanitized_labels = array();
                foreach ($raw_labels as $item_id => $label_data) {
                    $item_id = sanitize_text_field($item_id);
                    if (empty($item_id)) continue;
                    $text = isset($label_data['text']) ? sanitize_text_field($label_data['text']) : '';
                    if (empty($text)) continue; // Skip items with no label
                    $sanitized_labels[$item_id] = array(
                        'text' => $text,
                        'color' => isset($label_data['color']) ? sanitize_hex_color($label_data['color']) : '',
                        'shadow' => isset($label_data['shadow']) ? sanitize_text_field($label_data['shadow']) : '',
                    );
                }
                update_post_meta($post_id, '_clearph_image_labels', $sanitized_labels);
            }
        }

        // Save image sizing (per-gallery sizing stored as JSON)
        if (isset($_POST['image_sizing'])) {
            $raw_sizing = json_decode(stripslashes($_POST['image_sizing']), true);
            if (is_array($raw_sizing)) {
                $sanitized_sizing = array();
                foreach ($raw_sizing as $item_id => $dims) {
                    $item_id = sanitize_text_field($item_id);
                    if (empty($item_id)) continue;
                    $col = isset($dims['column_span']) ? absint($dims['column_span']) : 0;
                    $row = isset($dims['row_span']) ? absint($dims['row_span']) : 0;
                    if ($col < 1 || $col > 12 || $row < 1 || $row > 12) continue;
                    $sanitized_sizing[$item_id] = array(
                        'column_span' => $col,
                        'row_span'    => $row,
                    );
                }
                update_post_meta($post_id, '_clearph_image_sizing', $sanitized_sizing);
            }
        }

        // Debug log
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('Gallery ' . $post_id . ' settings saved: ' . print_r($settings, true));
        }
    }

    private function convert_grid_to_legacy_size($column_span, $row_span) {
        if ($column_span == 2 && $row_span == 2) return 'regular';
        if ($column_span == 2 && $row_span == 4) return 'tall';
        if ($column_span == 4 && $row_span == 2) return 'wide';
        if ($column_span == 4 && $row_span == 4) return 'large';
        if ($column_span >= 6) return 'xl';
        return 'xl';
    }

    private function convert_legacy_name_to_grid($size) {
        $map = array(
            'regular' => array('column_span' => 2, 'row_span' => 2),
            'tall'    => array('column_span' => 2, 'row_span' => 4),
            'wide'    => array('column_span' => 4, 'row_span' => 2),
            'large'   => array('column_span' => 4, 'row_span' => 4),
            'xl'      => array('column_span' => 6, 'row_span' => 6),
        );
        return isset($map[$size]) ? $map[$size] : $map['regular'];
    }
}
