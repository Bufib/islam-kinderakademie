import type { ForwardRefExoticComponent, RefAttributes } from "react";

import type {
  AuthCaptchaHandle,
  AuthCaptchaProps,
} from "@/components/auth/auth-captcha.types";

export const AuthCaptcha: ForwardRefExoticComponent<
  AuthCaptchaProps & RefAttributes<AuthCaptchaHandle>
>;
