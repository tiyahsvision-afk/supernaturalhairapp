import type { ProductPlanItem, ScheduleItem } from './types'
import { addDays, toDateKey } from './date'
import { newId } from './id'

const TIME_OF_DAY_BY_PRODUCT: Record<string, ScheduleItem['timeOfDay']> = {
  'detox-shampoo': 'wash-day',
  'remedy-conditioner': 'wash-day',
  'hair-growth-oil': 'evening',
  'rest-scalp-massage-oil': 'evening',
  'nourish-moisturizer': 'morning',
}

/**
 * Spreads a product's weekly frequency evenly across the next 7 days
 * starting today, e.g. 3x/week -> every ~2-3 days.
 */
export function generateWeekFromPlan(plan: ProductPlanItem[], startDate = new Date()): ScheduleItem[] {
  const items: ScheduleItem[] = []
  const days = 7

  for (const step of plan) {
    const times = Math.max(1, Math.round(step.timesPerWeek))
    const count = Math.min(times, days)
    const stride = days / count
    for (let i = 0; i < count; i++) {
      const offset = Math.round(i * stride)
      const date = toDateKey(addDays(startDate, offset))
      items.push({
        id: newId(),
        date,
        productId: step.productId,
        timeOfDay: TIME_OF_DAY_BY_PRODUCT[step.productId] ?? 'evening',
        done: false,
      })
    }
  }

  return items
}
