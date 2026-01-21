=== NewScreens Media Uploader ===
Contributors: newscreensteam
Tags: media, upload, api, rest, screenshots
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

Secure REST API endpoint for uploading images with metadata from the NewScreensNext application.

== Description ==

NewScreens Media Uploader provides a secure REST API endpoint that allows the NewScreensNext application to upload processed screenshots directly to the WordPress media library.

**Features:**

* Secure API key authentication
* Single and batch file upload endpoints
* Support for metadata (title, caption, alt text, description, keywords)
* External ID tracking for database matching
* Configurable file size limits and allowed file types
* Debug logging for troubleshooting

**API Endpoints:**

* `POST /wp-json/newscreens/v1/upload` - Single file upload
* `POST /wp-json/newscreens/v1/upload-batch` - Batch file upload
* `GET /wp-json/newscreens/v1/test` - Test connection

== Installation ==

1. Upload the `newscreens-media-uploader` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings > NewScreens Uploader to view your API key
4. Configure the NewScreensNext application with your WordPress URL and API key

== Frequently Asked Questions ==

= How do I get the API key? =

After activating the plugin, go to Settings > NewScreens Uploader. The API key is automatically generated and displayed on the settings page.

= How do I regenerate the API key? =

Click the "Regenerate Key" button on the settings page. Note that the old key will immediately stop working.

= What file types are supported? =

By default, the plugin supports PNG, JPG, JPEG, GIF, and WebP images. You can configure allowed types on the settings page.

= What is the maximum file size? =

The default maximum file size is 10MB. You can change this to 5MB, 20MB, or 50MB on the settings page. Note that your server's PHP configuration may also limit upload sizes.

== Changelog ==

= 1.0.0 =
* Initial release
* Single and batch upload endpoints
* API key authentication
* Configurable settings
* External ID tracking

== Upgrade Notice ==

= 1.0.0 =
Initial release.

== API Documentation ==

**Authentication:**

Include the API key in the `X-NewScreens-API-Key` header for all requests.

**Single Upload Request:**

```
POST /wp-json/newscreens/v1/upload
Content-Type: multipart/form-data
X-NewScreens-API-Key: your-api-key

file: [binary file data]
external_id: 123 (required)
title: Image Title
caption: Image caption
alt_text: Alt text for accessibility
description: Full description
keywords: keyword1, keyword2, keyword3
```

**Single Upload Response:**

```json
{
  "success": true,
  "external_id": "123",
  "attachment_id": 1234,
  "url": "https://yoursite.com/wp-content/uploads/2024/01/image.png",
  "thumbnail_url": "https://yoursite.com/wp-content/uploads/2024/01/image-150x150.png",
  "metadata": {
    "width": 1920,
    "height": 1080,
    "file": "2024/01/image.png",
    "sizes": { ... }
  }
}
```

**Batch Upload Request:**

```
POST /wp-json/newscreens/v1/upload-batch
Content-Type: multipart/form-data
X-NewScreens-API-Key: your-api-key

files[]: [binary file data]
files[]: [binary file data]
metadata: [{"external_id": "123", "title": "Image 1"}, {"external_id": "124", "title": "Image 2"}]
```

**Batch Upload Response:**

```json
{
  "success": true,
  "results": [
    {"external_id": "123", "attachment_id": 1234, "url": "..."},
    {"external_id": "124", "attachment_id": 1235, "url": "..."}
  ],
  "failed": []
}
```

**Error Response:**

```json
{
  "success": false,
  "code": "error_code",
  "message": "Human readable error message"
}
```
