<?php

class ClearPH_Assets {
    
    public function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'register_frontend_assets'));
    }
    
    public function register_frontend_assets() {
        // Check if GSAP is available from Salient
        $gsap_deps = array('jquery');
        if (wp_script_is('gsap', 'registered') || wp_script_is('greensock', 'registered')) {
            $gsap_deps[] = wp_script_is('gsap', 'registered') ? 'gsap' : 'greensock';
        }
        
        // Register but don't enqueue - only load when shortcode is used
        wp_register_script(
            'clearph-masonry-frontend',
            CLEARPH_MASONRY_PLUGIN_URL . 'public/js/masonry-gallery.js',
            $gsap_deps,
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
