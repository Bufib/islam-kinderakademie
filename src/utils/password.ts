export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_REQUIREMENTS_TEXT =
  "Mindestens 12 Zeichen sowie je ein Kleinbuchstabe, Großbuchstabe, eine Zahl und ein Sonderzeichen.";

export type PasswordValidation = {
  isValid: boolean;
  message: string | null;
};

export function validatePassword(password: string): PasswordValidation {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      isValid: false,
      message: `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`,
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: "Das Passwort benötigt mindestens einen Kleinbuchstaben.",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: "Das Passwort benötigt mindestens einen Großbuchstaben.",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: "Das Passwort benötigt mindestens eine Zahl.",
    };
  }

  if (!/[!@#$%^&*()_+=\[\]{};'\\:"|<>?,.\/`~-]/.test(password)) {
    return {
      isValid: false,
      message: "Das Passwort benötigt mindestens ein Sonderzeichen.",
    };
  }

  return { isValid: true, message: null };
}
