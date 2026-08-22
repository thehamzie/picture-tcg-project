import type { VibeType } from '../theme/theme';

export type CardRow = {
  id: number;
  date: string;
  photo_uri: string;
  thumb_uri: string | null;
  filter_id: string | null;
  title: string | null;
  vibe_type: string | null;
  is_holo: number;
  created_at: string;
};

export type Card = {
  id: number;
  date: string;
  photoUri: string;
  /**
   * A small derivative of the photo, for grids and strips. Null on cards captured before
   * thumbnails existed and not yet backfilled — every consumer should fall back to `photoUri`,
   * which is what `displayThumb` below does.
   */
  thumbUri: string | null;
  /** Which filter was baked in at capture. Display only: the bake is not reversible. */
  filterId: string | null;
  title: string | null;
  vibeType: VibeType | null;
  isHolo: boolean;
  createdAt: string;
};

/** The URI to draw at small sizes: the thumbnail when there is one, the full photo otherwise. */
export function displayThumb(card: Card): string {
  return card.thumbUri ?? card.photoUri;
}

export function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    date: row.date,
    photoUri: row.photo_uri,
    thumbUri: row.thumb_uri ?? null,
    filterId: row.filter_id ?? null,
    title: row.title,
    vibeType: (row.vibe_type as VibeType | null) ?? null,
    isHolo: row.is_holo === 1,
    createdAt: row.created_at,
  };
}
