<?php
/**
 * Plugin Name:       MOTQN 3D-Print custom UI
 * Plugin URI:        # (You can add a link here later if you have one)
 * Description:       Replaces the default 3DPrint plugin bulk uploader UI with a custom card layout.
 * Version:           1.0.0
 * Author:            Yousef El Shabrawii
 * Author URI:        # (You can add a link here later if you have one)
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       motqn-3dprint-custom
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Dequeue the default 3DPrint bulk uploader scripts and styles
 * if the [3dprint mode="bulk"] shortcode is detected on a singular page.
 */
function motqn_3dprint_dequeue_default_ui() {
    if ( ! motqn_3dprint_should_override_ui() ) {
        return;
    }

    $script_handle = 'jquery.plupload.queue.js';
    if ( wp_script_is( $script_handle, 'enqueued' ) ) {
        wp_dequeue_script( $script_handle );
        wp_deregister_script( $script_handle );
    }

    $bulk_script_handles = array(
        '3dprint-frontend-bulk',
        '3dprint-frontend-bulk.js',
        '3dprint-frontend-bulk-js',
        'p3d-frontend-bulk'
    );

    foreach ( $bulk_script_handles as $bulk_handle ) {
        if ( wp_script_is( $bulk_handle, 'enqueued' ) ) {
            wp_dequeue_script( $bulk_handle );
            wp_deregister_script( $bulk_handle );
        }
    }

    $style_handles = array(
        'jquery.plupload.queue.css',
        '3dprint-frontend',
        '3dprint-frontend-css',
        '3dprint-frontend-global',
        '3dprint-frontend-global-css'
    );

    foreach ( $style_handles as $style_handle ) {
        if ( wp_style_is( $style_handle, 'enqueued' ) ) {
            wp_dequeue_style( $style_handle );
            wp_deregister_style( $style_handle );
        }
    }
}

add_action( 'wp_enqueue_scripts', 'motqn_3dprint_dequeue_default_ui', 100 );


/**
 * Enqueue the custom uploader script and styles
 * only on pages where the default UI was dequeued.
 */
function motqn_enqueue_custom_uploader_assets() {
    if ( ! motqn_3dprint_should_override_ui() ) {
        return;
    }

    if ( ! function_exists( 'get_plugin_data' ) ) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    $plugin_data    = get_plugin_data( __FILE__ );
    $plugin_version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : false;

    $core_plupload_handle = 'plupload.full.min.js';

    wp_enqueue_script(
        'motqn-custom-uploader-js',
        plugin_dir_url( __FILE__ ) . 'js/motqn-jquery.plupload.queue.js',
        array( 'jquery', $core_plupload_handle ),
        $plugin_version,
        true
    );

    wp_enqueue_script(
        'motqn-custom-3d-print-frontend-bulk',
        plugin_dir_url( __FILE__ ) . 'js/motqn-3d-print-frontend-bulk.js',
        array( 'jquery', 'motqn-custom-uploader-js' ),
        $plugin_version,
        true
    );

    wp_enqueue_style(
        'motqn-custom-uploader-css',
        plugin_dir_url( __FILE__ ) . 'css/motqn-jquery.plupload.queue.css',
        array(),
        $plugin_version
    );

    wp_enqueue_style(
        'motqn-custom-frontend-css',
        plugin_dir_url( __FILE__ ) . 'css/motqn-3dprint-frontend.css',
        array( 'motqn-custom-uploader-css' ),
        $plugin_version
    );
}

add_action( 'wp_enqueue_scripts', 'motqn_enqueue_custom_uploader_assets', 110 );

function motqn_3dprint_should_override_ui() {
    if ( ! is_singular() || ! isset( $GLOBALS['post'] ) ) {
        return false;
    }

    $post_content = $GLOBALS['post']->post_content;

    return has_shortcode( $post_content, '3dprint' ) && strpos( $post_content, 'mode="bulk"' ) !== false;
}

?>