<?php
/**
 * Media Handler
 *
 * Handles file upload processing and media library operations.
 *
 * @package NewScreens_Media_Uploader
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class NewScreens_Media_Handler
 *
 * Manages file uploads and WordPress media library integration.
 */
class NewScreens_Media_Handler {

    /**
     * Meta key for storing external ID
     *
     * @var string
     */
    const EXTERNAL_ID_META = '_newscreens_external_id';

    /**
     * Meta key for storing keywords
     *
     * @var string
     */
    const KEYWORDS_META = '_newscreens_keywords';

    /**
     * Constructor
     */
    public function __construct() {
        // Nothing to initialize
    }

    /**
     * Process and upload a file
     *
     * @param array $file       The uploaded file from $_FILES
     * @param array $metadata   Additional metadata for the image
     * @return array|WP_Error   Upload result or error
     */
    public function process_upload( $file, $metadata = array() ) {
        // Validate file
        $validation = $this->validate_file( $file );
        if ( is_wp_error( $validation ) ) {
            return $validation;
        }

        // Require external_id
        if ( empty( $metadata['external_id'] ) ) {
            return new WP_Error(
                'missing_external_id',
                __( 'external_id is required.', 'newscreens-media-uploader' ),
                array( 'status' => 400 )
            );
        }

        // Include required WordPress files
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        // Set up upload overrides
        $overrides = array(
            'test_form' => false,
            'mimes'     => $this->get_allowed_mimes(),
        );

        // Handle the upload
        $upload = wp_handle_upload( $file, $overrides );

        if ( isset( $upload['error'] ) ) {
            return new WP_Error(
                'upload_failed',
                $upload['error'],
                array( 'status' => 500 )
            );
        }

        // Prepare attachment data
        $attachment_data = array(
            'post_mime_type' => $upload['type'],
            'post_title'     => ! empty( $metadata['title'] ) ? sanitize_text_field( $metadata['title'] ) : sanitize_file_name( pathinfo( $file['name'], PATHINFO_FILENAME ) ),
            'post_content'   => ! empty( $metadata['description'] ) ? sanitize_textarea_field( $metadata['description'] ) : '',
            'post_excerpt'   => ! empty( $metadata['caption'] ) ? sanitize_textarea_field( $metadata['caption'] ) : '',
            'post_status'    => 'inherit',
        );

        // Insert attachment
        $attachment_id = wp_insert_attachment( $attachment_data, $upload['file'] );

        if ( is_wp_error( $attachment_id ) ) {
            // Clean up uploaded file
            wp_delete_file( $upload['file'] );
            return $attachment_id;
        }

        // Generate attachment metadata (thumbnails, etc.)
        $attachment_metadata = wp_generate_attachment_metadata( $attachment_id, $upload['file'] );
        wp_update_attachment_metadata( $attachment_id, $attachment_metadata );

        // Set alt text
        if ( ! empty( $metadata['alt_text'] ) ) {
            update_post_meta( $attachment_id, '_wp_attachment_image_alt', sanitize_text_field( $metadata['alt_text'] ) );
        }

        // Store external ID
        update_post_meta( $attachment_id, self::EXTERNAL_ID_META, sanitize_text_field( $metadata['external_id'] ) );

        // Store keywords
        if ( ! empty( $metadata['keywords'] ) ) {
            $keywords = is_array( $metadata['keywords'] )
                ? array_map( 'sanitize_text_field', $metadata['keywords'] )
                : array_map( 'trim', array_map( 'sanitize_text_field', explode( ',', $metadata['keywords'] ) ) );

            update_post_meta( $attachment_id, self::KEYWORDS_META, $keywords );
        }

        // Log successful upload
        $this->log_upload( $attachment_id, $metadata['external_id'] );

        // Return result
        return $this->format_upload_result( $attachment_id, $metadata['external_id'] );
    }

    /**
     * Validate an uploaded file
     *
     * @param array $file The uploaded file from $_FILES
     * @return true|WP_Error True if valid, WP_Error otherwise
     */
    public function validate_file( $file ) {
        // Check if file exists
        if ( empty( $file['tmp_name'] ) || ! is_uploaded_file( $file['tmp_name'] ) ) {
            return new WP_Error(
                'no_file',
                __( 'No file was uploaded.', 'newscreens-media-uploader' ),
                array( 'status' => 400 )
            );
        }

        // Check for upload errors
        if ( $file['error'] !== UPLOAD_ERR_OK ) {
            return new WP_Error(
                'upload_error',
                $this->get_upload_error_message( $file['error'] ),
                array( 'status' => 400 )
            );
        }

        // Check file size
        $max_size = (int) get_option( 'newscreens_max_file_size', 10 ) * 1024 * 1024; // Convert MB to bytes
        if ( $file['size'] > $max_size ) {
            return new WP_Error(
                'file_too_large',
                sprintf(
                    /* translators: %d: max file size in MB */
                    __( 'File size exceeds maximum allowed size of %d MB.', 'newscreens-media-uploader' ),
                    get_option( 'newscreens_max_file_size', 10 )
                ),
                array( 'status' => 400 )
            );
        }

        // Verify MIME type
        $allowed_types = $this->get_allowed_mimes();
        $file_info = wp_check_filetype( $file['name'], $allowed_types );

        if ( ! $file_info['type'] ) {
            return new WP_Error(
                'invalid_file_type',
                __( 'File type not allowed. Allowed types: PNG, JPG, GIF, WebP.', 'newscreens-media-uploader' ),
                array( 'status' => 400 )
            );
        }

        // Additional MIME verification using getimagesize
        $image_info = @getimagesize( $file['tmp_name'] );
        if ( ! $image_info ) {
            return new WP_Error(
                'not_an_image',
                __( 'The uploaded file is not a valid image.', 'newscreens-media-uploader' ),
                array( 'status' => 400 )
            );
        }

        // Sanitize filename to prevent directory traversal
        $filename = sanitize_file_name( $file['name'] );
        if ( $filename !== $file['name'] && strpos( $file['name'], '..' ) !== false ) {
            return new WP_Error(
                'invalid_filename',
                __( 'Invalid filename detected.', 'newscreens-media-uploader' ),
                array( 'status' => 400 )
            );
        }

        return true;
    }

    /**
     * Get allowed MIME types based on settings
     *
     * @return array Allowed MIME types
     */
    public function get_allowed_mimes() {
        $allowed = get_option( 'newscreens_allowed_types', array( 'png', 'jpg', 'jpeg', 'gif', 'webp' ) );

        $mime_map = array(
            'png'  => 'image/png',
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
        );

        $mimes = array();
        foreach ( $allowed as $ext ) {
            if ( isset( $mime_map[ $ext ] ) ) {
                $mimes[ $ext ] = $mime_map[ $ext ];
            }
        }

        return $mimes;
    }

    /**
     * Format upload result for API response
     *
     * @param int    $attachment_id The attachment ID
     * @param string $external_id   The external ID
     * @return array The formatted result
     */
    public function format_upload_result( $attachment_id, $external_id ) {
        $attachment_metadata = wp_get_attachment_metadata( $attachment_id );

        $result = array(
            'success'       => true,
            'external_id'   => $external_id,
            'attachment_id' => $attachment_id,
            'url'           => wp_get_attachment_url( $attachment_id ),
            'thumbnail_url' => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ),
            'metadata'      => array(
                'width'  => isset( $attachment_metadata['width'] ) ? $attachment_metadata['width'] : 0,
                'height' => isset( $attachment_metadata['height'] ) ? $attachment_metadata['height'] : 0,
                'file'   => isset( $attachment_metadata['file'] ) ? $attachment_metadata['file'] : '',
                'sizes'  => isset( $attachment_metadata['sizes'] ) ? $attachment_metadata['sizes'] : array(),
            ),
        );

        return $result;
    }

    /**
     * Get human-readable upload error message
     *
     * @param int $error_code PHP upload error code
     * @return string Error message
     */
    private function get_upload_error_message( $error_code ) {
        $messages = array(
            UPLOAD_ERR_INI_SIZE   => __( 'The uploaded file exceeds the upload_max_filesize directive in php.ini.', 'newscreens-media-uploader' ),
            UPLOAD_ERR_FORM_SIZE  => __( 'The uploaded file exceeds the MAX_FILE_SIZE directive in the HTML form.', 'newscreens-media-uploader' ),
            UPLOAD_ERR_PARTIAL    => __( 'The uploaded file was only partially uploaded.', 'newscreens-media-uploader' ),
            UPLOAD_ERR_NO_FILE    => __( 'No file was uploaded.', 'newscreens-media-uploader' ),
            UPLOAD_ERR_NO_TMP_DIR => __( 'Missing a temporary folder.', 'newscreens-media-uploader' ),
            UPLOAD_ERR_CANT_WRITE => __( 'Failed to write file to disk.', 'newscreens-media-uploader' ),
            UPLOAD_ERR_EXTENSION  => __( 'A PHP extension stopped the file upload.', 'newscreens-media-uploader' ),
        );

        return isset( $messages[ $error_code ] )
            ? $messages[ $error_code ]
            : __( 'Unknown upload error.', 'newscreens-media-uploader' );
    }

    /**
     * Log successful upload
     *
     * @param int    $attachment_id The attachment ID
     * @param string $external_id   The external ID
     */
    private function log_upload( $attachment_id, $external_id ) {
        if ( ! get_option( 'newscreens_enable_logging', false ) ) {
            return;
        }

        $log_entry = array(
            'time'          => current_time( 'mysql' ),
            'attachment_id' => $attachment_id,
            'external_id'   => $external_id,
        );

        error_log( '[NewScreens] Upload success: ' . wp_json_encode( $log_entry ) );
    }

    /**
     * Find attachment by external ID
     *
     * @param string $external_id The external ID to search for
     * @return int|false Attachment ID or false if not found
     */
    public function find_by_external_id( $external_id ) {
        global $wpdb;

        $attachment_id = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = %s LIMIT 1",
                self::EXTERNAL_ID_META,
                $external_id
            )
        );

        return $attachment_id ? (int) $attachment_id : false;
    }
}
