import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { Card } from '../../types/card';
import { readableInk, withAlpha } from '../../theme/color';
import { linearGradient, placeholderHatch } from '../../theme/gradients';
import type { SkinTokens } from '../../theme/skins';
import { useSkin } from '../../theme/SkinContext';
import { theme, vibeLabels } from '../../theme/theme';
import { bodyRaw, displayRaw, monoRaw } from '../../theme/typography';
import {
  formatCardDateLabel,
  formatGridDayLabel,
  formatMonoDate,
  formatMonoDateWithDay,
  formatSetRange,
} from '../../utils/date';
import type { SetSummary } from '../../utils/sets';
import BinderPage from '../BinderPage';
import CardFace, { CARD_ASPECT } from '../CardFace';
import CardThumb from '../CardThumb';
import HoloFoil from '../HoloFoil';

// Share templates — the composed images the app exports, for a single card or a whole Set.
//
// Everything here is sized from the canvas width (`u = width / 1000`) rather than from the
// device scale, so one component renders both the small on-screen preview and the full-size
// image that actually gets saved. No template carries app branding, per PLAN.md's "no app
// branding in any export path".

export type ShareSubject =
  | { kind: 'card'; card: Card; setNumber: number | null }
  | { kind: 'set'; set: SetSummary };

export type TemplateId = 'classic' | 'bleed' | 'pageCard' | 'grid' | 'fan' | 'filmstrip';
export type AspectId = '1:1' | '4:5' | '9:16';

export type ShareOverlays = {
  date: boolean;
  title: boolean;
  vibe: boolean;
  setNumber: boolean;
  holoSheen: boolean;
};

/** Width ÷ height. 4:5 and 9:16 are the two ratios Instagram actually renders uncropped. */
export const ASPECT_RATIOS: Record<AspectId, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
};

export const ASPECT_ORDER: AspectId[] = ['1:1', '4:5', '9:16'];

export const TEMPLATES: {
  id: TemplateId;
  label: string;
  hint: string;
  subject: 'card' | 'set';
}[] = [
  { id: 'classic', label: 'CARD', hint: 'The card, centred', subject: 'card' },
  { id: 'bleed', label: 'BLEED', hint: 'Photo edge to edge', subject: 'card' },
  { id: 'pageCard', label: 'ON PAGE', hint: 'Card laid on the binder leaf', subject: 'card' },
  { id: 'grid', label: 'PAGE', hint: 'The whole week as one leaf', subject: 'set' },
  { id: 'fan', label: 'FAN', hint: 'Seven cards fanned open', subject: 'set' },
  { id: 'filmstrip', label: 'STRIP', hint: 'The week as a filmstrip', subject: 'set' },
];

/** The canvas width every export is rasterized at. 1080 is Instagram's native short edge. */
export const EXPORT_WIDTH = 1080;

type ShareCanvasProps = {
  subject: ShareSubject;
  template: TemplateId;
  aspect: AspectId;
  width: number;
  overlays: ShareOverlays;
};

export default function ShareCanvas({ subject, template, aspect, width, overlays }: ShareCanvasProps) {
  const { skin } = useSkin();
  const height = width / ASPECT_RATIOS[aspect];
  const u = width / 1000;
  const styles = useMemo(() => createStyles(skin, u), [skin, u]);

  const frame = { width, height };

  if (subject.kind === 'card') {
    const { card, setNumber } = subject;
    if (template === 'bleed') {
      return <BleedTemplate {...{ frame, card, setNumber, overlays, styles, skin, u }} />;
    }
    if (template === 'pageCard') {
      return <PageCardTemplate {...{ frame, card, setNumber, overlays, styles, skin, u, aspect }} />;
    }
    return <ClassicTemplate {...{ frame, card, setNumber, overlays, styles, skin, u }} />;
  }

  const { set } = subject;
  if (template === 'fan') return <FanTemplate {...{ frame, set, overlays, styles, u, aspect }} />;
  if (template === 'filmstrip') return <FilmstripTemplate {...{ frame, set, overlays, styles, skin, u }} />;
  return <GridTemplate {...{ frame, set, overlays, styles, u, aspect }} />;
}

type Frame = { width: number; height: number };
type Styles = ReturnType<typeof createStyles>;

// ---------------------------------------------------------------- single-card templates

function ClassicTemplate({
  frame,
  card,
  setNumber,
  overlays,
  styles,
  u,
}: {
  frame: Frame;
  card: Card;
  setNumber: number | null;
  overlays: ShareOverlays;
  styles: Styles;
  skin: SkinTokens;
  u: number;
}) {
  const pad = frame.width * 0.09;
  const captionRoom = 130 * u;
  // Fit by whichever axis binds first, so the card never overflows a 1:1 or overwhelms a 9:16.
  const cardWidth = Math.min(frame.width * 0.68, (frame.height - pad * 2 - captionRoom) * CARD_ASPECT);

  return (
    <View style={[styles.shellCanvas, frame, { padding: pad }]}>
      <View style={styles.centreColumn}>
        {overlays.setNumber && setNumber != null && (
          <Text style={styles.eyebrow}>
            SET {setNumber} · NO. {card.id}
          </Text>
        )}
        <View style={{ marginTop: 34 * u }}>
          <CardFace
            photoUri={card.photoUri}
            date={card.date}
            title={card.title}
            vibeType={card.vibeType}
            isHolo={card.isHolo}
            cardNumber={card.id}
            width={cardWidth}
            overlays={{ date: overlays.date, title: overlays.title, vibe: overlays.vibe }}
            showHoloSheen={overlays.holoSheen}
          />
        </View>
        {overlays.date && <Text style={styles.footnote}>{formatMonoDateWithDay(card.date)}</Text>}
      </View>
    </View>
  );
}

function BleedTemplate({
  frame,
  card,
  setNumber,
  overlays,
  styles,
  skin,
  u,
}: {
  frame: Frame;
  card: Card;
  setNumber: number | null;
  overlays: ShareOverlays;
  styles: Styles;
  skin: SkinTokens;
  u: number;
}) {
  const displayTitle = card.title?.trim() ? card.title.trim() : formatCardDateLabel(card.date);
  const showCaption = overlays.date || overlays.title || overlays.vibe || overlays.setNumber;

  return (
    <View style={[styles.bleedCanvas, frame]}>
      <Image source={{ uri: card.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {card.isHolo && overlays.holoSheen && <HoloFoil foilRamp={skin.foilRamp} />}

      {showCaption && (
        <>
          {/* A scrim rather than a solid bar, so the photo keeps going under the type. */}
          <View
            style={[
              styles.bleedScrim,
              { height: frame.height * 0.42 },
              linearGradient(['transparent', 'rgba(0,0,0,0.72)'], 180),
            ]}
          />
          <View style={[styles.bleedCaption, { padding: frame.width * 0.075 }]}>
            {overlays.title && (
              <Text style={styles.bleedTitle} numberOfLines={3}>
                {displayTitle}
              </Text>
            )}
            <View style={styles.bleedMetaRow}>
              {overlays.date && <Text style={styles.bleedMeta}>{formatMonoDateWithDay(card.date)}</Text>}
              {overlays.setNumber && setNumber != null && (
                <Text style={styles.bleedMeta}>SET {setNumber}</Text>
              )}
              {overlays.vibe && card.vibeType && (
                <View style={[styles.bleedVibe, { backgroundColor: theme.colors.vibe[card.vibeType] }]}>
                  <Text style={[styles.bleedVibeText, { color: readableInk(theme.colors.vibe[card.vibeType]) }]}>
                    {vibeLabels[card.vibeType]}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function PageCardTemplate({
  frame,
  card,
  setNumber,
  overlays,
  styles,
  u,
  aspect,
}: {
  frame: Frame;
  card: Card;
  setNumber: number | null;
  overlays: ShareOverlays;
  styles: Styles;
  skin: SkinTokens;
  u: number;
  aspect: AspectId;
}) {
  const pad = frame.width * 0.06;
  const pageHeight = frame.height - pad * 2;
  const cardWidth = Math.min(frame.width * 0.62, (pageHeight - 200 * u) * CARD_ASPECT);

  return (
    <View style={[styles.shellCanvas, frame, { padding: pad }]}>
      <BinderPage showSpine={aspect !== '9:16'} unit={u * 3.2}>
        <View style={styles.pageCentre}>
          {/* The slight rotation is the same -3° Today's face-down card sits at — it reads as
              a card set down on the page rather than pasted into it. */}
          <View style={styles.tilted}>
            <CardFace
              photoUri={card.photoUri}
              date={card.date}
              title={card.title}
              vibeType={card.vibeType}
              isHolo={card.isHolo}
              cardNumber={card.id}
              width={cardWidth}
              overlays={{ date: overlays.date, title: overlays.title, vibe: overlays.vibe }}
              showHoloSheen={overlays.holoSheen}
            />
          </View>
        </View>
        {overlays.setNumber && setNumber != null && (
          <Text style={styles.pageFootnote}>
            SET {setNumber} · {formatMonoDate(card.date)}
          </Text>
        )}
      </BinderPage>
    </View>
  );
}

// ----------------------------------------------------------------------- set templates

function GridTemplate({
  frame,
  set,
  overlays,
  styles,
  u,
  aspect,
}: {
  frame: Frame;
  set: SetSummary;
  overlays: ShareOverlays;
  styles: Styles;
  u: number;
  aspect: AspectId;
}) {
  const pad = frame.width * 0.06;
  const pagePadding = u * 3.2;
  const innerWidth = frame.width - pad * 2 - 28 * pagePadding - 14 * pagePadding;
  const gap = 16 * u;
  const slotWidth = (innerWidth - gap * 2) / 3;

  return (
    <View style={[styles.shellCanvas, frame, { padding: pad }]}>
      <BinderPage showSpine={aspect !== '9:16'} unit={pagePadding}>
        <View style={styles.setHeader}>
          <Text style={styles.setNumber}>Set {set.setNumber}</Text>
          <Text style={styles.setRange}>
            {formatSetRange(set.startDate, set.dateKeys[6])} · {set.cardCount}/7
          </Text>
        </View>
        <View style={[styles.grid, { gap }]}>
          {set.dateKeys.map((dateKey, index) => {
            const card = set.cards[index];
            if (!card) {
              return <View key={dateKey} style={[styles.emptySlot, { width: slotWidth }]} />;
            }
            return (
              <CardThumb
                key={dateKey}
                photoUri={card.photoUri}
                date={card.date}
                vibeType={overlays.vibe ? card.vibeType : null}
                isHolo={card.isHolo && overlays.holoSheen}
                width={slotWidth}
                showDayLabel={overlays.date}
              />
            );
          })}
        </View>
      </BinderPage>
    </View>
  );
}

const FAN_ANGLES = [-30, -20, -10, 0, 10, 20, 30];
const FAN_CENTRE = 3;

function FanTemplate({
  frame,
  set,
  overlays,
  styles,
  u,
  aspect,
}: {
  frame: Frame;
  set: SetSummary;
  overlays: ShareOverlays;
  styles: Styles;
  u: number;
  aspect: AspectId;
}) {
  const pad = frame.width * 0.06;
  const cardWidth = frame.width * 0.34;
  const cardHeight = cardWidth * 1.37;

  return (
    <View style={[styles.shellCanvas, frame, { padding: pad }]}>
      <View style={styles.fanHeader}>
        <Text style={styles.eyebrow}>SET {set.setNumber} COMPLETE · {set.cardCount}/7</Text>
        <Text style={styles.fanRange}>{formatSetRange(set.startDate, set.dateKeys[6])}</Text>
      </View>
      <BinderPage showSpine={aspect !== '9:16'} unit={u * 3.2}>
        <View style={styles.fanStage}>
          {set.cards.map((card, index) => {
            const angle = FAN_ANGLES[index];
            const lift = (1 - Math.abs(index - FAN_CENTRE) / FAN_CENTRE) * 40 * u;
            const spread = (index - FAN_CENTRE) * 20 * u;
            return (
              <View
                key={set.dateKeys[index]}
                style={[
                  styles.fanSlot,
                  {
                    width: cardWidth,
                    zIndex: 10 - Math.abs(index - FAN_CENTRE),
                    transform: [
                      // `transform-origin: 50% 130%` composed by hand — pivot below the card,
                      // rotate, pivot back. Same construction as the in-app reveal.
                      { translateY: cardHeight * 0.8 },
                      { rotate: `${angle}deg` },
                      { translateY: -cardHeight * 0.8 },
                      { translateX: spread },
                      { translateY: -lift },
                    ],
                  },
                ]}
              >
                <CardThumb
                  photoUri={card?.photoUri ?? null}
                  date={set.dateKeys[index]}
                  vibeType={overlays.vibe ? (card?.vibeType ?? null) : null}
                  isHolo={(card?.isHolo ?? false) && overlays.holoSheen}
                  variant="fan"
                  width={cardWidth}
                />
              </View>
            );
          })}
        </View>
      </BinderPage>
    </View>
  );
}

function FilmstripTemplate({
  frame,
  set,
  overlays,
  styles,
  skin,
  u,
}: {
  frame: Frame;
  set: SetSummary;
  overlays: ShareOverlays;
  styles: Styles;
  skin: SkinTokens;
  u: number;
}) {
  const pad = frame.width * 0.075;
  const gap = 10 * u;
  const headerRoom = 150 * u;
  const bandHeight = (frame.height - pad * 2 - headerRoom - gap * 6) / 7;

  return (
    <View style={[styles.shellCanvas, frame, { padding: pad }]}>
      <View style={styles.stripHeader}>
        <Text style={styles.setNumberLight}>Set {set.setNumber}</Text>
        <Text style={styles.eyebrow}>{formatSetRange(set.startDate, set.dateKeys[6])}</Text>
      </View>

      <View style={{ gap }}>
        {set.dateKeys.map((dateKey, index) => {
          const card = set.cards[index];
          const vibeColor = card?.vibeType ? theme.colors.vibe[card.vibeType] : null;
          return (
            <View key={dateKey} style={[styles.band, { height: bandHeight }]}>
              <View
                style={[
                  styles.bandRule,
                  { backgroundColor: vibeColor ?? withAlpha(skin.shell.textPrimary, 0.14) },
                ]}
              />
              <View style={[styles.bandPhoto, placeholderHatch(withAlpha(skin.shell.textPrimary, 0.08))]}>
                {card && (
                  <Image source={{ uri: card.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                )}
                {card?.isHolo && overlays.holoSheen && <HoloFoil foilRamp={skin.foilRamp} />}
              </View>
              {overlays.date && (
                <View style={styles.bandLabel}>
                  <Text style={styles.bandLabelText}>{formatGridDayLabel(dateKey)}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------------------ styles

function createStyles(skin: SkinTokens, u: number) {
  return StyleSheet.create({
    shellCanvas: {
      backgroundColor: skin.shell.background,
      overflow: 'hidden',
    },
    bleedCanvas: {
      backgroundColor: skin.cardstock.photoPlaceholder,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    },
    centreColumn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: {
      ...monoRaw(24 * u, 0.2),
      color: skin.shell.accent,
    },
    footnote: {
      ...monoRaw(22 * u, 0.16),
      color: withAlpha(skin.shell.textPrimary, 0.45),
      marginTop: 34 * u,
    },
    bleedScrim: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    bleedCaption: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    bleedTitle: {
      ...displayRaw(64 * u, 1.08),
      color: '#FFFFFF',
    },
    bleedMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18 * u,
      marginTop: 20 * u,
    },
    bleedMeta: {
      ...monoRaw(22 * u, 0.14),
      color: 'rgba(255,255,255,0.82)',
    },
    bleedVibe: {
      paddingVertical: 8 * u,
      paddingHorizontal: 14 * u,
      borderRadius: 6 * u,
    },
    bleedVibeText: bodyRaw(20 * u, 600),
    pageCentre: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tilted: {
      transform: [{ rotate: '-3deg' }],
    },
    pageFootnote: {
      ...monoRaw(22 * u, 0.14),
      color: withAlpha(skin.page.ink, 0.5),
      textAlign: 'center',
    },
    setHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 22 * u,
    },
    setNumber: {
      ...displayRaw(42 * u),
      color: skin.page.ink,
    },
    setNumberLight: {
      ...displayRaw(52 * u),
      color: skin.shell.textPrimary,
    },
    setRange: {
      ...monoRaw(22 * u, 0.12),
      color: withAlpha(skin.page.ink, 0.6),
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
    },
    emptySlot: {
      aspectRatio: 5 / 6.7,
      borderRadius: 16 * u,
      borderWidth: Math.max(1, 2 * u),
      borderStyle: 'dashed',
      borderColor: withAlpha(skin.page.ink, 0.22),
      backgroundColor: withAlpha(skin.cardstock.base, 0.35),
    },
    fanHeader: {
      alignItems: 'center',
      marginBottom: 26 * u,
    },
    fanRange: {
      ...displayRaw(52 * u, 1.1),
      color: skin.shell.textPrimary,
      marginTop: 16 * u,
    },
    fanStage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fanSlot: {
      position: 'absolute',
    },
    stripHeader: {
      marginBottom: 28 * u,
      gap: 12 * u,
    },
    band: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: 10 * u,
      overflow: 'hidden',
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.05),
    },
    bandRule: {
      width: 10 * u,
    },
    bandPhoto: {
      flex: 1,
      overflow: 'hidden',
      backgroundColor: skin.cardstock.photoPlaceholder,
    },
    bandLabel: {
      position: 'absolute',
      left: 26 * u,
      bottom: 12 * u,
      paddingVertical: 6 * u,
      paddingHorizontal: 12 * u,
      borderRadius: 6 * u,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    bandLabelText: {
      ...monoRaw(18 * u, 0.12),
      color: '#FFFFFF',
    },
  });
}
