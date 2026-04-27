import { collectionGroup, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { Event } from '../types/event';

export interface AISuggestion {
  id: string;
  title: string;
  type: Event['type'];
  description: string;
  address: string | null;
  cost: number | null;
}

interface SuggestionContext {
  tripId: string;
  tripName: string;
  totalUsers: number;
  budget: number | null;
  numDays: number;
  hasWeekend: boolean;
  hasWeekday: boolean;
}

import { EVENT_CATEGORY } from '../types/event';

const VALID_TYPES = Object.keys(EVENT_CATEGORY) as Event['type'][];

const suggestionsDocRef = (tripId: string) =>
  doc(db, 'trips', tripId, 'meta', 'aiSuggestions');

export async function loadSavedSuggestions(tripId: string): Promise<AISuggestion[] | null> {
  const snap = await getDoc(suggestionsDocRef(tripId));
  if (!snap.exists()) return null;
  return (snap.data().suggestions as AISuggestion[]) ?? null;
}

export async function saveSuggestions(tripId: string, suggestions: AISuggestion[]): Promise<void> {
  await setDoc(suggestionsDocRef(tripId), { suggestions, updatedAt: Date.now() });
}

async function fetchExistingEventNames(tripId: string): Promise<string[]> {
  const q = query(collectionGroup(db, 'events'), where('tripId', '==', tripId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => (d.data() as { name?: string }).name ?? '').filter(Boolean);
}

export async function fetchAISuggestions(ctx: SuggestionContext): Promise<AISuggestion[]> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const model = import.meta.env.VITE_GEMINI_MODEL as string | undefined;
  if (!key) throw new Error('VITE_GEMINI_API_KEY is not set.');
  if (!model) throw new Error('VITE_GOOGLE_GEMINI_MODEL is not set.');

  const existingEventNames = await fetchExistingEventNames(ctx.tripId);

  const weekendStr = ctx.hasWeekend && ctx.hasWeekday
    ? 'includes weekdays and weekends'
    : ctx.hasWeekend
      ? 'weekend only'
      : 'weekdays only';

  const prompt = `You are a travel planner. Suggest 5 activities or places to visit for a trip.

Trip: "${ctx.tripName}"
Travelers: ${ctx.totalUsers}
Days: ${ctx.numDays} (${weekendStr})${ctx.budget ? `\nBudget: $${ctx.budget} total` : ''}
Already planned: ${existingEventNames.length > 0 ? existingEventNames.join(', ') : 'none'}

Respond ONLY with a valid JSON array — no markdown, no code fences, no extra text. Each item must have exactly these fields:
  "name": string
  "type": one of [${VALID_TYPES.join(', ')}]
  "description": string (1 sentence only, 20 words maximum!)
  "address": string or null
  "cost": number (USD per person, estimated) or null`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );

  if (!res.ok) {
    if (res.status === 429 || res.status === 503) {
      throw new Error('HIGH_USAGE');
    }
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();

  // Gemini may return a high-usage block even on a 200 with finishReason RECITATION/OTHER
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason === 'RECITATION' || !data?.candidates?.[0]?.content) {
    // Check promptFeedback for safety/quota blocks
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`HIGH_USAGE`);
  }

  let raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip markdown fences if present
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let parsed: { name: string; type: string; description: string; address?: string | null; cost?: number | null }[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Failed to parse Gemini response as JSON.');
  }

  const suggestions = parsed.slice(0, 5).map((item, i) => ({
    id: `s${i + 1}`,
    title: item.name ?? 'Unnamed suggestion',
    type: (VALID_TYPES.includes(item.type as Event['type']) ? item.type : 'None') as Event['type'],
    description: item.description ?? '',
    address: item.address ?? null,
    cost: typeof item.cost === 'number' ? item.cost : null,
  }));

  await saveSuggestions(ctx.tripId, suggestions);
  return suggestions;
}
