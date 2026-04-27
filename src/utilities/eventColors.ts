// Color palette for event labels. Token names mirror Google Calendar's
// nomenclature so values are stable and human-readable in Firestore.

export type EventColorToken =
  | 'tomato'
  | 'tangerine'
  | 'banana'
  | 'sage'
  | 'basil'
  | 'peacock'
  | 'blueberry'
  | 'grape'
  | 'graphite';

export const EVENT_COLORS: { token: EventColorToken; hex: string; label: string }[] = [
  { token: 'tomato',    hex: '#d50000', label: 'Tomato' },
  { token: 'tangerine', hex: '#f4511e', label: 'Tangerine' },
  { token: 'banana',    hex: '#f6bf26', label: 'Banana' },
  { token: 'sage',      hex: '#33b679', label: 'Sage' },
  { token: 'basil',     hex: '#0b8043', label: 'Basil' },
  { token: 'peacock',   hex: '#039be5', label: 'Peacock' },
  { token: 'blueberry', hex: '#3f51b5', label: 'Blueberry' },
  { token: 'grape',     hex: '#8e24aa', label: 'Grape' },
  { token: 'graphite',  hex: '#616161', label: 'Graphite' },
];

const TOKEN_TO_HEX: Record<string, string> = Object.fromEntries(
  EVENT_COLORS.map(c => [c.token, c.hex]),
);

export const resolveEventColor = (token?: string | null): string | null =>
  token ? TOKEN_TO_HEX[token] ?? null : null;
