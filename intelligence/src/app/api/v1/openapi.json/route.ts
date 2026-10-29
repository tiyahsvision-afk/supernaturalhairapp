import { NextResponse } from 'next/server'
import { OPENAPI } from '@/lib/api/openapi'

export function GET() {
  return NextResponse.json(OPENAPI)
}
