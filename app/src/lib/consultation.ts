import type {
  ConsultationAnswers,
  HairType,
  MainGoal,
  Porosity,
  ProductPlanItem,
  ScalpCondition,
  WashFrequency,
} from './types'

interface Option<T extends string> {
  value: T
  label: string
  description: string
}

export const HAIR_TYPE_OPTIONS: Option<HairType>[] = [
  { value: 'straight', label: 'Straight', description: 'Little to no natural curl pattern.' },
  { value: 'wavy', label: 'Wavy', description: 'Loose S-shaped waves.' },
  { value: 'curly', label: 'Curly', description: 'Defined curls or coils.' },
  { value: 'coily', label: 'Coily', description: 'Tight coils, zig-zag or springy pattern.' },
]

export const POROSITY_OPTIONS: Option<Porosity>[] = [
  { value: 'low', label: 'Low porosity', description: 'Product tends to sit on top of hair; slow to absorb.' },
  { value: 'medium', label: 'Medium porosity', description: 'Absorbs and holds moisture fairly well.' },
  { value: 'high', label: 'High porosity', description: 'Soaks up product fast but dries out quickly.' },
  { value: 'not-sure', label: "I'm not sure yet", description: "We'll start balanced and you can update this later." },
]

export const SCALP_OPTIONS: Option<ScalpCondition>[] = [
  { value: 'balanced', label: 'Balanced', description: 'Comfortable, not too dry or oily.' },
  { value: 'dry', label: 'Dry', description: 'Feels tight, flaky, or rough.' },
  { value: 'oily', label: 'Oily', description: 'Gets greasy at the roots within a couple of days.' },
  { value: 'itchy-flaky', label: 'Itchy / irritated', description: 'Tenderness, itchiness, or flare-ups.' },
]

export const GOAL_OPTIONS: Option<MainGoal>[] = [
  { value: 'growth', label: 'Length & growth', description: 'Grow longer, stronger hair.' },
  { value: 'moisture', label: 'Moisture & softness', description: 'Fight dryness and brittleness.' },
  { value: 'scalp-health', label: 'Scalp health', description: 'Soothe and rebalance the scalp.' },
  { value: 'detox-buildup', label: 'Clarify buildup', description: 'Reset from product or protective-style buildup.' },
  { value: 'maintenance', label: 'Maintain progress', description: 'Keep a healthy routine going.' },
]

export const WASH_OPTIONS: Option<WashFrequency>[] = [
  { value: 'weekly', label: 'About once a week', description: '' },
  { value: 'twice-weekly', label: 'Twice a week', description: '' },
  { value: 'biweekly', label: 'Every other week', description: '' },
  { value: 'sparingly', label: 'Once or twice a month', description: '' },
]

export const DEFAULT_ANSWERS: ConsultationAnswers = {
  hairType: 'curly',
  porosity: 'not-sure',
  scalpCondition: 'balanced',
  mainGoal: 'growth',
  washFrequency: 'weekly',
  usesHeatOrProtectiveStyles: false,
  notes: '',
}

function washesPerWeek(freq: WashFrequency): number {
  switch (freq) {
    case 'twice-weekly':
      return 2
    case 'weekly':
      return 1
    case 'biweekly':
      return 0.5
    case 'sparingly':
      return 0.35
  }
}

export function buildConsultationPlan(answers: ConsultationAnswers): {
  plan: ProductPlanItem[]
  summary: string
} {
  const washes = washesPerWeek(answers.washFrequency)
  const wantsClarify = answers.mainGoal === 'detox-buildup' || answers.scalpCondition === 'oily'
  const wantsGrowth = answers.mainGoal === 'growth'
  const wantsScalp = answers.mainGoal === 'scalp-health' || answers.scalpCondition === 'itchy-flaky'
  const wantsMoisture =
    answers.mainGoal === 'moisture' || answers.porosity === 'high' || answers.hairType === 'coily'
  const needsExtraMoisture = answers.hairType === 'coily' || answers.hairType === 'curly' || answers.porosity === 'high'

  const detoxTimes = wantsClarify ? Math.max(washes, 1) : washes
  const remedyTimes = washes
  const growOilTimes = wantsGrowth ? 4 : answers.usesHeatOrProtectiveStyles ? 3 : 2
  const restOilTimes = wantsScalp ? 4 : answers.scalpCondition === 'dry' ? 3 : 2
  const nourishTimes = needsExtraMoisture ? 7 : wantsMoisture ? 5 : 3

  const plan: ProductPlanItem[] = [
    {
      productId: 'detox-shampoo',
      timesPerWeek: detoxTimes,
      frequency: frequencyLabel(detoxTimes),
      guidance: wantsClarify
        ? 'Use on every wash day right now to fully clarify buildup, then ease back once your scalp feels reset.'
        : 'Use on wash day to gently cleanse without stripping your natural oils.',
    },
    {
      productId: 'remedy-conditioner',
      timesPerWeek: remedyTimes,
      frequency: frequencyLabel(remedyTimes),
      guidance: 'Follow every DETOX wash with REMEDY, focusing on mid-lengths and ends.',
    },
    {
      productId: 'hair-growth-oil',
      timesPerWeek: growOilTimes,
      frequency: frequencyLabel(growOilTimes),
      guidance: wantsGrowth
        ? 'Massage into the scalp most days to stimulate circulation and support new growth.'
        : 'Massage into the scalp a few times a week to keep the follicle nourished.',
    },
    {
      productId: 'rest-scalp-massage-oil',
      timesPerWeek: restOilTimes,
      frequency: frequencyLabel(restOilTimes),
      guidance: wantsScalp
        ? 'Apply to soothe tenderness and calm irritation — pair with a few minutes of scalp massage.'
        : 'Use between wash days to relax the scalp and relieve tension.',
    },
    {
      productId: 'nourish-moisturizer',
      timesPerWeek: nourishTimes,
      frequency: frequencyLabel(nourishTimes),
      guidance: needsExtraMoisture
        ? 'Seal in moisture daily — your hair type loses hydration fastest, so little and often wins.'
        : 'Apply as a leave-in whenever hair feels like it needs a moisture refresh.',
    },
  ]

  const summary = buildSummary(answers, wantsGrowth, wantsMoisture, wantsScalp, wantsClarify)

  return { plan, summary }
}

function frequencyLabel(timesPerWeek: number): string {
  if (timesPerWeek >= 6.5) return 'Daily'
  if (timesPerWeek >= 3.5) return `${Math.round(timesPerWeek)}x / week`
  if (timesPerWeek >= 1.5) return `${Math.round(timesPerWeek)}x / week`
  if (timesPerWeek >= 0.75) return 'Weekly'
  return 'Every other week'
}

function buildSummary(
  a: ConsultationAnswers,
  wantsGrowth: boolean,
  wantsMoisture: boolean,
  wantsScalp: boolean,
  wantsClarify: boolean,
): string {
  const focus = wantsGrowth
    ? 'building length and strengthening your growth cycle'
    : wantsMoisture
      ? 'restoring softness and locking in moisture'
      : wantsScalp
        ? 'calming and rebalancing your scalp'
        : wantsClarify
          ? 'clearing buildup and resetting your foundation'
          : 'maintaining the healthy progress you have made'
  return `Based on your ${a.hairType} hair, ${a.porosity === 'not-sure' ? 'a starting-point' : a.porosity + '-porosity'} profile, and a ${a.scalpCondition} scalp, your Journey Kit routine is tuned toward ${focus}. Revisit this consultation any time your hair, schedule, or goals change — every plan below is editable and feeds straight into your scheduler.`
}
