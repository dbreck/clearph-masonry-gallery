<?php

/**
 * Plugin Name: Clear pH Masonry Gallery
 * Plugin URI: https://clearph.com
 * Description: Advanced masonry gallery with drag-drop ordering, bulk media selection, and GSAP animations.
 * Version: 1.4.2
 * Author: Danny Breckenridge
 * License: GPL v2 or later
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('CLEARPH_MASONRY_VERSION', '1.4.2');
define('CLEARPH_MASONRY_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('CLEARPH_MASONRY_PLUGIN_URL', plugin_dir_url(__FILE__));

class ClearPH_Masonry_Gallery
{

    private static $instance = null;

    public static function get_instance()
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct()
    {
        add_action('plugins_loaded', array($this, 'init'));
    }

    public function init()
    {
        $this->load_dependencies();
        $this->init_components();
    }

    private function load_dependencies()
    {
        require_once CLEARPH_MASONRY_PLUGIN_DIR . 'includes/class-gallery-post-type.php';
        require_once CLEARPH_MASONRY_PLUGIN_DIR . 'includes/class-admin.php';
        require_once CLEARPH_MASONRY_PLUGIN_DIR . 'includes/class-frontend.php';
        require_once CLEARPH_MASONRY_PLUGIN_DIR . 'includes/class-media-handler.php';
        require_once CLEARPH_MASONRY_PLUGIN_DIR . 'includes/class-assets.php';
        require_once CLEARPH_MASONRY_PLUGIN_DIR . 'includes/class-content-protection.php';
        require_once CLEARPH_MASONRY_PLUGIN_DIR . 'includes/class-github-updater.php';
    }

    private function init_components()
    {
        new ClearPH_Gallery_Post_Type();
        new ClearPH_Admin();
        new ClearPH_Frontend();
        new ClearPH_Media_Handler();
        new ClearPH_Assets();
        new ClearPH_Content_Protection();
        new ClearPH_GitHub_Updater( __FILE__, 'dbreck/clearph-masonry-gallery' );
    }
}

// Initialize plugin
ClearPH_Masonry_Gallery::get_instance();

// Activation hook
register_activation_hook(__FILE__, function () {
    // Initialize plugin to register post type
    ClearPH_Masonry_Gallery::get_instance()->init();
    flush_rewrite_rules();
});

// Deactivation hook
register_deactivation_hook(__FILE__, function () {
    flush_rewrite_rules();
});
