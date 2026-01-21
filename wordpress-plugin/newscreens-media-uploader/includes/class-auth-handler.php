<?php
/**
 * Authentication Handler
 *
 * Handles API key generation and validation for the NewScreens Media Uploader.
 *
 * @package NewScreens_Media_Uploader
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class NewScreens_Auth_Handler
 *
 * Manages API key authentication for REST API requests.
 */
class NewScreens_Auth_Handler {

    /**
     * Option name for API key storage
     *
     * @var string
     */
    const API_KEY_OPTION = 'newscreens_api_key';

    /**
     * Header name for API key
     *
     * @var string
     */
    const API_KEY_HEADER = 'X-NewScreens-API-Key';

    /**
     * Constructor
     */
    public function __construct() {
        // Nothing to initialize
    }

    /**
     * Get the current API key
     *
     * @return string|false The API key or false if not set
     */
    public function get_api_key() {
        return get_option( self::API_KEY_OPTION, false );
    }

    /**
     * Generate a new API key
     *
     * @param bool $save Whether to save the key to the database
     * @return string The generated API key
     */
    public function generate_api_key( $save = true ) {
        $key = wp_generate_password( 32, false );

        if ( $save ) {
            update_option( self::API_KEY_OPTION, $key );
        }

        return $key;
    }

    /**
     * Validate an API key
     *
     * @param string $key The API key to validate
     * @return bool True if valid, false otherwise
     */
    public function validate_api_key( $key ) {
        $stored_key = $this->get_api_key();

        if ( ! $stored_key || ! $key ) {
            return false;
        }

        // Use hash_equals for timing-safe comparison
        return hash_equals( $stored_key, $key );
    }

    /**
     * Validate request authentication
     *
     * @param WP_REST_Request $request The REST request object
     * @return bool|WP_Error True if authenticated, WP_Error otherwise
     */
    public function validate_request( $request ) {
        // Get API key from header
        $api_key = $request->get_header( self::API_KEY_HEADER );

        if ( ! $api_key ) {
            // Try getting from query parameter as fallback (not recommended for production)
            $api_key = $request->get_param( 'api_key' );
        }

        if ( ! $api_key ) {
            return new WP_Error(
                'missing_api_key',
                __( 'API key is required. Pass it via X-NewScreens-API-Key header.', 'newscreens-media-uploader' ),
                array( 'status' => 401 )
            );
        }

        if ( ! $this->validate_api_key( $api_key ) ) {
            $this->log_failed_auth( $api_key, $request );

            return new WP_Error(
                'invalid_api_key',
                __( 'Invalid API key.', 'newscreens-media-uploader' ),
                array( 'status' => 401 )
            );
        }

        return true;
    }

    /**
     * Log failed authentication attempts
     *
     * @param string          $api_key The provided API key
     * @param WP_REST_Request $request The REST request object
     */
    private function log_failed_auth( $api_key, $request ) {
        if ( ! get_option( 'newscreens_enable_logging', false ) ) {
            return;
        }

        $log_entry = array(
            'time'       => current_time( 'mysql' ),
            'ip'         => $this->get_client_ip(),
            'user_agent' => $request->get_header( 'user-agent' ),
            'key_prefix' => substr( $api_key, 0, 8 ) . '...',
        );

        error_log( '[NewScreens] Failed auth attempt: ' . wp_json_encode( $log_entry ) );
    }

    /**
     * Get client IP address
     *
     * @return string The client IP address
     */
    private function get_client_ip() {
        $ip = '';

        if ( ! empty( $_SERVER['HTTP_CLIENT_IP'] ) ) {
            $ip = sanitize_text_field( wp_unslash( $_SERVER['HTTP_CLIENT_IP'] ) );
        } elseif ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
            $ip = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FORWARDED_FOR'] ) );
        } elseif ( ! empty( $_SERVER['REMOTE_ADDR'] ) ) {
            $ip = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
        }

        return $ip;
    }

    /**
     * Check permission callback for REST API
     *
     * @param WP_REST_Request $request The REST request object
     * @return bool|WP_Error True if permission granted, WP_Error otherwise
     */
    public function check_permission( $request ) {
        return $this->validate_request( $request );
    }
}
