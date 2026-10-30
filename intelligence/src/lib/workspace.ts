// Workspace modes: one shared intelligence database, different starting points for different professionals.
export type WorkspaceMode = 'FOUNDER' | 'CHEMIST' | 'BRAND' | 'MANUFACTURER'

export const MODES: Record<WorkspaceMode, { label: string; tagline: string; start: string[]; help?: string }> = {
  FOUNDER: {
    label: 'Beauty founder', tagline: 'Research a product concept, learn the ingredients, and prepare for a manufacturer.',
    start: ['PRODUCT_BRIEF', 'CLAIM', 'COMPARISON', 'SUBSTITUTES', 'FORMULATION', 'SUPPLIERS'],
    help: 'New to cosmetic ingredients? Start with the Product Development Research Wizard. It turns your idea into a brief you can take to a cosmetic chemist. Every ingredient page explains what is known, what is reported by a source, and what is still missing.',
  },
  CHEMIST: { label: 'Cosmetic chemist', tagline: 'Investigate formulation problems, substitutions, evidence and regulatory constraints.', start: ['SUBSTITUTES', 'FORMULATION', 'COMPARISON', 'CLAIM', 'SUPPLIERS', 'PRODUCT_BRIEF'] },
  BRAND: { label: 'Beauty brand', tagline: 'Benchmark products, monitor evidence and regulation, and research innovation and claims.', start: ['CLAIM', 'COMPARISON', 'SUBSTITUTES', 'FORMULATION', 'SUPPLIERS', 'PRODUCT_BRIEF'] },
  MANUFACTURER: { label: 'Manufacturer', tagline: 'Evaluate ingredient alternatives, suppliers and regulatory constraints across your portfolio.', start: ['SUBSTITUTES', 'SUPPLIERS', 'FORMULATION', 'COMPARISON', 'CLAIM', 'PRODUCT_BRIEF'] },
}

export function modeFor(userMode: string | null | undefined, orgType: string): WorkspaceMode {
  if (userMode && userMode in MODES) return userMode as WorkspaceMode
  return orgType === 'BRAND' ? 'BRAND' : orgType === 'SUPPLIER' ? 'MANUFACTURER' : 'CHEMIST'
}
