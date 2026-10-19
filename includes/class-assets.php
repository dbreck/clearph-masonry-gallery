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

        // Opt-in (Settings > Clear pH Gallery > Animations): bundled GSAP for
        // sites that don't load their own. masonry-gallery.js injects it only
        // on pages with filters and only if window.gsap is missing.
        if (get_option('clearph_gsap_source', 'site') === 'bundled') {
            wp_localize_script('clearph-masonry-frontend', 'clearphMasonry', array(
                'gsapUrl' => CLEARPH_MASONRY_PLUGIN_URL . 'public/js/vendor/gsap.min.js?ver=3.15.0',
            ));
        }

        wp_register_style(
            'clearph-masonry-frontend',
            CLEARPH_MASONRY_PLUGIN_URL . 'public/css/gallery.css',
            array(),
            CLEARPH_MASONRY_VERSION
        );
    }
}
