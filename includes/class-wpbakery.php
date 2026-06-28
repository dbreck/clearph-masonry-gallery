<?php

/**
 * WPBakery Page Builder element for Clear pH Masonry Gallery.
 *
 * Maps the [clearph_gallery] shortcode to a visual element with a gallery
 * picker plus per-instance setting overrides. Every override defaults to
 * "Inherit from gallery" (empty value) so an unconfigured element behaves
 * exactly like a bare [clearph_gallery id="X"] shortcode.
 */

if (!defined('ABSPATH')) {
    exit;
}

class ClearPH_Masonry_WPBakery
{
    public function __construct()
    {
        // vc_before_init fires once WPBakery is available.
        add_action('vc_before_init', array($this, 'map_element'));
    }

    /**
     * Dropdown values for the gallery picker: label => gallery ID.
     */
    private function get_gallery_options()
    {
        $options = array(__('— Select a gallery —', 'clearph-masonry-gallery') => '');

        $galleries = get_posts(array(
            'post_type'      => 'clearph_gallery',
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC',
        ));

        foreach ($galleries as $gallery) {
            $title = $gallery->post_title !== '' ? $gallery->post_title : sprintf(__('(no title) #%d', 'clearph-masonry-gallery'), $gallery->ID);
            $options[$title . ' (#' . $gallery->ID . ')'] = (string) $gallery->ID;
        }

        return $options;
    }

    /**
     * Tri-state dropdown values shared by all boolean overrides.
     */
    private function tristate()
    {
        return array(
            __('Inherit from gallery', 'clearph-masonry-gallery') => '',
            __('Yes', 'clearph-masonry-gallery')                  => '1',
            __('No', 'clearph-masonry-gallery')                   => '0',
        );
    }

    public function map_element()
    {
        if (!function_exists('vc_map')) {
            return;
        }

        $inherit = __('Inherit from gallery', 'clearph-masonry-gallery');

        vc_map(array(
            'name'        => __('Clear pH Masonry Gallery', 'clearph-masonry-gallery'),
            'base'        => 'clearph_gallery',
            'category'    => __('Clear pH', 'clearph-masonry-gallery'),
            'description' => __('Display a masonry gallery, with optional per-placement overrides.', 'clearph-masonry-gallery'),
            'icon'        => 'dashicons dashicons-format-gallery',
            'params'      => array(

                // ---- General ----
                array(
                    'type'        => 'dropdown',
                    'heading'     => __('Gallery', 'clearph-masonry-gallery'),
                    'param_name'  => 'id',
                    'value'       => $this->get_gallery_options(),
                    'description' => __('Choose which saved gallery to display.', 'clearph-masonry-gallery'),
                    'admin_label' => true,
                    'group'       => __('General', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'        => 'textfield',
                    'heading'     => __('Extra CSS Class', 'clearph-masonry-gallery'),
                    'param_name'  => 'class',
                    'description' => __('Optional extra class on the gallery wrapper.', 'clearph-masonry-gallery'),
                    'group'       => __('General', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'        => 'textfield',
                    'heading'     => __('Lightbox Group', 'clearph-masonry-gallery'),
                    'param_name'  => 'lightbox_group',
                    'description' => __('Give two galleries the same group name to combine them into one lightbox slideshow.', 'clearph-masonry-gallery'),
                    'group'       => __('General', 'clearph-masonry-gallery'),
                ),

                // ---- Layout ----
                array(
                    'type'        => 'dropdown',
                    'heading'     => __('Columns', 'clearph-masonry-gallery'),
                    'param_name'  => 'columns',
                    'value'       => array(
                        $inherit => '',
                        '2'      => '2',
                        '3'      => '3',
                        '4'      => '4',
                        '5'      => '5',
                        '6'      => '6',
                    ),
                    'group'       => __('Layout', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'       => 'dropdown',
                    'heading'    => __('Masonry Layout', 'clearph-masonry-gallery'),
                    'param_name' => 'masonry_enabled',
                    'value'      => $this->tristate(),
                    'group'      => __('Layout', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'       => 'dropdown',
                    'heading'    => __('Object Fit', 'clearph-masonry-gallery'),
                    'param_name' => 'object_fit',
                    'value'      => array(
                        $inherit                                       => '',
                        __('Cover', 'clearph-masonry-gallery')        => 'cover',
                        __('Contain', 'clearph-masonry-gallery')      => 'contain',
                        __('Fill', 'clearph-masonry-gallery')         => 'fill',
                    ),
                    'group'      => __('Layout', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'       => 'dropdown',
                    'heading'    => __('Object Position', 'clearph-masonry-gallery'),
                    'param_name' => 'object_position',
                    'value'      => array(
                        $inherit                                          => '',
                        __('Center Center', 'clearph-masonry-gallery')   => 'center center',
                        __('Center Top', 'clearph-masonry-gallery')      => 'center top',
                        __('Center Bottom', 'clearph-masonry-gallery')   => 'center bottom',
                        __('Left Center', 'clearph-masonry-gallery')     => 'left center',
                        __('Left Top', 'clearph-masonry-gallery')        => 'left top',
                        __('Left Bottom', 'clearph-masonry-gallery')     => 'left bottom',
                        __('Right Center', 'clearph-masonry-gallery')    => 'right center',
                        __('Right Top', 'clearph-masonry-gallery')       => 'right top',
                        __('Right Bottom', 'clearph-masonry-gallery')    => 'right bottom',
                    ),
                    'group'      => __('Layout', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'        => 'textfield',
                    'heading'     => __('Border Radius', 'clearph-masonry-gallery'),
                    'param_name'  => 'border_radius',
                    'description' => __('e.g. 8px. Leave blank to inherit.', 'clearph-masonry-gallery'),
                    'group'       => __('Layout', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'        => 'textfield',
                    'heading'     => __('Column Gap', 'clearph-masonry-gallery'),
                    'param_name'  => 'column_margin',
                    'description' => __('e.g. 20px. Leave blank to inherit.', 'clearph-masonry-gallery'),
                    'group'       => __('Layout', 'clearph-masonry-gallery'),
                ),

                // ---- Filter ----
                array(
                    'type'        => 'dropdown',
                    'heading'     => __('Filter Animation', 'clearph-masonry-gallery'),
                    'param_name'  => 'filter_animation',
                    'value'       => array(
                        $inherit                                            => '',
                        __('Fade Up (staggered)', 'clearph-masonry-gallery') => 'fade-up',
                        __('Fade (staggered)', 'clearph-masonry-gallery')    => 'fade',
                        __('Scale / Pop In', 'clearph-masonry-gallery')      => 'scale',
                        __('3D Flip', 'clearph-masonry-gallery')             => 'flip',
                        __('Blur In', 'clearph-masonry-gallery')             => 'blur',
                        __('Slide In', 'clearph-masonry-gallery')            => 'slide',
                        __('None (instant)', 'clearph-masonry-gallery')      => 'none',
                    ),
                    'description' => __('How items animate in when a category filter is clicked.', 'clearph-masonry-gallery'),
                    'group'       => __('Filter', 'clearph-masonry-gallery'),
                ),

                // ---- Labels ----
                array(
                    'type'       => 'dropdown',
                    'heading'    => __('Show Labels', 'clearph-masonry-gallery'),
                    'param_name' => 'label_show',
                    'value'      => $this->tristate(),
                    'group'      => __('Labels', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'       => 'dropdown',
                    'heading'    => __('Show Labels on Hover Only', 'clearph-masonry-gallery'),
                    'param_name' => 'label_show_on_hover',
                    'value'      => $this->tristate(),
                    'group'      => __('Labels', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'       => 'dropdown',
                    'heading'    => __('Label Placement', 'clearph-masonry-gallery'),
                    'param_name' => 'label_placement',
                    'value'      => array(
                        $inherit                                        => '',
                        __('Bottom Center', 'clearph-masonry-gallery') => 'bottom-center',
                        __('Bottom Left', 'clearph-masonry-gallery')   => 'bottom-left',
                        __('Bottom Right', 'clearph-masonry-gallery')  => 'bottom-right',
                        __('Middle Left', 'clearph-masonry-gallery')   => 'middle-left',
                        __('Middle Center', 'clearph-masonry-gallery') => 'middle-center',
                        __('Middle Right', 'clearph-masonry-gallery')  => 'middle-right',
                        __('Top Left', 'clearph-masonry-gallery')      => 'top-left',
                        __('Top Center', 'clearph-masonry-gallery')    => 'top-center',
                        __('Top Right', 'clearph-masonry-gallery')     => 'top-right',
                    ),
                    'group'      => __('Labels', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'        => 'colorpicker',
                    'heading'     => __('Label Color', 'clearph-masonry-gallery'),
                    'param_name'  => 'label_color',
                    'description' => __('Leave blank to inherit.', 'clearph-masonry-gallery'),
                    'group'       => __('Labels', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'       => 'dropdown',
                    'heading'    => __('Label Text Shadow', 'clearph-masonry-gallery'),
                    'param_name' => 'label_shadow',
                    'value'      => $this->tristate(),
                    'group'      => __('Labels', 'clearph-masonry-gallery'),
                ),

                // ---- Lightbox ----
                array(
                    'type'       => 'dropdown',
                    'heading'    => __('Enable Lightbox', 'clearph-masonry-gallery'),
                    'param_name' => 'lightbox_enabled',
                    'value'      => $this->tristate(),
                    'group'      => __('Lightbox', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'       => 'dropdown',
                    'heading'    => __('Show Labels on Lightbox Image', 'clearph-masonry-gallery'),
                    'param_name' => 'label_show_on_lightbox',
                    'value'      => $this->tristate(),
                    'group'      => __('Lightbox', 'clearph-masonry-gallery'),
                ),
                array(
                    'type'        => 'dropdown',
                    'heading'     => __('Hide Lightbox Caption', 'clearph-masonry-gallery'),
                    'param_name'  => 'lightbox_caption_hide',
                    'value'       => $this->tristate(),
                    'description' => __('Keeps the caption in the markup for SEO but hides it visually.', 'clearph-masonry-gallery'),
                    'group'       => __('Lightbox', 'clearph-masonry-gallery'),
                ),
            ),
        ));
    }
}
