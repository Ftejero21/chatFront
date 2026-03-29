interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
  clientId?: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: 'signin' | 'signup' | 'use';
  ux_mode?: 'popup' | 'redirect';
  itp_support?: boolean;
}

interface GooglePromptMomentNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
}

interface GoogleAccountsId {
  initialize(config: GoogleIdConfiguration): void;
  prompt(
    momentListener?: (notification: GooglePromptMomentNotification) => void
  ): void;
  cancel?: () => void;
}

interface GoogleAccounts {
  id: GoogleAccountsId;
}

interface GoogleIdentity {
  accounts: GoogleAccounts;
}

interface Window {
  google?: GoogleIdentity;
  __env?: Record<string, unknown>;
}
