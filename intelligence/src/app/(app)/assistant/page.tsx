import { redirect } from 'next/navigation'

export default function AssistantPage() {
  redirect('/workbench/new?workflow=GENERAL')
}
