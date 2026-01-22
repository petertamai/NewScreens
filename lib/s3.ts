import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"

// R2 configuration from environment
const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_BUCKET = process.env.R2_BUCKET
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY

// Create S3 client configured for Cloudflare R2
export const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
})

// Upload a file to R2
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string = "image/png"
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  })
  await s3Client.send(command)
}

// Get a file from R2
export async function getFromR2(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  })
  const response = await s3Client.send(command)

  if (!response.Body) {
    throw new Error("No body in response")
  }

  // Convert the stream to a buffer
  const chunks: Uint8Array[] = []
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

// Delete a file from R2
export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  })
  await s3Client.send(command)
}

// Convert a database filepath to R2 key
// Database stores paths like "/screenshots/folder/file.png"
// R2 keys should be "screenshots/folder/file.png" (no leading slash)
export function filepathToR2Key(filepath: string): string {
  // Remove leading slash if present
  return filepath.replace(/^\//, "")
}

// Convert R2 key back to database filepath format
export function r2KeyToFilepath(key: string): string {
  // Add leading slash for consistency with existing database format
  return key.startsWith("/") ? key : `/${key}`
}
