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

export type TemplateId =
  | 'classic'
  | 'bleed'
  | 'pageCard'
  | 'poster'
  | 'minimal'
  | 'grid'
  | 'fan'
  | 'filmstrip'
  | 'stack'
  | 'contact';
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
  { id: 'minimal', label: 'QUIET', hint: 'Photo, wide margins, one line', subject: 'card' },
  { id: 'bleed', label: 'BLEED', hint: 'Photo edge to edge', subject: 'card' },
  { id: 'poster', label: 'POSTER', hint: 'Photo above, title below', subject: 'card' },
  { id: 'pageCard', label: 'ON PAGE', hint: 'Card laid on the binder leaf', subject: 'card' },
  { id: 'grid', label: 'PAGE', hint: 'The whole week as one leaf', subject: 'set' },
  { id: 'contact', label: 'SHEET', hint: 'Contact sheet, seven frames', subject: 'set' },
  { id: 'filmstrip', label: 'STRIP', hint: 'The week as a filmstrip', subject: 'set' },
  { id: 'stack', label: 'STACK', hint: 'Cards cascading down', subject: 'set' },
  { id: 'fan', label: 'FAN', hint: 'Seven cards fanned open', subject: 'set' },
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
    const props = { frame, card, setNumber, overlays, styles, skin, u };
    if (template === 'bleed') return <BleedTemplate {...props} />;
    if (template === 'poster') return <PosterTemplate {...props} />;
    if (template === 'minimal') return <MinimalTemplate {...props} />;
    if (template === 'pageCard') return <PageCardTemplate {...props} aspect={aspect} />;
    return <ClassicTemplate {...props} />;
  }

  const { set } = subject;
  const props = { frame, set, overlays, styles, skin, u };
  if (template === 'fan') return <FanTemplate {...props} aspect={aspect} />;
  if (template === 'filmstrip') return <FilmstripTemplate {...props} />;
  if (template === 'stack') return <StackTemplate {...props} />;
  if (template === 'contact') return <ContactSheetTemplate {...props} />;
  return <GridTemplate {...props} aspect={aspect} />;
}

type Frame = { width: number; height: number };
type Styles = ReturnType<typeof createStyles>;

type CardTemplateProps = {
  frame: Frame;
  card: Card;
  setNumber: number | null;
  overlays: ShareOverlays;
  styles: Styles;
  skin: SkinTokens;
  u: number;
};

type SetTemplateProps = {
  frame: Frame;
  set: SetSummary;
  overlays: ShareOverlays;
  styles: Styles;
  skin: SkinTokens;
  u: number;
};

// ---------------------------------------------------------------- single-card templates

function ClassicTemplate({ frame, card, setNumber, overlays, styles, u }: CardTemplateProps) {
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

function BleedTemplate({ frame, card, setNumber, overlays, styles, skin, u }: CardTemplateProps) {
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

/**
 * Editorial: photo on top, type below on the shell. The one template where the title is the
 * loudest thing on the canvas — good when the picture wants a caption rather than a frame.
 */
function PosterTemplate({
  frame,
  card,
  setNumber,
  overlays,
  styles,
  skin,
  u,
}: CardTemplateProps) {
  const pad = frame.width * 0.075;
  const displayTitle = card.title?.trim() ? card.title.trim() : formatCardDateLabel(card.date);

  return (
    <View style={[styles.shellCanvas, frame, { padding: pad }]}>
      <View style={styles.posterPhoto}>
        <Image source={{ uri: card.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {card.isHolo && overlays.holoSheen && <HoloFoil foilRamp={skin.foilRamp} borderRadius={8 * u} />}
      </View>
      <View style={styles.posterCopy}>
        {overlays.title && (
          <Text style={styles.posterTitle} numberOfLines={3}>
            {displayTitle}
          </Text>
        )}
        <View style={styles.posterRule} />
        <View style={styles.posterMetaRow}>
          {overlays.date && <Text style={styles.posterMeta}>{formatMonoDateWithDay(card.date)}</Text>}
          {overlays.setNumber && setNumber != null && (
            <Text style={styles.posterMeta}>SET {setNumber} · NO. {card.id}</Text>
          )}
        </View>
        {overlays.vibe && card.vibeType && (
          <View style={[styles.posterVibe, { backgroundColor: theme.colors.vibe[card.vibeType] }]} />
        )}
      </View>
    </View>
  );
}

/**
 * The restrained one: a square photo in generous margins with a single mono line. Built for
 * everyday posting, where the trading-card framing would be too much.
 */
function MinimalTemplate({ frame, card, setNumber, overlays, styles, skin, u }: CardTemplateProps) {
  const pad = frame.width * 0.11;
  const photoSize = frame.width - pad * 2;

  return (
    <View style={[styles.shellCanvas, frame, { padding: pad }]}>
      <View style={styles.centreColumn}>
        <View style={[styles.minimalPhoto, { width: photoSize, height: photoSize }]}>
          <Image source={{ uri: card.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {card.isHolo && overlays.holoSheen && <HoloFoil foilRamp={skin.foilRamp} />}
        </View>
        {overlays.title && (
          <Text style={styles.minimalTitle} numberOfLines={2}>
            {card.title?.trim() ? card.title.trim() : formatCardDateLabel(card.date)}
          </Text>
        )}
        <View style={styles.minimalMetaRow}>
          {overlays.vibe && card.vibeType && (
            <View style={[styles.minimalDot, { backgroundColor: theme.colors.vibe[card.vibeType] }]} />
          )}
          {overlays.date && <Text style={styles.footnoteTight}>{formatMonoDate(card.date)}</Text>}
          {overlays.setNumber && setNumber != null && (
            <Text style={styles.footnoteTight}>SET {setNumber}</Text>
          )}
        </View>
      </View>
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
}: CardTemplateProps & { aspect: AspectId }) {
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
}: SetTemplateProps & { aspect: AspectId }) {
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
}: SetTemplateProps & { aspect: AspectId }) {
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

function FilmstripTemplate({ frame, set, overlays, styles, skin, u }: SetTemplateProps) {
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
              <View style={[styles.bandPhoto, placeholderHatch(withAlpha(skin.shell.textPrimary, 0.08), u * 3)]}>
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

/**
 * Cards cascading down the canvas, each overlapping the one above with a little counter-rota-
 * tion. Reads as a handful of cards dealt onto a table — the most "collection" of the set
 * templates, and the one that suits a 9:16 story best.
 */
function StackTemplate({ frame, set, overlays, styles, u }: SetTemplateProps) {
  const pad = frame.width * 0.08;
  const cardWidth = frame.width * 0.52;
  const cardHeight = cardWidth * 1.37;
  const headerRoom = 170 * u;
  const available = frame.height - pad * 2 - headerRoom - cardHeight;
  // Overlap so the whole run always fits, however tall the frame is.
  const step = Math.max(24 * u, available / Math.max(1, set.cards.length - 1));
  const tilts = [-4, 3, -2.5, 4, -3.5, 2, -1.5];

  return (
    <View style={[styles.shellCanvas, frame, { padding: pad }]}>
      <View style={styles.stackHeader}>
        <Text style={styles.setNumberLight}>Set {set.setNumber}</Text>
        <Text style={styles.eyebrow}>
          {formatSetRange(set.startDate, set.dateKeys[6])} · {set.cardCount}/7
        </Text>
      </View>
      <View style={styles.stackStage}>
        {set.cards.map((card, index) => (
          <View
            key={set.dateKeys[index]}
            style={{
              position: 'absolute',
              top: index * step,
              left: (frame.width - pad * 2 - cardWidth) / 2,
              width: cardWidth,
              zIndex: index,
              transform: [{ rotate: `${tilts[index % tilts.length]}deg` }],
            }}
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
        ))}
      </View>
    </View>
  );
}

/**
 * A proper contact sheet: seven square frames on the shell with mono day labels underneath.
 * The plainest, most everyday of the set templates — no binder, no card stock.
 */
function ContactSheetTemplate({ frame, set, overlays, styles, skin, u }: SetTemplateProps) {
  const pad = frame.width * 0.08;
  const columns = 3;
  const gap = 14 * u;
  const cellWidth = (frame.width - pad * 2 - gap * (columns - 1)) / columns;

  return (
    <View style={[styles.shellCanvas, frame, { padding: pad }]}>
      <View style={styles.sheetHeader}>
        <Text style={styles.setNumberLight}>Set {set.setNumber}</Text>
        <Text style={styles.eyebrow}>
          {formatSetRange(set.startDate, set.dateKeys[6])} · {set.cardCount}/7
        </Text>
      </View>
      <View style={[styles.sheetGrid, { gap }]}>
        {set.dateKeys.map((dateKey, index) => {
          const card = set.cards[index];
          return (
            <View key={dateKey} style={{ width: cellWidth }}>
              <View
                style={[
                  styles.sheetFrame,
                  { height: cellWidth },
                  placeholderHatch(withAlpha(skin.shell.textPrimary, 0.08), u * 3),
                ]}
              >
                {card && (
                  <Image source={{ uri: card.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                )}
                {card?.isHolo && overlays.holoSheen && <HoloFoil foilRamp={skin.foilRamp} />}
              </View>
              <View style={styles.sheetCaption}>
                {overlays.date && <Text style={styles.sheetDay}>{formatGridDayLabel(dateKey)}</Text>}
                {overlays.vibe && card?.vibeType && (
                  <View style={[styles.sheetVibe, { backgroundColor: theme.colors.vibe[card.vibeType] }]} />
                )}
              </View>
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

    // poster
    posterPhoto: {
      flex: 1,
      borderRadius: 8 * u,
      overflow: 'hidden',
      backgroundColor: skin.cardstock.photoPlaceholder,
    },
    posterCopy: {
      paddingTop: 34 * u,
    },
    posterTitle: {
      ...displayRaw(62 * u, 1.05),
      color: skin.shell.textPrimary,
    },
    posterRule: {
      height: 3 * u,
      backgroundColor: skin.shell.accent,
      marginTop: 26 * u,
      width: 90 * u,
    },
    posterMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 22 * u,
    },
    posterMeta: {
      ...monoRaw(21 * u, 0.14),
      color: withAlpha(skin.shell.textPrimary, 0.5),
    },
    posterVibe: {
      height: 6 * u,
      borderRadius: 3 * u,
      marginTop: 22 * u,
    },

    // minimal
    minimalPhoto: {
      overflow: 'hidden',
      backgroundColor: skin.cardstock.photoPlaceholder,
    },
    minimalTitle: {
      ...displayRaw(30 * u, 1.2),
      color: skin.shell.textPrimary,
      marginTop: 44 * u,
      textAlign: 'center',
    },
    minimalMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14 * u,
      marginTop: 20 * u,
    },
    minimalDot: {
      width: 12 * u,
      height: 12 * u,
      borderRadius: 6 * u,
    },
    footnoteTight: {
      ...monoRaw(20 * u, 0.16),
      color: withAlpha(skin.shell.textPrimary, 0.45),
    },

    // stack
    stackHeader: {
      gap: 12 * u,
      marginBottom: 26 * u,
    },
    stackStage: {
      flex: 1,
    },

    // contact sheet
    sheetHeader: {
      gap: 12 * u,
      marginBottom: 28 * u,
    },
    sheetGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
    },
    sheetFrame: {
      width: '100%',
      overflow: 'hidden',
      borderRadius: 6 * u,
      backgroundColor: skin.cardstock.photoPlaceholder,
      borderWidth: Math.max(1, 1.5 * u),
      borderColor: withAlpha(skin.shell.textPrimary, 0.12),
    },
    sheetCaption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10 * u,
    },
    sheetDay: {
      ...monoRaw(17 * u, 0.1),
      color: withAlpha(skin.shell.textPrimary, 0.5),
    },
    sheetVibe: {
      width: 26 * u,
      height: 5 * u,
      borderRadius: 3 * u,
    },
  });
}
