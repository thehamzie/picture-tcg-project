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

export type RevealParams = {
  photoUri: string;
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
  Reveal: RevealParams;
  CardDetail: CardDetailParams;
  Export: ExportParams;
  SkinSelector: undefined;
  Settings: undefined;
};
