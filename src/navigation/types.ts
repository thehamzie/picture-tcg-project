export type TabParamList = {
  Home: undefined;
  Collection: undefined;
  Open: undefined;
};

export type PermissionsParams = {
  reminderHour: number;
  reminderMinute: number;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Permissions: PermissionsParams | undefined;
  Main: undefined;
  EmptyFirstRun: undefined;
  LookBack: undefined;
};
