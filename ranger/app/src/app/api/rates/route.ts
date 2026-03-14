import { NextResponse } from 'next/server';
import { fetchRatesData } from '@/lib/fetchRates';

export async function GET() {
  const doc = await fetchRatesData();

  return NextResponse.json(doc, {
    headers: {
      'Cache-Control': 'public, max-age=60',
    },
  });
}
