import ConfirmHcaptcha from "@hcaptcha/react-native-hcaptcha";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { View } from "react-native";

import type {
  AuthCaptchaHandle,
  AuthCaptchaProps,
} from "@/components/auth/auth-captcha.types";
import { ActionButton, AppText } from "@/components/ui/primitives";
import { Palette, Space } from "@/constants/design";
import { hCaptchaBaseUrl } from "@/lib/hcaptcha";

export const AuthCaptcha = forwardRef<AuthCaptchaHandle, AuthCaptchaProps>(
  function AuthCaptcha(
    { siteKey, verified, disabled, onTokenChange, onError },
    forwardedRef,
  ) {
    const captchaRef = useRef<ConfirmHcaptcha>(null);
    const markTokenUsedRef = useRef<(() => void) | null>(null);

    useImperativeHandle(
      forwardedRef,
      () => ({
        reset() {
          markTokenUsedRef.current?.();
          markTokenUsedRef.current = null;
          captchaRef.current?.hide("reset");
          onTokenChange(null);
        },
      }),
      [onTokenChange],
    );

    return (
      <View style={{ gap: Space.sm }}>
        <ActionButton
          label={
            verified
              ? "hCaptcha bestätigt"
              : "hCaptcha-Prüfung durchführen"
          }
          icon={verified ? "check" : "lock"}
          variant="secondary"
          disabled={disabled || verified}
          onPress={() => captchaRef.current?.show()}
        />

        <AppText variant="small" color={Palette.muted}>
          {verified
            ? "Die Bot-Prüfung ist abgeschlossen."
            : "Vor dem Absenden ist eine kurze Bot-Prüfung erforderlich."}
        </AppText>

        <ConfirmHcaptcha
          ref={captchaRef}
          siteKey={siteKey}
          baseUrl={hCaptchaBaseUrl}
          size="invisible"
          languageCode="de"
          onMessage={(event) => {
            const message = event.nativeEvent.data;

            if (event.success) {
              onTokenChange(message);
              markTokenUsedRef.current = event.markUsed ?? null;
              captchaRef.current?.hide("verified");
              return;
            }

            if (
              message === "open" ||
              message === "challenge-closed" ||
              message === "cancel" ||
              message === "loading"
            ) {
              return;
            }

            onTokenChange(null);
            markTokenUsedRef.current = null;
            onError(
              "hCaptcha konnte nicht bestätigt werden. Bitte versuche es erneut.",
            );
          }}
        />
      </View>
    );
  },
);
