/**
 * Phase 3: small text/format helpers for the AI Assistant UI.
 *
 * The backend replies in the language the customer wrote in
 * (result.language is "bn" or "en"), so the labels that frame that
 * reply switch with it. The rest of the site chrome stays English.
 */

export const MAX_PROBLEM_LENGTH = 1000
export const MIN_PROBLEM_LENGTH = 5
export const MAX_AREA_LENGTH = 100

export const TEXT = {
  en: {
    category: 'Category',
    categoryUnclear: 'Category unclear',
    urgency: 'Urgency',
    safetyTips: 'Safety tips before the professional arrives',
    costTitle: 'Estimated cost',
    costNote: 'This is only a rough estimate',
    sources: 'Sources',
    sourcesNote: 'Found on the web — not verified by us',
    emergencyTitle: 'This looks like an emergency',
    emergencyBody:
      'Follow the first safety tip right now, keep away from the danger, and contact a professional. If anyone is in immediate danger, call 999.',
    providersTitle: 'Recommended providers',
    contact: 'Contact',
    book: 'Book',
    draftWithAI: 'Draft with AI',
    otherAreas: 'Available in other areas',
    otherCategories: 'Try another category',
    browseAll: 'Browse all providers',
  },
  bn: {
    category: 'ক্যাটাগরি',
    categoryUnclear: 'ক্যাটাগরি স্পষ্ট নয়',
    urgency: 'জরুরি মাত্রা',
    safetyTips: 'পেশাদার আসার আগে নিরাপত্তা পরামর্শ',
    costTitle: 'আনুমানিক খরচ',
    costNote: 'এটি শুধু একটি মোটামুটি আন্দাজ',
    sources: 'সূত্র',
    sourcesNote: 'ওয়েব থেকে পাওয়া — আমরা যাচাই করিনি',
    emergencyTitle: 'এটি একটি জরুরি অবস্থা মনে হচ্ছে',
    emergencyBody:
      'এখনই প্রথম নিরাপত্তা পরামর্শটি অনুসরণ করুন, বিপদ থেকে দূরে থাকুন এবং একজন পেশাদারের সাথে যোগাযোগ করুন। কেউ তাৎক্ষণিক বিপদে থাকলে ৯৯৯-এ কল করুন।',
    providersTitle: 'প্রস্তাবিত প্রোভাইডার',
    contact: 'যোগাযোগ',
    book: 'বুক করুন',
    draftWithAI: 'AI দিয়ে ড্রাফট',
    otherAreas: 'অন্য এলাকায় পাওয়া যাচ্ছে',
    otherCategories: 'অন্য ক্যাটাগরি দেখুন',
    browseAll: 'সব প্রোভাইডার দেখুন',
  },
}

export function textFor(language) {
  return TEXT[language] || TEXT.en
}

// Badge colours per urgency level. "emergency" is deliberately the
// loudest (solid red); the others step down in intensity.
export const URGENCY_STYLES = {
  low: {
    label: { en: 'Low', bn: 'কম' },
    className: 'border-green-200 bg-green-50 text-green-700',
  },
  medium: {
    label: { en: 'Medium', bn: 'মাঝারি' },
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  high: {
    label: { en: 'High', bn: 'বেশি' },
    className: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  emergency: {
    label: { en: 'Emergency', bn: 'জরুরি' },
    className: 'border-red-600 bg-red-600 text-white',
  },
}

export function urgencyStyle(urgency) {
  return URGENCY_STYLES[urgency] || URGENCY_STYLES.medium
}

function formatTaka(value) {
  return `৳${Number(value).toLocaleString('en-US')}`
}

export function formatCostRange(cost) {
  if (!cost) return ''
  return cost.min === cost.max
    ? formatTaka(cost.min)
    : `${formatTaka(cost.min)} – ${formatTaka(cost.max)}`
}

/**
 * Keep only sources whose link is a plain http(s) URL. The backend
 * already filters, but this is the last line of defence against a
 * "javascript:" link ever reaching an href.
 */
export function safeSources(sources) {
  if (!Array.isArray(sources)) return []
  return sources.filter(
    (source) => source && typeof source.url === 'string' && /^https?:\/\//i.test(source.url)
  )
}
