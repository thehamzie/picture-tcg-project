import type { VibeType } from '../theme/theme';

export type CardRow = {
  id: number;
  date: string;
  photo_uri: string;
  title: string | null;
  vibe_type: string | null;
  is_holo: number;
  created_at: string;
};

export type Card = {
  id: number;
  date: string;
  photoUri: string;
  title: string | null;
  vibeType: VibeType | null;
  isHolo: boolean;
  createdAt: string;
};

export function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    date: row.date,
    photoUri: row.photo_uri,
    title: row.title,
    vibeType: (row.vibe_type as VibeType | null) ?? null,
    isHolo: row.is_holo === 1,
    createdAt: row.created_at,
  };
}
