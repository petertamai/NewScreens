<?php
/**
 * Plugin Name: The Screens Uploader
 * Plugin URI: https://petertam.pro
 * Description: Secure REST API endpoint for uploading images with metadata from NewScreensNext application.
 * Version: 1.0.0
 * Author: Piotr Tamu
 * Author URI: https://petertam.pro
 * License: GPL-2.0+
 * Text Domain: newscreens-media-uploader
 * Domain Path: /languages
 *
 * @package NewScreens_Media_Uploader
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Define plugin constants
define( 'NEWSCREENS_VERSION', '1.0.0' );
define( 'NEWSCREENS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'NEWSCREENS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'NEWSCREENS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

/**
 * Main plugin class
 */
class NewScreens_Media_Uploader {

    /**
     * Single instance of the class
     *
     * @var NewScreens_Media_Uploader
     */
    private static $instance = null;

    /**
     * Auth handler instance
     *
     * @var NewScreens_Auth_Handler
     */
    public $auth;

    /**
     * Media handler instance
     *
     * @var NewScreens_Media_Handler
     */
    public $media;

    /**
     * API handler instance
     *
     * @var NewScreens_API_Handler
     */
    public $api;

    /**
     * Settings page instance
     *
     * @var NewScreens_Settings_Page
     */
    public $settings;

    /**
     * Get single instance of the class
     *
     * @return NewScreens_Media_Uploader
     */
    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct() {
        $this->includes();
        $this->init_hooks();
    }

    /**
     * Include required files
     */
    private function includes() {
        require_once NEWSCREENS_PLUGIN_DIR . 'includes/class-auth-handler.php';
        require_once NEWSCREENS_PLUGIN_DIR . 'includes/class-media-handler.php';
        require_once NEWSCREENS_PLUGIN_DIR . 'includes/class-api-handler.php';

        if ( is_admin() ) {
            require_once NEWSCREENS_PLUGIN_DIR . 'admin/class-settings-page.php';
        }
    }

    /**
     * Initialize hooks
     */
    private function init_hooks() {
        // Initialize components
        add_action( 'plugins_loaded', array( $this, 'init_components' ) );

        // Register REST API routes
        add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );

        // Activation and deactivation hooks
        register_activation_hook( __FILE__, array( $this, 'activate' ) );
        register_deactivation_hook( __FILE__, array( $this, 'deactivate' ) );
    }

    /**
     * Initialize components
     */
    public function init_components() {
        $this->auth = new NewScreens_Auth_Handler();
        $this->media = new NewScreens_Media_Handler();
        $this->api = new NewScreens_API_Handler( $this->auth, $this->media );

        if ( is_admin() ) {
            $this->settings = new NewScreens_Settings_Page( $this->auth );
        }
    }

    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        if ( isset( $this->api ) ) {
            $this->api->register_routes();
        }
    }

    /**
     * Plugin activation
     */
    public function activate() {
        // Generate API key if not exists
        if ( ! get_option( 'newscreens_api_key' ) ) {
            update_option( 'newscreens_api_key', wp_generate_password( 32, false ) );
        }

        // Set default options
        if ( ! get_option( 'newscreens_max_file_size' ) ) {
            update_option( 'newscreens_max_file_size', 10 ); // 10MB default
        }

        if ( ! get_option( 'newscreens_allowed_types' ) ) {
            update_option( 'newscreens_allowed_types', array( 'png', 'jpg', 'jpeg', 'gif', 'webp' ) );
        }

        if ( ! get_option( 'newscreens_enable_logging' ) ) {
            update_option( 'newscreens_enable_logging', false );
        }

        // Flush rewrite rules
        flush_rewrite_rules();
    }

    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();
    }
}

/**
 * Initialize the plugin
 *
 * @return NewScreens_Media_Uploader
 */
function newscreens_media_uploader() {
    return NewScreens_Media_Uploader::get_instance();
}

// Start the plugin
newscreens_media_uploader();
