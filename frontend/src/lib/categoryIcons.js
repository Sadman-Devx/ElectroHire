import {
  Bug,
  Hammer,
  Lightbulb,
  Paintbrush,
  Snowflake,
  SprayCan,
  Wind,
  Wrench,
} from 'lucide-react'

/**
 * Category.icon (backend) is a short free-text key, e.g. "bulb", "ac"
 * (see backend/providers/tests.py for the two confirmed real values).
 * The rest of these are best-guess keys for the trade categories a
 * home-services marketplace like this would seed — safe to extend as
 * real category data comes in. Anything unrecognised falls back to
 * `Wrench` so the UI never breaks on an unmapped icon key.
 */
const ICON_MAP = {
  bulb: Lightbulb,
  electrician: Lightbulb,
  ac: Snowflake,
  'ac-repair': Snowflake,
  fan: Wind,
  pipe: Wrench,
  plumber: Wrench,
  carpenter: Hammer,
  hammer: Hammer,
  paint: Paintbrush,
  painter: Paintbrush,
  clean: SprayCan,
  cleaner: SprayCan,
  cleaning: SprayCan,
  pest: Bug,
  'pest-control': Bug,
}

export function getCategoryIcon(iconKey) {
  if (!iconKey) return Wrench
  return ICON_MAP[iconKey.toLowerCase()] || Wrench
}

export default getCategoryIcon