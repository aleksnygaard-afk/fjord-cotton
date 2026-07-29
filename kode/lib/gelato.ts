const ORDER_BASE = 'https://order.gelatoapis.com'
const ECOM_BASE = 'https://ecommerce.gelatoapis.com'

function key() {
  const k = process.env.GELATO_API_KEY
  if (!k) throw new Error('GELATO_API_KEY is not set')
  return k
}

export class GelatoError extends Error {
  status: number
  retryable: boolean
  constructor(status: number, body: string) {
    super(`Gelato ${status}: ${body.slice(0, 400)}`)
    this.status = status
    // 400/401/404 mean the request itself is wrong — retrying sends the same broken body.
    this.retryable = status === 429 || status >= 500
  }
}

async function call(url: string, init: RequestInit = {}, attempt = 0): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': key(), ...(init.headers ?? {}) },
    cache: 'no-store',
  })

  if (res.ok) return res.status === 204 ? null : res.json()

  const err = new GelatoError(res.status, await res.text())
  // Exponential backoff with jitter. Publishing ten designs bursts ten calls, so 429 is
  // the one you actually hit.
  if (err.retryable && attempt < 5) {
    const wait = 2 ** attempt * 1000 + Math.random() * 400
    await new Promise((r) => setTimeout(r, wait))
    return call(url, init, attempt + 1)
  }
  throw err
}

export type TemplateVariant = {
  id: string
  title: string
  productUid: string
  variantOptions?: { name: string; value: string }[]
  imagePlaceholders?: { name: string; printArea: string; width: number; height: number }[]
}

export function getTemplate(templateId = process.env.GELATO_TEMPLATE_ID!) {
  return call(`${ECOM_BASE}/v1/templates/${templateId}`) as Promise<{
    id: string
    variants: TemplateVariant[]
  }>
}

/**
 * Creates the store product and returns immediately with status 'created'. Variants and
 * mockups are published in the background — poll getProduct or wait for the webhook.
 */
export function createProductFromTemplate(args: {
  title: string
  description?: string
  printFileUrl: string
  placeholderName?: string
  externalId?: string
}) {
  const storeId = process.env.GELATO_STORE_ID
  if (!storeId) throw new Error('GELATO_STORE_ID is not set')

  return call(`${ECOM_BASE}/v1/stores/${storeId}/products:create-from-template`, {
    method: 'POST',
    body: JSON.stringify({
      templateId: process.env.GELATO_TEMPLATE_ID,
      title: args.title,
      description: args.description ?? '',
      isVisibleInTheOnlineStore: true,
      salesChannels: ['web'],
      // Stable reference so a retry does not create a second product.
      externalId: args.externalId,
      variants: [],
      productImagePlaceholders: [
        { name: args.placeholderName ?? 'ImageFront', fileUrl: args.printFileUrl },
      ],
    }),
  }) as Promise<{ id: string; status: string }>
}

export function getProduct(productId: string) {
  const storeId = process.env.GELATO_STORE_ID!
  return call(`${ECOM_BASE}/v1/stores/${storeId}/products/${productId}`) as Promise<{
    id: string
    status: 'created' | 'publishing' | 'publishing_error' | 'active'
    previewUrl: string | null
    publishingErrorCode: string | null
    variants: { id: string; title: string; productUid: string }[]
  }>
}

/** Size lives inside the productUid, so we store one pattern per colour. */
export function resolveGelatoUid(pattern: string | null, sizeKey: string): string {
  if (!pattern || !pattern.includes('{size}')) {
    throw new Error(`Missing Gelato UID pattern (size ${sizeKey})`)
  }
  // Gelato labels 2XL as '2xl'; our key is 'xxl'.
  const gelatoSize = sizeKey === 'xxl' ? '2xl' : sizeKey
  return pattern.replace('{size}', gelatoSize)
}

export function createOrder(body: unknown) {
  return call(`${ORDER_BASE}/v4/orders`, { method: 'POST', body: JSON.stringify(body) })
}
