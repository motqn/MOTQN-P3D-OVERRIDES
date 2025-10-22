<?php
/*
Plugin Name: MOTQN 3DPrint Layout Override
Description: Replaces 3DPrint UI with MOTQN layout (FDM-only, colors, notes, right summary).
Version: 0.1.2
*/

if (!defined('ABSPATH')) exit;

// Always enqueue on frontend; JS will no-op if form not present
add_action('wp_enqueue_scripts', function () {
    if (is_admin()) return;

    // Load WordPress’ plupload core (safe even if plugin also loads it)
    if (wp_script_is('plupload-all', 'registered')) {
        wp_enqueue_script('plupload-all');
    }

    // Our assets
    wp_enqueue_style(
        'motqn-p3d-style',
        plugins_url('assets/css/motqn-p3d.css', __FILE__),
        [],
        '0.1.2'
    );

    wp_enqueue_script(
        'motqn-p3d-ui',
        plugins_url('assets/js/motqn-p3d-ui.js', __FILE__),
        ['jquery'],
        '0.1.2',
        true
    );

    // Debug ping so we can see it loaded
    wp_add_inline_script('motqn-p3d-ui', 'console.log("MOTQN override JS loaded v0.1.2");');
}, 20);

// (Optional) Wrap the form for cleaner layout injection
add_filter('the_content', function ($content) {
    if (stripos($content, 'p3d-bulk-form') === false) return $content;
    $content = preg_replace('#(<form[^>]+id="p3d-bulk-form"[^>]*>)#i', '<div class="motqn-p3d-wrap">$1', $content);
    $content = preg_replace('#(</form>)#i', '$1</div>', $content);
    return $content;
}, 12);

// Pass cart/checkout for redirects
add_action('wp_enqueue_scripts', function () {
    if (is_admin()) return;
    if (!wp_script_is('motqn-p3d-ui', 'enqueued')) return;

    wp_localize_script('motqn-p3d-ui', 'motqnP3D', [
        'checkoutUrl' => function_exists('wc_get_checkout_url') ? wc_get_checkout_url() : site_url('/checkout'),
        'cartUrl'     => function_exists('wc_get_cart_url') ? wc_get_cart_url() : site_url('/cart'),
    ]);
}, 21);
