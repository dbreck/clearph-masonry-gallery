<?php

class ClearPH_Admin
{

    public function __construct()
    {
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));
        add_action('admin_footer', array($this, 'media_templates'));
        // Settings page
        add_action('admin_menu', array($this, 'add_settings_page'));
        add_action('admin_init', array($this, 'register_settings'));
    }

    public function enqueue_admin_assets($hook)
    {
        global $post_type;

        if ($post_type !== 'clearph_gallery') {
            return;
        }

        wp_enqueue_media();
        wp_enqueue_script('jquery-ui-sortable');

        wp_enqueue_script(
            'clearph-admin',
            CLEARPH_MASONRY_PLUGIN_URL . 'admin/js/gallery-builder.js',
            array('jquery', 'jquery-ui-sortable'),
            CLEARPH_MASONRY_VERSION,
            true
        );

        wp_enqueue_style(
            'clearph-admin',
            CLEARPH_MASONRY_PLUGIN_URL . 'admin/css/admin.css',
            array(),
            CLEARPH_MASONRY_VERSION
        );

        global $post;
        wp_localize_script('clearph-admin', 'clearph_admin', array(
            'nonce' => wp_create_nonce('clearph_gallery_nonce'),
            'ajax_url' => admin_url('admin-ajax.php'),
            'post_id' => $post ? $post->ID : 0
        ));
    }

    public function media_templates()
    {
        global $post_type;

        if ($post_type !== 'clearph_gallery') {
            return;
        }
?>
        <script type="text/html" id="tmpl-gallery-item">
            <div class="gallery-item size-regular" data-id="{{ data.id }}" data-type="{{ data.type }}">
                <div class="image-container">
                    <# if ( data.type === 'video' ) { #>
                        <video src="{{ data.thumb }}" muted preload="metadata"></video>
                        <span class="video-badge">&#9654;</span>
                    <# } else { #>
                        <img src="{{ data.thumb }}" alt="">
                    <# } #>
                </div>
                <button type="button" class="remove-item">&times;</button>
                <div class="item-controls">
                    <div class="masonry-controls">
                        <button type="button" class="size-btn active" data-size="regular">R</button>
                        <button type="button" class="size-btn" data-size="tall">T</button>
                        <button type="button" class="size-btn" data-size="wide">W</button>
                        <button type="button" class="size-btn" data-size="large">L</button>
                        <button type="button" class="size-btn" data-size="xl">XL</button>
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
                    <# if ( data.type === 'video' ) { #>
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
                    <# } #>
                    <div class="category-controls" style="margin-top: 8px;">
                        <select class="image-category-select" style="width: 90%; padding: 4px; font-size: 10px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;">
                            <option value="">No Category</option>
                        </select>
                    </div>
                    <div class="image-filename">{{ data.filename }}</div>
                </div>
            </div>
        </script>
        <script type="text/html" id="tmpl-youtube-item">
            <div class="gallery-item size-{{ data.masonry_size }}" data-id="{{ data.yt_id }}" data-type="youtube">
                <div class="image-container">
                    <img src="{{ data.thumb }}" alt="YouTube video">
                    <span class="youtube-badge">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M10 8.64L15.27 12 10 15.36V8.64M8 5v14l11-7L8 5z"/></svg>
                    </span>
                </div>
                <button type="button" class="remove-item">&times;</button>
                <div class="item-controls">
                    <div class="masonry-controls">
                        <button type="button" class="size-btn <# if ( data.masonry_size === 'regular' ) { #>active<# } #>" data-size="regular">R</button>
                        <button type="button" class="size-btn <# if ( data.masonry_size === 'tall' ) { #>active<# } #>" data-size="tall">T</button>
                        <button type="button" class="size-btn <# if ( data.masonry_size === 'wide' ) { #>active<# } #>" data-size="wide">W</button>
                        <button type="button" class="size-btn <# if ( data.masonry_size === 'large' ) { #>active<# } #>" data-size="large">L</button>
                        <button type="button" class="size-btn <# if ( data.masonry_size === 'xl' ) { #>active<# } #>" data-size="xl">XL</button>
                    </div>
                    <div class="grid-sizing-controls" style="margin-top: 8px;">
                        <div style="display: flex; gap: 8px; align-items: center; justify-content: center;">
                            <label style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                                <span style="font-size: 9px; color: #fff; opacity: 0.8;">Width</span>
                                <input type="number" class="grid-column-input" min="1" max="12" value="{{ data.column_span }}"
                                       style="width: 40px; height: 24px; text-align: center; font-size: 11px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;" />
                            </label>
                            <label style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                                <span style="font-size: 9px; color: #fff; opacity: 0.8;">Height</span>
                                <input type="number" class="grid-row-input" min="1" max="12" value="{{ data.row_span }}"
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
                    <div class="youtube-url-controls" style="margin-top: 8px;">
                        <input type="text" class="youtube-url-input" value="{{ data.url }}" placeholder="YouTube URL"
                               style="width: 90%; padding: 4px; font-size: 10px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;" />
                    </div>
                    <div class="category-controls" style="margin-top: 8px;">
                        <select class="image-category-select" style="width: 90%; padding: 4px; font-size: 10px; border: 1px solid #fff; background: rgba(255,255,255,0.2); color: #fff; border-radius: 2px;">
                            <option value="">No Category</option>
                        </select>
                    </div>
                    <div class="image-filename">YouTube: {{ data.video_id }}</div>
                </div>
            </div>
        </script>
    <?php
    }

    // Settings page and fields
    public function add_settings_page()
    {
        add_options_page(
            __('Clear pH Gallery Settings', 'clearph'),
            __('Clear pH Gallery', 'clearph'),
            'manage_options',
            'clearph-gallery-settings',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings()
    {
        register_setting('clearph_gallery_settings', 'clearph_download_protection_scope', array(
            'type' => 'string',
            'sanitize_callback' => function ($val) {
                return in_array($val, array('off', 'gallery', 'site'), true) ? $val : 'gallery';
            },
            'default' => 'gallery'
        ));

        add_settings_section(
            'clearph_protection_section',
            __('Protection', 'clearph'),
            function () {
                echo '<p>' . esc_html__('Control download prevention behavior for images.', 'clearph') . '</p>';
            },
            'clearph-gallery-settings'
        );

        add_settings_field(
            'clearph_download_protection_scope',
            __('Prevent image downloads', 'clearph'),
            array($this, 'render_scope_field'),
            'clearph-gallery-settings',
            'clearph_protection_section'
        );
    }

    public function render_scope_field()
    {
        $value = get_option('clearph_download_protection_scope', 'gallery');
    ?>
        <fieldset>
            <label style="display:block; margin-bottom:6px;">
                <input type="radio" name="clearph_download_protection_scope" value="gallery" <?php checked($value, 'gallery'); ?> />
                <?php esc_html_e('Galleries Only', 'clearph'); ?>
            </label>
            <label style="display:block; margin-bottom:6px;">
                <input type="radio" name="clearph_download_protection_scope" value="site" <?php checked($value, 'site'); ?> />
                <?php esc_html_e('Site-Wide', 'clearph'); ?>
            </label>
            <p class="description"><?php esc_html_e('When Site-Wide is selected, right-click and drag on images are disabled for logged-out visitors across the entire site. Lightbox Download button is hidden when not logged in.', 'clearph'); ?></p>
        </fieldset>
    <?php
    }

    public function render_settings_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
    ?>
        <div class="wrap">
            <h1><?php esc_html_e('Clear pH Gallery Settings', 'clearph'); ?></h1>
            <form method="post" action="options.php">
                <?php
                settings_fields('clearph_gallery_settings');
                do_settings_sections('clearph-gallery-settings');
                submit_button();
                ?>
            </form>
        </div>
<?php
    }
}
