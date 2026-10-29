// Flags claim language that must never be generated automatically and always needs specialized review.
// This is a screening aid, not a legal classification.

export interface ClaimFlag { term: string; category: 'DRUG_OR_MEDICAL' | 'PROOF_LANGUAGE' | 'REGULATORY_STATUS' | 'SYSTEMIC_EFFECT' | 'SAFETY_ABSOLUTE'; excerpt: string }

const RULES: { re: RegExp; category: ClaimFlag['category']; term: string }[] = [
  { re: /\b(treat|treats|treating|treatment of)\b[^.]{0,40}\b(alopecia|hair loss|psoriasis|dermatitis|dandruff|eczema|infection|disease)/i, category: 'DRUG_OR_MEDICAL', term: 'treats a condition' },
  { re: /\bcures?\b/i, category: 'DRUG_OR_MEDICAL', term: 'cure' },
  { re: /\breverses?\b[^.]{0,30}\b(disease|hair loss|balding|alopecia)/i, category: 'DRUG_OR_MEDICAL', term: 'reverses disease' },
  { re: /\b(regrow|regrows|regrowth)\b/i, category: 'DRUG_OR_MEDICAL', term: 'regrowth' },
  { re: /\b(hair growth|grow hair|promotes? growth|stimulat\w* growth|growth oil)\b/i, category: 'DRUG_OR_MEDICAL', term: 'hair growth' },
  { re: /\b(prevents?|stops?)\b[^.]{0,20}\b(hair loss|thinning|balding)/i, category: 'DRUG_OR_MEDICAL', term: 'prevents hair loss' },
  { re: /\b(hormon\w*|dht|testosterone|estrogen)\b/i, category: 'DRUG_OR_MEDICAL', term: 'hormonal effect' },
  { re: /\b(metabolism|body chemistry|detox(ify|ifies|ification)?s?\b(?! shampoo))/i, category: 'SYSTEMIC_EFFECT', term: 'systemic / body-chemistry effect' },
  { re: /\b(absorbed through the (scalp|skin)|enters? (the )?(bloodstream|systemic circulation)|nourish your body)\b/i, category: 'SYSTEMIC_EFFECT', term: 'systemic absorption' },
  { re: /\b(relax(es)? nerves|anti-?inflammatory|heals?)\b/i, category: 'DRUG_OR_MEDICAL', term: 'therapeutic effect' },
  { re: /\bclinically (proven|tested)\b/i, category: 'PROOF_LANGUAGE', term: 'clinically proven' },
  { re: /\bmedically (validated|proven)\b/i, category: 'PROOF_LANGUAGE', term: 'medically validated' },
  { re: /\bproven to work\b/i, category: 'PROOF_LANGUAGE', term: 'proven to work' },
  { re: /\bfda[- ]approved\b/i, category: 'REGULATORY_STATUS', term: 'FDA approved' },
  { re: /\bglobally approved\b/i, category: 'REGULATORY_STATUS', term: 'globally approved' },
  { re: /\b(safe to manufacture|completely safe|100% safe|safe for everyone)\b/i, category: 'SAFETY_ABSOLUTE', term: 'absolute safety' },
]

export function screenClaimText(text: string): ClaimFlag[] {
  const flags: ClaimFlag[] = []
  for (const r of RULES) {
    const m = r.re.exec(text)
    if (m) {
      const start = Math.max(0, m.index - 30)
      flags.push({ term: r.term, category: r.category, excerpt: text.slice(start, m.index + m[0].length + 30).trim() })
    }
  }
  return flags
}
