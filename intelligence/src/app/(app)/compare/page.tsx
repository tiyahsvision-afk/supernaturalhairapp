import { redirect } from 'next/navigation'

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams
  redirect(`/workbench/new?workflow=COMPARISON${ids ? `&ids=${encodeURIComponent(ids)}` : ''}`)
}
