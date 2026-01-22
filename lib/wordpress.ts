/**
 * WordPress API Client
 *
 * Handles communication with the NewScreens Media Uploader WordPress plugin.
 */

export interface WordPressUploadResult {
  success: boolean
  external_id: string
  attachment_id: number
  url: string
  thumbnail_url?: string
  metadata?: {
    width: number
    height: number
    file: string
    sizes: Record<string, unknown>
  }
}

export interface WordPressUploadError {
  success: false
  code: string
  message: string
}

export interface WordPressTestResult {
  success: boolean
  message: string
  site: string
  url: string
  version: string
}

export interface UploadParams {
  file: Buffer | Blob
  filename: string
  externalId: string
  title?: string
  caption?: string
  altText?: string
  description?: string
  keywords?: string[]
}

/**
 * Get MIME type from filename extension
 */
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
  }
  return mimeTypes[ext || ''] || 'image/png'
}

/**
 * WordPress API Client class
 */
export class WordPressClient {
  private siteUrl: string
  private apiKey: string

  constructor(siteUrl: string, apiKey: string) {
    // Normalize site URL - remove trailing slash
    this.siteUrl = siteUrl.replace(/\/+$/, '')
    this.apiKey = apiKey
  }

  /**
   * Get the API endpoint URL
   */
  private getEndpoint(path: string): string {
    return `${this.siteUrl}/wp-json/newscreens/v1${path}`
  }

  /**
   * Test connection to WordPress
   */
  async testConnection(): Promise<WordPressTestResult> {
    const response = await fetch(this.getEndpoint('/test'), {
      method: 'GET',
      headers: {
        'X-NewScreens-API-Key': this.apiKey,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Connection failed' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  /**
   * Upload a single image to WordPress
   */
  async uploadImage(params: UploadParams): Promise<WordPressUploadResult> {
    const formData = new FormData()

    // Add file - handle both Buffer (Node.js) and Blob (browser)
    const mimeType = getMimeType(params.filename)
    const fileSize = Buffer.isBuffer(params.file) ? params.file.length : (params.file as Blob).size

    console.log('[WP Upload] Starting upload:', {
      filename: params.filename,
      mimeType,
      fileSize,
      externalId: params.externalId,
      endpoint: this.getEndpoint('/upload'),
    })

    if (Buffer.isBuffer(params.file)) {
      // Convert Buffer to Blob with proper MIME type
      const blob = new Blob([new Uint8Array(params.file)], { type: mimeType })
      formData.append('file', blob, params.filename)
      console.log('[WP Upload] Created Blob from Buffer, size:', blob.size, 'type:', blob.type)
    } else {
      formData.append('file', params.file, params.filename)
      console.log('[WP Upload] Using existing Blob, size:', params.file.size, 'type:', params.file.type)
    }

    // Add required external_id
    formData.append('external_id', params.externalId)

    // Add optional metadata
    if (params.title) {
      formData.append('title', params.title)
    }
    if (params.caption) {
      formData.append('caption', params.caption)
    }
    if (params.altText) {
      formData.append('alt_text', params.altText)
    }
    if (params.description) {
      formData.append('description', params.description)
    }
    if (params.keywords && params.keywords.length > 0) {
      formData.append('keywords', params.keywords.join(', '))
    }

    const response = await fetch(this.getEndpoint('/upload'), {
      method: 'POST',
      headers: {
        'X-NewScreens-API-Key': this.apiKey,
      },
      body: formData,
    })

    console.log('[WP Upload] Response status:', response.status, response.statusText)
    console.log('[WP Upload] Response headers:', Object.fromEntries(response.headers.entries()))

    const responseText = await response.text()
    console.log('[WP Upload] Response body (raw):', responseText)

    let result
    try {
      result = JSON.parse(responseText)
      console.log('[WP Upload] Response body (parsed):', result)
    } catch (e) {
      console.error('[WP Upload] Failed to parse JSON response:', e)
      throw new Error(`Invalid JSON response from WordPress: ${responseText.substring(0, 500)}`)
    }

    if (!response.ok || !result.success) {
      console.error('[WP Upload] Upload failed:', {
        status: response.status,
        success: result.success,
        code: result.code,
        message: result.message,
        fullResult: result,
      })
      throw new Error(result.message || `Upload failed with status ${response.status}`)
    }

    console.log('[WP Upload] Upload successful:', result)
    return result as WordPressUploadResult
  }
}

/**
 * Create a WordPress client from settings
 */
export async function createWordPressClient(
  getSetting: (key: string) => Promise<string | null>
): Promise<WordPressClient | null> {
  const siteUrl = await getSetting('wordpress_site_url')
  const apiKey = await getSetting('wordpress_api_key')

  if (!siteUrl || !apiKey) {
    return null
  }

  return new WordPressClient(siteUrl, apiKey)
}
