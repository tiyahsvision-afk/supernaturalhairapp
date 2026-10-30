// Rule-derived ingredient classifications.
//
// These are NOT measured or verified properties. Each classification is computed from the INCI name and the official
// EU CosIng function list using an explicit, versioned rule, and always travels with the rule that produced it, so the
// UI can show "derived from INCI naming convention" rather than presenting it as data. Naming rules have exceptions;
// every derived class is a screening aid that a chemist can confirm or override.

export const RULES_VERSION = 'classify-rules/1.0.1'

export interface DerivedClass {
  code: string
  label: string
  group: 'surfactant' | 'charge' | 'composition' | 'screening' | 'regulatory-labelling'
  basis: string
}

const has = (fns: string[], ...want: string[]) => want.some((w) => fns.includes(w))
const isSurfactant = (fns: string[]) => has(fns, 'surfactant', 'cleansing', 'foaming', 'emulsifying', 'surfactant-cleansing', 'surfactant-emulsifying', 'surfactant-foam-boosting')

// EU Regulation (EC) No 1223/2009, Annex III: fragrance allergens that must be labelled above 0.001% (leave-on) or
// 0.01% (rinse-off). This is the long-standing list of 26; Regulation (EU) 2023/1545 extends it (transition periods
// apply) and the extension is not yet loaded. Two of the 26 (HICC/Lyral, butylphenyl methylpropional/Lilial) are now
// prohibited (Annex II) and are flagged separately by their CosIng restriction.
export const EU_LABELLED_ALLERGENS_26 = new Set([
  'AMYL CINNAMAL', 'BENZYL ALCOHOL', 'CINNAMYL ALCOHOL', 'CITRAL', 'EUGENOL', 'HYDROXYCITRONELLAL', 'ISOEUGENOL',
  'AMYLCINNAMYL ALCOHOL', 'BENZYL SALICYLATE', 'CINNAMAL', 'COUMARIN', 'GERANIOL', 'HYDROXYISOHEXYL 3-CYCLOHEXENE CARBOXALDEHYDE',
  'ANISE ALCOHOL', 'BENZYL CINNAMATE', 'FARNESOL', 'BUTYLPHENYL METHYLPROPIONAL', 'LINALOOL', 'BENZYL BENZOATE', 'CITRONELLOL',
  'HEXYL CINNAMAL', 'LIMONENE', 'METHYL 2-OCTYNOATE', 'ALPHA-ISOMETHYL IONONE', 'EVERNIA PRUNASTRI EXTRACT', 'EVERNIA FURFURACEA EXTRACT',
])

const FORMALDEHYDE_RELEASERS = ['DMDM HYDANTOIN', 'IMIDAZOLIDINYL UREA', 'DIAZOLIDINYL UREA', 'QUATERNIUM-15', 'SODIUM HYDROXYMETHYLGLYCINATE', '2-BROMO-2-NITROPROPANE-1,3-DIOL', 'METHENAMINE']
const DRYING_ALCOHOLS = ['ALCOHOL', 'ALCOHOL DENAT.', 'ALCOHOL DENAT', 'ISOPROPYL ALCOHOL', 'PROPANOL', 'METHANOL']
const FATTY_ALCOHOL = /\b(CETYL|STEARYL|CETEARYL|BEHENYL|MYRISTYL|LAURYL|ARACHIDYL|OLEYL|CAPRYLYL|DECYL|OCTYLDODECANOL|C\d{2}-\d{2})\s*ALCOHOLS?\b|^OCTYLDODECANOL$/

export function classify(inciRaw: string, cosingFunctions: string[] = []): DerivedClass[] {
  const n = inciRaw.toUpperCase().replace(/\s+/g, ' ').trim()
  const f = cosingFunctions.map((x) => x.toLowerCase())
  const out: DerivedClass[] = []
  const add = (code: string, label: string, group: DerivedClass['group'], basis: string) => out.push({ code, label, group, basis })
  const surf = isSurfactant(f)
  // Methosulfate/ethosulfate are counter-ions of cationic quats, not sulfate cleansers.
  // "AMMONIUM …" salts (e.g. ammonium lauryl sulfate) are not quats, hence the (?<!AM) guard.
  const quatNaming = /((?<!AM)MONIUM( |$)|ALKONIUM|^QUATERNIUM-|^POLYQUATERNIUM-|METHOSULFATE$|ETHOSULFATE$)/.test(n)

  // Surfactant classes (require a surfactant/cleansing CosIng function, so inorganic salts like MAGNESIUM SULFATE are excluded)
  if (surf && !quatNaming && /(SULFATE|SULPHATE)$/.test(n)) add('sulfate-surfactant', 'Sulfate surfactant', 'surfactant', 'INCI name ends in SULFATE and CosIng lists a surfactant/cleansing function')
  if (surf && /(SULFONATE|SULFOSUCCINATE|ISETHIONATE|SARCOSINATE|TAURATE|GLUTAMATE|LACTYLATE|CARBOXYLATE|SULFOACETATE|SULFATE|SULPHATE|SOAP|OLIVATE|COCOATE)$/.test(n) && !quatNaming)
    add('anionic-surfactant', 'Anionic surfactant', 'charge', 'Anionic head-group naming convention (e.g. -SULFATE, -ISETHIONATE, -SARCOSINATE) plus a CosIng surfactant function')
  if (/(BETAINE|SULTAINE|AMPHOACETATE|AMPHODIACETATE|AMPHOPROPIONATE|HYDROXYSULTAINE)$/.test(n)) add('amphoteric-surfactant', 'Amphoteric surfactant', 'charge', 'Amphoteric naming convention (-BETAINE, -SULTAINE, -AMPHOACETATE)')
  if (surf && (/GLUCOSIDE$/.test(n) || /^POLYSORBATE/.test(n) || /^(PEG|PPG)-\d/.test(n) || /(GLYCERYL|SORBITAN|POLYGLYCERYL-\d+) [A-Z]+ATE$/.test(n)) && !/(SULFATE|TRIMONIUM)/.test(n))
    add('nonionic-surfactant', 'Nonionic surfactant / emulsifier', 'charge', 'Nonionic naming convention (glucoside, polysorbate, PEG/sorbitan/glyceryl esters) plus a CosIng surfactant/emulsifying function')

  // Cationic (quaternary ammonium and amidoamines)
  if (/((?<!AM)MONIUM( |$)|ALKONIUM|^QUATERNIUM-|^POLYQUATERNIUM-|ESTERQUAT)/.test(n))
    add('cationic', 'Cationic (quaternary ammonium)', 'charge', 'Quaternary-ammonium naming convention (-TRIMONIUM, -DIMONIUM, QUATERNIUM-, POLYQUATERNIUM-)')
  else if (/AMIDOPROPYL DIMETHYLAMINE$|AMIDOETHYL DIETHYLAMINE$/.test(n))
    add('cationic-at-acidic-ph', 'Cationic when neutralised (amidoamine)', 'charge', 'Amidoamine naming convention; becomes cationic when neutralised with an acid')

  // Composition screens
  if (/(METHICONE|SILOXANE|SILANE|DIMETHICONOL|SILICONE|SILSESQUIOXANE)/.test(n)) {
    if (/(PEG|PPG)-\d.*METHICONE|METHICONE.*(PEG|PPG)/.test(n) || /DIMETHICONE COPOLYOL/.test(n)) add('water-dispersible-silicone', 'PEG/PPG-modified silicone', 'composition', 'Silicone naming with PEG/PPG modification (generally water-dispersible)')
    else add('silicone', 'Silicone', 'composition', 'Silicone naming convention (-METHICONE, -SILOXANE, -SILANE)')
  }
  if (/(HYDROLYZED|HYDROLYSED)\b/.test(n) && /(PROTEIN|KERATIN|SILK|COLLAGEN|ELASTIN|WHEAT|SOY|RICE|OAT|QUINOA|PEA|CORN|POTATO|BAOBAB|MILK|CASEIN|SESAME|ALMOND|JOJOBA PROTEIN|VEGETABLE)/.test(n) || /^(KERATIN|SILK|COLLAGEN|ELASTIN|AMINO ACIDS|SERICIN|FIBROIN)\b/.test(n) || /PROTEIN$/.test(n))
    add('protein', 'Protein / hydrolysed protein', 'composition', 'Protein naming convention (HYDROLYZED … PROTEIN, KERATIN, SILK, COLLAGEN, AMINO ACIDS)')
  if (DRYING_ALCOHOLS.includes(n) || /^SD ALCOHOL/.test(n)) add('short-chain-alcohol', 'Short-chain (volatile) alcohol', 'composition', 'Matches a short-chain alcohol INCI name (ALCOHOL, ALCOHOL DENAT., ISOPROPYL ALCOHOL)')
  if (FATTY_ALCOHOL.test(n)) add('fatty-alcohol', 'Fatty alcohol', 'composition', 'Long-chain alcohol INCI name (cetyl, stearyl, cetearyl, behenyl…)')
  if (/(^| )(PEG|PPG)-\d/.test(n) || /^(PEG|PPG)-/.test(n)) add('peg-ppg', 'PEG/PPG (ethoxylated/propoxylated)', 'composition', 'INCI contains PEG-n or PPG-n')
  if (/PARABEN$/.test(n)) add('paraben', 'Paraben', 'composition', 'INCI name ends in PARABEN')
  if (FORMALDEHYDE_RELEASERS.includes(n)) add('formaldehyde-releaser', 'Formaldehyde-releasing preservative', 'composition', 'On the rule list of formaldehyde-releasing preservatives')
  if (/^(PARAFFINUM LIQUIDUM|MINERAL OIL|PETROLATUM|PARAFFIN|CERESIN|OZOKERITE|MICROCRYSTALLINE WAX)$/.test(n)) add('petrolatum-mineral', 'Mineral oil / petrolatum / paraffin', 'composition', 'Petroleum-derived hydrocarbon INCI name')
  if (/(\bWAX\b|^CERA |CERA ALBA|CERA$)/.test(n)) add('wax', 'Wax', 'composition', 'INCI contains WAX or CERA')
  if (n === 'PARFUM' || n === 'FRAGRANCE' || n === 'AROMA' || n === 'PARFUM/FRAGRANCE') add('fragrance', 'Fragrance (undisclosed mixture)', 'composition', 'Declared as PARFUM/FRAGRANCE')
  if (/ (EXTRACT|OIL|BUTTER|JUICE|WATER|POWDER|FLOUR|GEL|LEAF|SEED|ROOT|FLOWER)\b/.test(n) && /^[A-Z]+ [A-Z]+/.test(n) && !/(PEG|PPG|HYDROGENATED|SULFATE|TRIMONIUM|METHICONE)/.test(n) && has(f, 'skin-conditioning', 'emollient', 'hair-conditioning', 'perfuming', 'antioxidant', 'masking', 'tonic', 'soothing', 'humectant', 'moisturising', 'smoothing', 'astringent', 'refreshing', 'antimicrobial', 'cleansing', 'solvent'))
    add('botanical', 'Botanical-derived', 'composition', 'Plant-part naming (… EXTRACT/OIL/BUTTER/JUICE) with a conditioning or perfuming CosIng function')
  if (has(f, 'humectant', 'skin-conditioning-humectant')) add('humectant', 'Humectant (CosIng function)', 'composition', 'Official CosIng function: humectant')
  if (has(f, 'preservative')) add('preservative', 'Preservative (CosIng function)', 'composition', 'Official CosIng function: preservative')
  if (has(f, 'uv-filter', 'uv-absorber')) add('uv-filter', 'UV filter / absorber (CosIng function)', 'composition', 'Official CosIng function: UV filter or UV absorber')
  if (has(f, 'hair-dyeing', 'cosmetic-colorant') || /^CI \d{5}$/.test(n)) add('colorant', 'Colorant / hair dye', 'composition', 'CosIng function colorant/hair-dyeing or CI number')

  // Regulatory labelling (EU)
  if (EU_LABELLED_ALLERGENS_26.has(n)) add('eu-fragrance-allergen', 'EU labelled fragrance allergen', 'regulatory-labelling', 'Listed among the 26 fragrance allergens of Reg. (EC) 1223/2009 Annex III: label above 0.001% leave-on / 0.01% rinse-off')

  // Curly Girl method screening — a community guideline, not a scientific or regulatory standard.
  const codes = new Set(out.map((c) => c.code))
  const cgBad = [...(codes.has('sulfate-surfactant') ? ['sulfate surfactant'] : []), ...(codes.has('silicone') ? ['non-modified silicone'] : []), ...(codes.has('short-chain-alcohol') ? ['short-chain alcohol'] : []), ...(codes.has('wax') ? ['wax'] : []), ...(codes.has('petrolatum-mineral') ? ['mineral oil/petrolatum'] : [])]
  if (cgBad.length) add('cg-avoid', 'Curly Girl method: commonly avoided', 'screening', `Community Curly Girl guideline commonly avoids: ${cgBad.join(', ')}. Not a scientific or safety judgement.`)
  else if (codes.has('water-dispersible-silicone')) add('cg-caution', 'Curly Girl method: case by case', 'screening', 'PEG/PPG-modified silicones are treated case by case in Curly Girl guidance. Not a scientific judgement.')
  return out
}

export const DERIVED_FILTERS: { code: string; label: string; help: string }[] = [
  { code: 'sulfate-surfactant', label: 'Sulfate surfactants', help: 'Cleansers such as sodium laureth sulfate' },
  { code: 'silicone', label: 'Silicones', help: 'Dimethicone, amodimethicone, cyclopentasiloxane…' },
  { code: 'protein', label: 'Proteins', help: 'Hydrolysed proteins, keratin, silk, amino acids' },
  { code: 'cationic', label: 'Cationic conditioners', help: 'Quats such as behentrimonium chloride, polyquaterniums' },
  { code: 'fatty-alcohol', label: 'Fatty alcohols', help: 'Cetyl, stearyl, cetearyl, behenyl alcohol' },
  { code: 'short-chain-alcohol', label: 'Short-chain alcohols', help: 'Alcohol denat., isopropyl alcohol' },
  { code: 'humectant', label: 'Humectants', help: 'CosIng function humectant' },
  { code: 'botanical', label: 'Botanicals', help: 'Plant extracts, oils and butters' },
  { code: 'preservative', label: 'Preservatives', help: 'CosIng function preservative' },
  { code: 'eu-fragrance-allergen', label: 'EU fragrance allergens', help: 'Must be labelled above thresholds in the EU' },
  { code: 'cg-avoid', label: 'Curly Girl: commonly avoided', help: 'Community guideline screen' },
]

/** Identity and material type from naming rules, used only for newly imported CosIng records (marked unreviewed). */
export function identityFromName(inciRaw: string, fns: string[]): { identityType: string; materialType: string } {
  const n = inciRaw.toUpperCase()
  const f = fns.map((x) => x.toLowerCase())
  if (/^CI \d{5}/.test(n)) return { identityType: 'DEFINED_SUBSTANCE', materialType: 'COLORANT' }
  if (n === 'PARFUM' || n === 'FRAGRANCE' || n === 'AROMA') return { identityType: 'FRAGRANCE_MIXTURE', materialType: 'FRAGRANCE_MATERIAL' }
  if (/(METHICONE|SILOXANE|SILANE|DIMETHICONOL)/.test(n)) return { identityType: 'POLYMER', materialType: 'SILICONE' }
  if (/FERMENT/.test(n)) return { identityType: 'FERMENT', materialType: 'FERMENTATION_DERIVED' }
  if (/LYSATE/.test(n)) return { identityType: 'LYSATE', materialType: 'FERMENTATION_DERIVED' }
  if (/FILTRATE/.test(n)) return { identityType: 'FILTRATE', materialType: 'FERMENTATION_DERIVED' }
  if (/^(HYDROLYZED|HYDROLYSED) /.test(n)) return { identityType: 'HYDROLYSATE', materialType: /PROTEIN|KERATIN|SILK|COLLAGEN|ELASTIN/.test(n) ? 'PROTEIN' : 'COMPLEX_MIXTURE' }
  if (/PEPTIDE-\d|PEPTIDE$/.test(n)) return { identityType: 'PEPTIDE', materialType: 'PEPTIDE' }
  if (/(\bWAX\b|^CERA )/.test(n)) return { identityType: 'WAX', materialType: 'WAX' }
  if (/ EXTRACT$/.test(n)) return { identityType: 'BOTANICAL_EXTRACT', materialType: 'BOTANICAL_EXTRACT' }
  if (/ (SEED|KERNEL|FRUIT|NUT) (OIL|BUTTER)$|^[A-Z]+ [A-Z]+ (OIL|BUTTER)$/.test(n) && !/(LEAF|FLOWER|PEEL|BARK|HERB|WOOD) OIL$/.test(n)) return { identityType: 'FIXED_OIL', materialType: 'OIL' }
  if (/ (LEAF|FLOWER|PEEL|BARK|HERB|WOOD|ROOT|BUD|STEM) OIL$/.test(n)) return { identityType: 'ESSENTIAL_OIL', materialType: 'BOTANICAL_FRACTION' }
  if (/(^POLYQUATERNIUM|COPOLYMER|CROSSPOLYMER|POLYMER$|^POLY[A-Z]|^PEG-|^PPG-|CARBOMER|GUM$|CELLULOSE)/.test(n)) return { identityType: /COPOLYMER|CROSSPOLYMER/.test(n) ? 'COPOLYMER' : 'POLYMER', materialType: 'POLYMER' }
  if (isSurfactant(f)) return { identityType: 'UNKNOWN_COMPOSITION', materialType: 'SURFACTANT' }
  if (f.includes('preservative')) return { identityType: 'DEFINED_SUBSTANCE', materialType: 'PRESERVATIVE' }
  if (f.includes('uv-filter') || f.includes('uv-absorber')) return { identityType: 'DEFINED_SUBSTANCE', materialType: 'UV_FILTER' }
  return { identityType: 'UNKNOWN_COMPOSITION', materialType: 'OTHER' }
}

/** Converts an upper-case CosIng INCI name to conventional label case, keeping codes such as PEG-40, CI 77491, C12-15. */
export function inciLabelCase(inci: string): string {
  return inci.toLowerCase().replace(/(^|[\s/(\-,])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase())
    .replace(/\b(Peg|Ppg|Ci|Pca|Dmdm|Edta|Bht|Bha|Hdi|Ipdi|Smdi|Pvp|Pvm|Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi)\b/g, (m) => m.toUpperCase())
    .replace(/\b(Tea|Dea|Mea|Mipa)(?=-)/g, (m) => m.toUpperCase())
    .replace(/(\/)(Va|Ma)\b|\b(Va|Ma)(?=\/)/g, (m) => m.toUpperCase())
    .replace(/\b([Cc])(\d)/g, 'C$2')
}
