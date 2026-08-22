export type BinderParams = {
  /** Opens the Binder on a specific Set's page — used by the Sets tab. */
  setStartDate?: string;
};

export type TabParamList = {
  Today: undefined;
  Binder: BinderParams | undefined;
  Sets: undefined;
};

export type PermissionsParams = {
  reminderHour: number;
  reminderMinute: number;
};

export type DevelopParams = {
  /** The raw capture, still in its temporary location — never a stored card photo. */
  sourceUri: string;
  /**
   * The size the capture API reported for this photo. Compared against the decoded pixel
   * dimensions to work out whether the image actually needs turning — see
   * `camera/exif.ts#resolveOrientation` for why the EXIF tag alone can't be trusted for that.
   */
  sourceWidth: number;
  sourceHeight: number;
};

export type RevealParams = {
  /** The developed photo, already written to permanent storage by the camera. */
  photoUri: string;
  thumbUri: string;
  /** Which filter was baked in, carried through so the row records it. */
  filterId: string | null;
};

/**
 * The Share screen takes either a single card or a whole Set — exactly one of these is set.
 * `setStartDate` is the Set's Monday key, the same identifier `set_reveals` uses.
 */
export type ExportParams = { cardId: number; setStartDate?: undefined } | { cardId?: undefined; setStartDate: string };

export type CardDetailParams = {
  cardId: number;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Permissions: PermissionsParams | undefined;
  Main: undefined;
  Camera: undefined;
  Develop: DevelopParams;
  Reveal: RevealParams;
  CardDetail: CardDetailParams;
  Export: ExportParams;
  SkinSelector: undefined;
  Settings: undefined;
};
