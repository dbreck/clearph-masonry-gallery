<?php

class ClearPH_Assets {

    public function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'register_frontend_assets'));
    }

    public function register_frontend_assets() {
        // GSAP is optional - the JS checks typeof gsap !== "undefined" at runtime.
        // Do NOT add GSAP as a dependency; themes may deregister/swap GSAP handles
        // which silently prevents this script from loading.
        wp_register_script(
            'clearph-masonry-frontend',
            CLEARPH_MASONRY_PLUGIN_URL . 'public/js/masonry-gallery.js',
            array('jquery'),
            CLEARPH_MASONRY_VERSION,
            true
        );

        wp_register_style(
            'clearph-masonry-frontend',
            CLEARPH_MASONRY_PLUGIN_URL . 'public/css/gallery.css',
            array(),
            CLEARPH_MASONRY_VERSION
        );
    }
}
