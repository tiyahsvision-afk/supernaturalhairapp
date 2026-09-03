// Real catalog data pulled from the connected Shopify store (shcbeauty.com).
// Variant IDs power the cart permalinks used by the Reorder feature so a tap
// goes straight to a pre-filled Shopify checkout — no separate storefront
// integration required for this MVP.

export const SHOP_DOMAIN = 'shcbeauty.com'

export interface ShcProduct {
  id: string
  handle: string
  title: string
  shortName: string
  price: number
  variantId: string
  image: string
  description: string
  /** true for the five core Journey Kit steps used by the consultation engine */
  isCoreStep: boolean
}

export const PRODUCTS: ShcProduct[] = [
  {
    id: 'detox-shampoo',
    handle: 'detox-shampoo',
    title: 'DETOX Shampoo',
    shortName: 'Detox Shampoo',
    price: 16,
    variantId: '47453916102965',
    image:
      'https://cdn.shopify.com/s/files/1/0848/1407/0069/files/SHCdetox.jpg?v=1779808904',
    description:
      'Passion fruit, acai fruit oil, and burdock extract gently cleanse without stripping.',
    isCoreStep: true,
  },
  {
    id: 'remedy-conditioner',
    handle: 'remedy-conditioner',
    title: 'REMEDY Conditioner',
    shortName: 'Remedy Conditioner',
    price: 16,
    variantId: '47454189519157',
    image:
      'https://cdn.shopify.com/s/files/1/0848/1407/0069/files/Remedy_Conditioner.jpg?v=1779809665',
    description:
      'Passion fruit, aloe vera, and burdock root restore your crown to its former glory.',
    isCoreStep: true,
  },
  {
    id: 'nourish-moisturizer',
    handle: 'nourish-nourishing-moisturizer',
    title: 'NOURISH Nourishing Moisturizer',
    shortName: 'Nourish Moisturizer',
    price: 16,
    variantId: '47454196629813',
    image:
      'https://cdn.shopify.com/s/files/1/0848/1407/0069/files/nourish_moisturizer.jpg?v=1779812756',
    description:
      'Flax seed, aloe vera, oatstraw and kelp extract for an abundance of leave-in moisture.',
    isCoreStep: true,
  },
  {
    id: 'hair-growth-oil',
    handle: 'hair-growth-oil',
    title: 'GROW Hair Growth Oil',
    shortName: 'Grow Oil',
    price: 16,
    variantId: '47454193713461',
    image:
      'https://cdn.shopify.com/s/files/1/0848/1407/0069/files/Hair_Growth_shc.jpg?v=1779810791',
    description:
      'Castor, vitamin E, argan, nettle, fenugreek and peppermint nourish through the scalp.',
    isCoreStep: true,
  },
  {
    id: 'rest-scalp-massage-oil',
    handle: 'rest-scalp-massage-oil',
    title: 'REST Scalp Massage Oil',
    shortName: 'Rest Scalp Oil',
    price: 16,
    variantId: '47454194827573',
    image:
      'https://cdn.shopify.com/s/files/1/0848/1407/0069/files/Scalp_massage_oil.jpg?v=1779810991',
    description:
      'Almond, jojoba and chamomile alleviate tenderness and relax an itchy, tense scalp.',
    isCoreStep: true,
  },
  {
    id: 'scalp-massaging-brush',
    handle: 'rest-scalp-massaging-brush',
    title: 'REST Scalp Massaging Brush',
    shortName: 'Massage Brush',
    price: 6,
    variantId: '47454197776693',
    image:
      'https://cdn.shopify.com/s/files/1/0848/1407/0069/files/Screenshot2023-11-18at3.55.04PM.png?v=1700340949',
    description:
      'Long silicone bristles relieve stress and stimulate circulation for hair growth.',
    isCoreStep: false,
  },
  {
    id: 'journey-kit',
    handle: 'supernatural-hair-care-complete-journey-kit',
    title: 'SHC ESSENTIALS Journey Kit',
    shortName: 'Journey Kit',
    price: 70,
    variantId: '47454199710005',
    image:
      'https://cdn.shopify.com/s/files/1/0848/1407/0069/files/grok-image-37bfc419-5d21-44c4-939a-b1f493229291.jpg?v=1779811319',
    description:
      'One purchase, a five-step hair care journey — every core step in this app, in one box.',
    isCoreStep: false,
  },
  {
    id: 'discovery-kit',
    handle: 'supernatural-discovery-kit',
    title: 'Supernatural Discovery Kit',
    shortName: 'Discovery Kit',
    price: 24.99,
    variantId: '50043137622325',
    image:
      'https://cdn.shopify.com/s/files/1/0848/1407/0069/files/IMG_3377.jpg?v=1726502981',
    description: 'Travel-friendly set to experience the full Supernatural system.',
    isCoreStep: false,
  },
]

export const MAIL_CLUB_PRODUCT = {
  handle: 'supernatural-mail-club',
  title: 'Supernatural Mail Club',
  price: 8.99,
  variantId: '53279429558581',
  image:
    'https://cdn.shopify.com/s/files/1/0848/1407/0069/files/4fd304f9-5ff2-4025-93f9-a694734ce016.jpg?v=1786639781',
}

export const CORE_STEP_PRODUCTS = PRODUCTS.filter((p) => p.isCoreStep)

export function getProduct(id: string): ShcProduct | undefined {
  return PRODUCTS.find((p) => p.id === id)
}

export function productPageUrl(handle: string) {
  return `https://${SHOP_DOMAIN}/products/${handle}`
}

/** Shopify cart permalink — adds variant(s) straight to cart and heads to checkout. */
export function cartPermalink(lines: { variantId: string; quantity?: number }[]) {
  const path = lines
    .map((l) => `${l.variantId}:${l.quantity ?? 1}`)
    .join(',')
  return `https://${SHOP_DOMAIN}/cart/${path}`
}

export function reorderSingleUrl(productId: string) {
  const product = getProduct(productId)
  if (!product) return `https://${SHOP_DOMAIN}`
  return cartPermalink([{ variantId: product.variantId }])
}

export function reorderKitUrl() {
  const kit = getProduct('journey-kit')!
  return cartPermalink([{ variantId: kit.variantId }])
}

export function reorderManyUrl(productIds: string[]) {
  const lines = productIds
    .map((id) => getProduct(id))
    .filter((p): p is ShcProduct => Boolean(p))
    .map((p) => ({ variantId: p.variantId }))
  return cartPermalink(lines)
}
