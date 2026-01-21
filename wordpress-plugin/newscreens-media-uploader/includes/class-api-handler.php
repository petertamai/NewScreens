<?php
/**
 * API Handler
 *
 * Handles REST API endpoint registration and request processing.
 *
 * @package NewScreens_Media_Uploader
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class NewScreens_API_Handler
 *
 * Manages REST API endpoints for media uploads.
 */
class NewScreens_API_Handler {

    /**
     * REST API namespace
     *
     * @var string
     */
    const NAMESPACE = 'newscreens/v1';

    /**
     * Auth handler instance
     *
     * @var NewScreens_Auth_Handler
     */
    private $auth;

    /**
     * Media handler instance
     *
     * @var NewScreens_Media_Handler
     */
    private $media;

    /**
     * Constructor
     *
     * @param NewScreens_Auth_Handler  $auth  Auth handler instance
     * @param NewScreens_Media_Handler $media Media handler instance
     */
    public function __construct( $auth, $media ) {
        $this->auth = $auth;
        $this->media = $media;
    }

    /**
     * Register REST API routes
     */
    public function register_routes() {
        // Single upload endpoint
        register_rest_route(
            self::NAMESPACE,
            '/upload',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_upload' ),
                'permission_callback' => array( $this->auth, 'check_permission' ),
            )
        );

        // Batch upload endpoint
        register_rest_route(
            self::NAMESPACE,
            '/upload-batch',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_batch_upload' ),
                'permission_callback' => array( $this->auth, 'check_permission' ),
            )
        );

        // Test connection endpoint
        register_rest_route(
            self::NAMESPACE,
            '/test',
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( $this, 'handle_test' ),
                'permission_callback' => array( $this->auth, 'check_permission' ),
            )
        );
    }

    /**
     * Handle single file upload
     *
     * @param WP_REST_Request $request The REST request object
     * @return WP_REST_Response|WP_Error
     */
    public function handle_upload( $request ) {
        // Check if file was uploaded
        $files = $request->get_file_params();

        if ( empty( $files['file'] ) ) {
            return new WP_Error(
                'no_file',
                __( 'No file provided. Send file as multipart/form-data with field name "file".', 'newscreens-media-uploader' ),
                array( 'status' => 400 )
            );
        }

        // Get metadata from request
        $params = $request->get_params();
        $metadata = array(
            'external_id' => isset( $params['external_id'] ) ? $params['external_id'] : '',
            'title'       => isset( $params['title'] ) ? $params['title'] : '',
            'caption'     => isset( $params['caption'] ) ? $params['caption'] : '',
            'alt_text'    => isset( $params['alt_text'] ) ? $params['alt_text'] : '',
            'description' => isset( $params['description'] ) ? $params['description'] : '',
            'keywords'    => isset( $params['keywords'] ) ? $params['keywords'] : '',
        );

        // Process upload
        $result = $this->media->process_upload( $files['file'], $metadata );

        if ( is_wp_error( $result ) ) {
            $error_data = $result->get_error_data();
            $status = isset( $error_data['status'] ) ? $error_data['status'] : 500;

            return new WP_REST_Response(
                array(
                    'success' => false,
                    'code'    => $result->get_error_code(),
                    'message' => $result->get_error_message(),
                ),
                $status
            );
        }

        return new WP_REST_Response( $result, 200 );
    }

    /**
     * Handle batch file upload
     *
     * @param WP_REST_Request $request The REST request object
     * @return WP_REST_Response|WP_Error
     */
    public function handle_batch_upload( $request ) {
        // Check if files were uploaded
        $files = $request->get_file_params();

        if ( empty( $files['files'] ) ) {
            return new WP_Error(
                'no_files',
                __( 'No files provided. Send files as multipart/form-data with field name "files[]".', 'newscreens-media-uploader' ),
                array( 'status' => 400 )
            );
        }

        // Get metadata from request
        $params = $request->get_params();
        $metadata_json = isset( $params['metadata'] ) ? $params['metadata'] : '[]';

        // Parse metadata JSON
        $metadata_array = json_decode( $metadata_json, true );
        if ( json_last_error() !== JSON_ERROR_NONE ) {
            return new WP_Error(
                'invalid_metadata',
                __( 'Invalid metadata JSON format.', 'newscreens-media-uploader' ),
                array( 'status' => 400 )
            );
        }

        // Normalize files array structure
        $files_array = $this->normalize_files_array( $files['files'] );

        if ( empty( $files_array ) ) {
            return new WP_Error(
                'no_valid_files',
                __( 'No valid files found in the request.', 'newscreens-media-uploader' ),
                array( 'status' => 400 )
            );
        }

        $results = array();
        $failed = array();

        foreach ( $files_array as $index => $file ) {
            // Get metadata for this file
            $file_metadata = isset( $metadata_array[ $index ] ) ? $metadata_array[ $index ] : array();

            // Ensure external_id is present
            if ( empty( $file_metadata['external_id'] ) ) {
                $failed[] = array(
                    'index'   => $index,
                    'error'   => 'missing_external_id',
                    'message' => __( 'external_id is required for each file.', 'newscreens-media-uploader' ),
                );
                continue;
            }

            $metadata = array(
                'external_id' => $file_metadata['external_id'],
                'title'       => isset( $file_metadata['title'] ) ? $file_metadata['title'] : '',
                'caption'     => isset( $file_metadata['caption'] ) ? $file_metadata['caption'] : '',
                'alt_text'    => isset( $file_metadata['alt_text'] ) ? $file_metadata['alt_text'] : '',
                'description' => isset( $file_metadata['description'] ) ? $file_metadata['description'] : '',
                'keywords'    => isset( $file_metadata['keywords'] ) ? $file_metadata['keywords'] : '',
            );

            $result = $this->media->process_upload( $file, $metadata );

            if ( is_wp_error( $result ) ) {
                $failed[] = array(
                    'index'       => $index,
                    'external_id' => $metadata['external_id'],
                    'error'       => $result->get_error_code(),
                    'message'     => $result->get_error_message(),
                );
            } else {
                $results[] = array(
                    'external_id'   => $result['external_id'],
                    'attachment_id' => $result['attachment_id'],
                    'url'           => $result['url'],
                );
            }
        }

        return new WP_REST_Response(
            array(
                'success' => count( $failed ) === 0,
                'results' => $results,
                'failed'  => $failed,
            ),
            200
        );
    }

    /**
     * Handle test connection
     *
     * @param WP_REST_Request $request The REST request object
     * @return WP_REST_Response
     */
    public function handle_test( $request ) {
        return new WP_REST_Response(
            array(
                'success' => true,
                'message' => __( 'Connection successful! API key is valid.', 'newscreens-media-uploader' ),
                'site'    => get_bloginfo( 'name' ),
                'url'     => get_bloginfo( 'url' ),
                'version' => NEWSCREENS_VERSION,
            ),
            200
        );
    }

    /**
     * Normalize files array from $_FILES format
     *
     * PHP $_FILES array has a weird structure for multiple files:
     * files[name][0], files[name][1] instead of files[0][name], files[1][name]
     *
     * @param array $files The files array from $_FILES
     * @return array Normalized array of file arrays
     */
    private function normalize_files_array( $files ) {
        // Check if already normalized (single file)
        if ( isset( $files['name'] ) && ! is_array( $files['name'] ) ) {
            return array( $files );
        }

        // Multiple files - normalize the structure
        $normalized = array();

        if ( isset( $files['name'] ) && is_array( $files['name'] ) ) {
            $count = count( $files['name'] );

            for ( $i = 0; $i < $count; $i++ ) {
                $normalized[] = array(
                    'name'     => $files['name'][ $i ],
                    'type'     => $files['type'][ $i ],
                    'tmp_name' => $files['tmp_name'][ $i ],
                    'error'    => $files['error'][ $i ],
                    'size'     => $files['size'][ $i ],
                );
            }
        }

        return $normalized;
    }
}
