import { Buffer } from 'node:buffer'
import { HttpError } from './http.js'

const avatarMaxBytes = 1.5 * 1024 * 1024
const allowedAvatarTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

export function blobStatus() {
  return {
    provider: 'vercel_blob',
    configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    missing: process.env.BLOB_READ_WRITE_TOKEN ? [] : ['BLOB_READ_WRITE_TOKEN'],
  }
}

export async function uploadAvatarToBlob({ userId, fileName = 'avatar.jpg', contentType = '', dataUrl = '' } = {}) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new HttpError(501, 'blob_not_configured', '头像对象存储尚未配置，请在 Vercel 添加 BLOB_READ_WRITE_TOKEN。')
  }

  const parsed = parseAvatarDataUrl(dataUrl, contentType)
  const safeName = safeFileName(fileName, parsed.contentType)
  const pathname = `avatars/${userId}/${Date.now()}-${safeName}`
  const { put } = await import('@vercel/blob')
  const blob = await put(pathname, parsed.buffer, {
    access: 'public',
    contentType: parsed.contentType,
    addRandomSuffix: true,
  })

  return {
    provider: 'vercel_blob',
    url: blob.url,
    pathname: blob.pathname,
    contentType: parsed.contentType,
    size: parsed.buffer.length,
  }
}

function parseAvatarDataUrl(dataUrl, fallbackContentType) {
  const value = String(dataUrl || '').trim()
  const match = value.match(/^data:(image\/(?:png|jpe?g|webp));base64,([a-z0-9+/=]+)$/i)
  if (!match) {
    throw new HttpError(400, 'invalid_avatar_upload', '请上传 PNG、JPG 或 WebP 格式的头像。')
  }

  const contentType = normalizeContentType(match[1] || fallbackContentType)
  if (!allowedAvatarTypes.has(contentType)) {
    throw new HttpError(400, 'unsupported_avatar_type', '头像只支持 PNG、JPG 或 WebP。')
  }

  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > avatarMaxBytes) {
    throw new HttpError(400, 'avatar_too_large', '头像图片请控制在 1.5MB 以内。')
  }

  return { contentType, buffer }
}

function normalizeContentType(value) {
  const text = String(value || '').trim().toLowerCase()
  if (text === 'image/jpg') return 'image/jpeg'
  return text
}

function safeFileName(fileName, contentType) {
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  const base = String(fileName || `avatar.${extension}`)
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'avatar'}.${extension}`
}
