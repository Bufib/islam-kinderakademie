export type AuthCaptchaHandle = {
  reset: () => void;
};

export type AuthCaptchaProps = {
  siteKey: string;
  verified: boolean;
  disabled?: boolean;
  onTokenChange: (token: string | null) => void;
  onError: (message: string) => void;
};
