/**
 * NewScreens Media Uploader Admin JavaScript
 *
 * @package NewScreens_Media_Uploader
 */

(function($) {
    'use strict';

    $(document).ready(function() {
        // Copy API key to clipboard
        $('#newscreens-copy-key').on('click', function() {
            var $button = $(this);
            var apiKey = $('#newscreens_api_key').val();

            // Use the modern Clipboard API if available
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(apiKey).then(function() {
                    showCopySuccess($button);
                }).catch(function() {
                    fallbackCopy(apiKey, $button);
                });
            } else {
                fallbackCopy(apiKey, $button);
            }
        });

        // Regenerate API key
        $('#newscreens-regenerate-key').on('click', function() {
            var $button = $(this);

            if (!confirm(newscreensAdmin.i18n.confirmRegenerate)) {
                return;
            }

            $button.prop('disabled', true).text(newscreensAdmin.i18n.regenerating);

            $.ajax({
                url: newscreensAdmin.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'newscreens_regenerate_key',
                    nonce: newscreensAdmin.nonce
                },
                success: function(response) {
                    if (response.success) {
                        $('#newscreens_api_key').val(response.data.api_key);
                        alert(response.data.message);
                    } else {
                        alert(response.data.message || 'An error occurred.');
                    }
                },
                error: function() {
                    alert('An error occurred while regenerating the API key.');
                },
                complete: function() {
                    $button.prop('disabled', false).text(newscreensAdmin.i18n.regenerate);
                }
            });
        });

        /**
         * Fallback copy method for older browsers
         */
        function fallbackCopy(text, $button) {
            var $temp = $('<input>');
            $('body').append($temp);
            $temp.val(text).select();

            try {
                document.execCommand('copy');
                showCopySuccess($button);
            } catch (err) {
                alert('Failed to copy. Please select and copy manually.');
            }

            $temp.remove();
        }

        /**
         * Show copy success feedback
         */
        function showCopySuccess($button) {
            var originalText = $button.text();
            $button.text(newscreensAdmin.i18n.copied);

            setTimeout(function() {
                $button.text(originalText);
            }, 2000);
        }
    });
})(jQuery);
