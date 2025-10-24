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
    // Check if we are viewing a single post/page AND if the post object exists
    if ( is_singular() && isset( $GLOBALS['post'] ) ) {
        $post_content = $GLOBALS['post']->post_content;

        // Check if the content has the [3dprint] shortcode AND contains 'mode="bulk"'
        if ( has_shortcode( $post_content, '3dprint' ) && strpos( $post_content, 'mode="bulk"' ) !== false ) {

            // --- Dequeue and Deregister the Default Script ---
            $script_handle = 'jquery.plupload.queue.js';
            if ( wp_script_is( $script_handle, 'enqueued' ) ) {
                wp_dequeue_script( $script_handle );
                wp_deregister_script( $script_handle );
                // error_log("MOTQN 3DPrint Debug: Dequeued script: " . $script_handle);
            } else {
                // error_log("MOTQN 3DPrint Debug: Script not found or already dequeued: " . $script_handle);
            }

            // Remove the original bulk front-end controller so our customised version can take over.
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
                    // error_log("MOTQN 3DPrint Debug: Dequeued script: " . $bulk_handle);
                }
            }

            // --- Dequeue and Deregister the Default Stylesheets ---
            $style_handles = array(
                'jquery.plupload.queue.css',
                '3dprint-frontend',
                '3dprint-frontend-css',
                'p3d-frontend'
            );

            foreach ( $style_handles as $style_handle ) {
                if ( wp_style_is( $style_handle, 'enqueued' ) ) {
                    wp_dequeue_style( $style_handle );
                    wp_deregister_style( $style_handle );
                    // error_log("MOTQN 3DPrint Debug: Dequeued style: " . $style_handle);
                }
            }
        }
    }
}
// Use wp_print_scripts action hook with a late priority (100)
add_action('wp_print_scripts', 'motqn_3dprint_dequeue_default_ui', 100);

// Also hook into wp_print_styles for the CSS
add_action('wp_print_styles', 'motqn_3dprint_dequeue_default_ui', 100);


/**
 * Enqueue the custom uploader script and styles
 * only on pages where the default UI was dequeued.
 */
function motqn_enqueue_custom_uploader_assets() {
    // Repeat the same check used for dequeuing to ensure assets load only when needed.
    if ( is_singular() && isset( $GLOBALS['post'] ) ) {
        $post_content = $GLOBALS['post']->post_content;

        // Check if the content has the [3dprint] shortcode AND contains 'mode="bulk"'
        if ( has_shortcode( $post_content, '3dprint' ) && strpos( $post_content, 'mode="bulk"' ) !== false ) {

            // --- Enqueue YOUR Custom Script ---
            // Handle for the core Plupload script used by the original plugin (verify this handle is correct)
            $core_plupload_handle = 'plupload.full.min.js';
            // Get plugin version for cache busting
            $plugin_data = get_plugin_data( __FILE__ );
            $plugin_version = $plugin_data['Version'];

            wp_enqueue_script(
                'motqn-custom-uploader-js', // Unique handle for your script
                plugin_dir_url( __FILE__ ) . 'js/motqn-jquery.plupload.queue.js', // Path to your JS file
                array('jquery', $core_plupload_handle), // Dependencies
                $plugin_version, // Use plugin version for cache busting
                true // Load in footer
            );

            wp_enqueue_script(
                'motqn-custom-3d-print-frontend-bulk',
                plugin_dir_url( __FILE__ ) . 'js/motqn-3d-print-frontend-bulk.js',
                array( 'jquery', 'motqn-custom-uploader-js' ),
                $plugin_version,
                true
            );

            // --- Enqueue YOUR Custom Stylesheet ---
            wp_enqueue_style(
                'motqn-custom-uploader-css', // Unique handle for your style
                plugin_dir_url( __FILE__ ) . 'css/motqn-jquery.plupload.queue.css', // Path to your CSS file
                array(), // Dependencies (if any)
                $plugin_version // Use plugin version
            );

            wp_enqueue_style(
                'motqn-custom-3dprint-frontend-css',
                plugin_dir_url( __FILE__ ) . 'css/motqn-3dprint-frontend.css',
                array( 'motqn-custom-uploader-css' ),
                $plugin_version
            );

            // --- Optional: Pass PHP data to JavaScript ---
            // Example:
            // wp_localize_script('motqn-custom-uploader-js', 'motqn_uploader_data', array(
            //    'ajax_url' => admin_url('admin-ajax.php'),
            //    'nonce'    => wp_create_nonce('motqn_uploader_nonce'),
            //    'text_processing' => __('Processing...', 'motqn-3dprint-custom'),
            //    // Add any other data your JS might need from PHP here
            // ));
        }
    }
}
// Hook the enqueue function to wp_enqueue_scripts. Priority 110 ensures it runs AFTER dequeue (priority 100).
add_action('wp_enqueue_scripts', 'motqn_enqueue_custom_uploader_assets', 110);

?>