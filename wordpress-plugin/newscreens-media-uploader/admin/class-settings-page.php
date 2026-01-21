<?php
/**
 * Settings Page
 *
 * Admin settings page for the NewScreens Media Uploader plugin.
 *
 * @package NewScreens_Media_Uploader
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class NewScreens_Settings_Page
 *
 * Manages the plugin settings page in WordPress admin.
 */
class NewScreens_Settings_Page {

    /**
     * Settings page slug
     *
     * @var string
     */
    const PAGE_SLUG = 'newscreens-uploader';

    /**
     * Option group name
     *
     * @var string
     */
    const OPTION_GROUP = 'newscreens_settings';

    /**
     * Auth handler instance
     *
     * @var NewScreens_Auth_Handler
     */
    private $auth;

    /**
     * Constructor
     *
     * @param NewScreens_Auth_Handler $auth Auth handler instance
     */
    public function __construct( $auth ) {
        $this->auth = $auth;

        add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
        add_action( 'wp_ajax_newscreens_regenerate_key', array( $this, 'ajax_regenerate_key' ) );
    }

    /**
     * Add settings page to admin menu
     */
    public function add_settings_page() {
        add_options_page(
            __( 'NewScreens Uploader', 'newscreens-media-uploader' ),
            __( 'NewScreens Uploader', 'newscreens-media-uploader' ),
            'manage_options',
            self::PAGE_SLUG,
            array( $this, 'render_settings_page' )
        );
    }

    /**
     * Register plugin settings
     */
    public function register_settings() {
        // Register settings
        register_setting( self::OPTION_GROUP, 'newscreens_max_file_size', array(
            'type'              => 'integer',
            'sanitize_callback' => 'absint',
            'default'           => 10,
        ) );

        register_setting( self::OPTION_GROUP, 'newscreens_allowed_types', array(
            'type'              => 'array',
            'sanitize_callback' => array( $this, 'sanitize_allowed_types' ),
            'default'           => array( 'png', 'jpg', 'jpeg', 'gif', 'webp' ),
        ) );

        register_setting( self::OPTION_GROUP, 'newscreens_enable_logging', array(
            'type'              => 'boolean',
            'sanitize_callback' => 'rest_sanitize_boolean',
            'default'           => false,
        ) );

        // Add settings section
        add_settings_section(
            'newscreens_main_section',
            __( 'API Settings', 'newscreens-media-uploader' ),
            array( $this, 'render_section_description' ),
            self::PAGE_SLUG
        );

        // Add settings fields
        add_settings_field(
            'newscreens_api_key',
            __( 'API Key', 'newscreens-media-uploader' ),
            array( $this, 'render_api_key_field' ),
            self::PAGE_SLUG,
            'newscreens_main_section'
        );

        add_settings_field(
            'newscreens_max_file_size',
            __( 'Max File Size', 'newscreens-media-uploader' ),
            array( $this, 'render_max_file_size_field' ),
            self::PAGE_SLUG,
            'newscreens_main_section'
        );

        add_settings_field(
            'newscreens_allowed_types',
            __( 'Allowed File Types', 'newscreens-media-uploader' ),
            array( $this, 'render_allowed_types_field' ),
            self::PAGE_SLUG,
            'newscreens_main_section'
        );

        add_settings_field(
            'newscreens_enable_logging',
            __( 'Enable Logging', 'newscreens-media-uploader' ),
            array( $this, 'render_logging_field' ),
            self::PAGE_SLUG,
            'newscreens_main_section'
        );
    }

    /**
     * Enqueue admin scripts
     *
     * @param string $hook Current admin page hook
     */
    public function enqueue_scripts( $hook ) {
        if ( 'settings_page_' . self::PAGE_SLUG !== $hook ) {
            return;
        }

        wp_enqueue_script(
            'newscreens-admin',
            NEWSCREENS_PLUGIN_URL . 'admin/js/admin.js',
            array( 'jquery' ),
            NEWSCREENS_VERSION,
            true
        );

        wp_localize_script( 'newscreens-admin', 'newscreensAdmin', array(
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'newscreens_regenerate_key' ),
            'i18n'    => array(
                'confirmRegenerate' => __( 'Are you sure you want to regenerate the API key? The old key will no longer work.', 'newscreens-media-uploader' ),
                'regenerating'      => __( 'Regenerating...', 'newscreens-media-uploader' ),
                'regenerate'        => __( 'Regenerate Key', 'newscreens-media-uploader' ),
                'copied'            => __( 'Copied!', 'newscreens-media-uploader' ),
                'copyKey'           => __( 'Copy Key', 'newscreens-media-uploader' ),
            ),
        ) );

        // Inline styles for the settings page
        wp_add_inline_style( 'wp-admin', '
            .newscreens-api-key-wrapper {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            .newscreens-api-key-field {
                font-family: monospace;
                width: 350px;
                background: #f0f0f1;
            }
            .newscreens-endpoint-info {
                background: #f0f0f1;
                padding: 15px;
                border-left: 4px solid #2271b1;
                margin: 15px 0;
            }
            .newscreens-endpoint-info code {
                background: #fff;
                padding: 2px 6px;
                border-radius: 3px;
            }
        ' );
    }

    /**
     * Render settings page
     */
    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $site_url = get_bloginfo( 'url' );
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

            <div class="newscreens-endpoint-info">
                <h3><?php esc_html_e( 'API Endpoints', 'newscreens-media-uploader' ); ?></h3>
                <p>
                    <strong><?php esc_html_e( 'Single Upload:', 'newscreens-media-uploader' ); ?></strong><br>
                    <code>POST <?php echo esc_html( $site_url ); ?>/wp-json/newscreens/v1/upload</code>
                </p>
                <p>
                    <strong><?php esc_html_e( 'Batch Upload:', 'newscreens-media-uploader' ); ?></strong><br>
                    <code>POST <?php echo esc_html( $site_url ); ?>/wp-json/newscreens/v1/upload-batch</code>
                </p>
                <p>
                    <strong><?php esc_html_e( 'Test Connection:', 'newscreens-media-uploader' ); ?></strong><br>
                    <code>GET <?php echo esc_html( $site_url ); ?>/wp-json/newscreens/v1/test</code>
                </p>
                <p class="description">
                    <?php esc_html_e( 'Include the API key in the X-NewScreens-API-Key header for all requests.', 'newscreens-media-uploader' ); ?>
                </p>
            </div>

            <form action="options.php" method="post">
                <?php
                settings_fields( self::OPTION_GROUP );
                do_settings_sections( self::PAGE_SLUG );
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }

    /**
     * Render section description
     */
    public function render_section_description() {
        echo '<p>' . esc_html__( 'Configure the API settings for the NewScreens Media Uploader.', 'newscreens-media-uploader' ) . '</p>';
    }

    /**
     * Render API key field
     */
    public function render_api_key_field() {
        $api_key = $this->auth->get_api_key();
        ?>
        <div class="newscreens-api-key-wrapper">
            <input type="text"
                   id="newscreens_api_key"
                   class="newscreens-api-key-field"
                   value="<?php echo esc_attr( $api_key ); ?>"
                   readonly />
            <button type="button" class="button" id="newscreens-copy-key">
                <?php esc_html_e( 'Copy Key', 'newscreens-media-uploader' ); ?>
            </button>
            <button type="button" class="button" id="newscreens-regenerate-key">
                <?php esc_html_e( 'Regenerate Key', 'newscreens-media-uploader' ); ?>
            </button>
        </div>
        <p class="description">
            <?php esc_html_e( 'Use this API key in the X-NewScreens-API-Key header for all API requests.', 'newscreens-media-uploader' ); ?>
        </p>
        <?php
    }

    /**
     * Render max file size field
     */
    public function render_max_file_size_field() {
        $value = get_option( 'newscreens_max_file_size', 10 );
        $options = array( 5, 10, 20, 50 );
        ?>
        <select name="newscreens_max_file_size" id="newscreens_max_file_size">
            <?php foreach ( $options as $size ) : ?>
                <option value="<?php echo esc_attr( $size ); ?>" <?php selected( $value, $size ); ?>>
                    <?php echo esc_html( $size ); ?> MB
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e( 'Maximum file size allowed for uploads.', 'newscreens-media-uploader' ); ?>
        </p>
        <?php
    }

    /**
     * Render allowed types field
     */
    public function render_allowed_types_field() {
        $allowed = get_option( 'newscreens_allowed_types', array( 'png', 'jpg', 'jpeg', 'gif', 'webp' ) );
        $types = array(
            'png'  => 'PNG',
            'jpg'  => 'JPG',
            'jpeg' => 'JPEG',
            'gif'  => 'GIF',
            'webp' => 'WebP',
        );
        ?>
        <fieldset>
            <?php foreach ( $types as $ext => $label ) : ?>
                <label style="margin-right: 15px;">
                    <input type="checkbox"
                           name="newscreens_allowed_types[]"
                           value="<?php echo esc_attr( $ext ); ?>"
                           <?php checked( in_array( $ext, $allowed, true ) ); ?> />
                    <?php echo esc_html( $label ); ?>
                </label>
            <?php endforeach; ?>
        </fieldset>
        <p class="description">
            <?php esc_html_e( 'Select which image types are allowed for upload.', 'newscreens-media-uploader' ); ?>
        </p>
        <?php
    }

    /**
     * Render logging field
     */
    public function render_logging_field() {
        $enabled = get_option( 'newscreens_enable_logging', false );
        ?>
        <label>
            <input type="checkbox"
                   name="newscreens_enable_logging"
                   value="1"
                   <?php checked( $enabled ); ?> />
            <?php esc_html_e( 'Enable debug logging', 'newscreens-media-uploader' ); ?>
        </label>
        <p class="description">
            <?php esc_html_e( 'When enabled, upload and authentication events are logged for debugging.', 'newscreens-media-uploader' ); ?>
        </p>
        <?php
    }

    /**
     * Sanitize allowed types
     *
     * @param array $input Input array
     * @return array Sanitized array
     */
    public function sanitize_allowed_types( $input ) {
        $valid_types = array( 'png', 'jpg', 'jpeg', 'gif', 'webp' );

        if ( ! is_array( $input ) ) {
            return array( 'png', 'jpg', 'jpeg' );
        }

        return array_values( array_intersect( $input, $valid_types ) );
    }

    /**
     * AJAX handler for regenerating API key
     */
    public function ajax_regenerate_key() {
        // Verify nonce
        if ( ! check_ajax_referer( 'newscreens_regenerate_key', 'nonce', false ) ) {
            wp_send_json_error( array( 'message' => __( 'Security check failed.', 'newscreens-media-uploader' ) ) );
        }

        // Check permissions
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( array( 'message' => __( 'Permission denied.', 'newscreens-media-uploader' ) ) );
        }

        // Generate new key
        $new_key = $this->auth->generate_api_key( true );

        wp_send_json_success( array(
            'api_key' => $new_key,
            'message' => __( 'API key regenerated successfully.', 'newscreens-media-uploader' ),
        ) );
    }
}
