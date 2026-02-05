<?php

class ClearPH_Content_Protection
{

    const MAX_PUBLIC_WIDTH = 2048; // cap largest width for anonymous users

    public function __construct()
    {
        if (is_admin()) return;
        // Allow disabling protection via wp-config.php define('CLEARPH_DISABLE_PROTECTION', true);
        if (defined('CLEARPH_DISABLE_PROTECTION') && constant('CLEARPH_DISABLE_PROTECTION')) return;

        // Feature flags (can be set in wp-config.php)
        // - CLEARPH_PROTECT_DOWNGRADE_SIZES: when true, cap image src/srcset/URL for anon users (default: false)
        // - CLEARPH_PROTECT_RIGHTCLICK: when true, block right-click on IMG for anon users (default: true)
        // - CLEARPH_PROTECT_BLOCK_ATTACHMENT: when true, redirect anon users away from attachment pages (default: true)
        $enable_downshift = defined('CLEARPH_PROTECT_DOWNGRADE_SIZES') ? (bool) constant('CLEARPH_PROTECT_DOWNGRADE_SIZES') : false;
        $enable_rightclick = defined('CLEARPH_PROTECT_RIGHTCLICK') ? (bool) constant('CLEARPH_PROTECT_RIGHTCLICK') : true;
        $enable_block_attachment = defined('CLEARPH_PROTECT_BLOCK_ATTACHMENT') ? (bool) constant('CLEARPH_PROTECT_BLOCK_ATTACHMENT') : true;

        if ($enable_downshift) {
            // Filter image src when requested at 'full' or overly large custom sizes
            add_filter('wp_get_attachment_image_src', array($this, 'filter_image_src'), 10, 4);
            // Filter srcset candidates to remove very large/originals for logged-out users
            add_filter('wp_calculate_image_srcset', array($this, 'filter_srcset'), 10, 5);
            // Generic URL fetches for images: downshift to a large size when anonymous
            add_filter('wp_get_attachment_url', array($this, 'filter_attachment_url'), 10, 2);
        }

        if ($enable_block_attachment) {
            // Optionally prevent navigating to attachment pages anonymously
            add_action('template_redirect', array($this, 'maybe_block_attachment_page'));
        }

        if ($enable_rightclick) {
            // Gentle client-side right-click prevention on images for anonymous visitors
            add_action('wp_enqueue_scripts', array($this, 'enqueue_client_protection'));
        }
    }

    private function is_public_context()
    {
        return !is_user_logged_in();
    }

    private function is_image($attachment_id)
    {
        return wp_attachment_is_image($attachment_id);
    }

    public function filter_image_src($image, $attachment_id, $size, $icon)
    {
        // Only affect anonymous visitors on normal pages
        if (!$this->is_public_context() || is_feed()) return $image;
        if (!$this->is_image($attachment_id)) return $image;

        // If explicitly asking for full size or an array size exceeding cap, downgrade
        $needs_downshift = false;
        if ($size === 'full') {
            $needs_downshift = true;
        } elseif (is_array($size) && ((int)$size[0] > self::MAX_PUBLIC_WIDTH || (int)$size[1] > self::MAX_PUBLIC_WIDTH)) {
            $needs_downshift = true;
        }

        if ($needs_downshift) {
            $target = $this->best_public_size($attachment_id);
            $data = image_get_intermediate_size($attachment_id, $target);
            if ($data && !empty($data['url'])) {
                // match wp_get_attachment_image_src return signature
                return array($data['url'], (int)($data['width'] ?? 0), (int)($data['height'] ?? 0), true);
            }
        }

        return $image;
    }

    public function filter_srcset($sources, $size_array, $image_src, $image_meta, $attachment_id)
    {
        if (!$this->is_public_context()) return $sources;
        if (!is_array($sources)) return $sources;
        if (!$this->is_image($attachment_id)) return $sources;

        // Remove srcset candidates that exceed our max width (helps avoid original exposure)
        foreach ($sources as $width => $entry) {
            if ((int)$width > self::MAX_PUBLIC_WIDTH) {
                unset($sources[$width]);
            }
        }
        return $sources;
    }

    public function filter_attachment_url($url, $post_id)
    {
        if (!$this->is_public_context()) return $url;
        if (!$this->is_image($post_id)) return $url;

        // Try to map to best public size URL instead of raw original without triggering filters
        $target = $this->best_public_size($post_id);
        $data = image_get_intermediate_size($post_id, $target);
        if ($data && !empty($data['url'])) {
            return $data['url'];
        }
        return $url;
    }

    private function best_public_size($attachment_id)
    {
        // Prefer 'large' or the largest registered size under cap
        $sizes = get_intermediate_image_sizes();
        $candidates = array();
        foreach ($sizes as $sz) {
            $data = image_get_intermediate_size($attachment_id, $sz);
            if ($data && !empty($data['width']) && $data['width'] <= self::MAX_PUBLIC_WIDTH) {
                $candidates[$sz] = (int)$data['width'];
            }
        }
        if (isset($candidates['large'])) return 'large';
        if (!empty($candidates)) {
            // pick the largest under cap
            arsort($candidates);
            return array_key_first($candidates);
        }
        return 'large';
    }

    public function maybe_block_attachment_page()
    {
        if ($this->is_public_context() && is_attachment()) {
            // Prevent serving full-screen originals via attachment pages
            wp_redirect(home_url('/'), 302);
            exit;
        }
    }

    public function enqueue_client_protection()
    {
        if ($this->is_public_context()) {
            // Tiny inline script to discourage right-click on images (client-side only)
            wp_enqueue_script('jquery');
            $js = 'document.addEventListener("contextmenu",function(e){var t=e.target; if(t && t.tagName==="IMG"){ e.preventDefault(); }}, {capture:true});';
            wp_add_inline_script('jquery', $js, 'after');
        }
    }
}
