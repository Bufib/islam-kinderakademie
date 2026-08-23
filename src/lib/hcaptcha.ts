export const hCaptchaSiteKey =
  process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY?.trim() ?? "";

export const hCaptchaBaseUrl =
  process.env.EXPO_PUBLIC_HCAPTCHA_BASE_URL?.trim() ||
  "https://bufib.github.io";

export const isHCaptchaConfigured = hCaptchaSiteKey.length > 0;
