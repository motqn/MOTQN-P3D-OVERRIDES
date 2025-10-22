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

            // --- Dequeue and Deregister the Default Stylesheet ---
            $style_handle = 'jquery.plupload.queue.css';
            if ( wp_style_is( $style_handle, 'enqueued' ) ) {
                wp_dequeue_style( $style_handle );
                wp_deregister_style( $style_handle );
                // error_log("MOTQN 3DPrint Debug: Dequeued style: " . $style_handle);
            } else {
                // error_log("MOTQN 3DPrint Debug: Style not found or already dequeued: " . $style_handle);
            }
        }
    }
}
// Use wp_print_scripts action hook with a late priority (100)
add_action('wp_print_scripts', 'motqn_3dprint_dequeue_default_ui', 100);

// Also hook into wp_print_styles for the CSS
add_action('wp_print_styles', 'motqn_3dprint_dequeue_default_ui', 100);


// --- CODE FOR STEP 4 (ENQUEUEING YOUR CUSTOM FILES) WILL GO HERE LATER ---


?>