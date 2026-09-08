import {
  LegalPlaceholder,
  LegalPlaceholderField,
} from "@/components/legal-placeholder";

const fields: LegalPlaceholderField[] = [
  {
    label: "Verantwortliche Stelle",
    placeholder: "[Name, Anschrift und Kontaktdaten ergänzen]",
  },
  {
    label: "Verarbeitete Daten und Zwecke",
    placeholder:
      "[Kontodaten, Kinderprofile, Lernfortschritt, Zahlungszuordnung, Medien und Authentifizierungsdaten vollständig beschreiben]",
  },
  {
    label: "Rechtsgrundlagen",
    placeholder: "[Rechtsgrundlagen für jede Verarbeitung prüfen und ergänzen]",
  },
  {
    label: "Empfänger und eingesetzte Dienste",
    placeholder:
      "[Unter anderem Supabase, hCaptcha, OVHcloud und Zoom rechtlich prüfen und vollständig aufführen]",
  },
  {
    label: "Speicherdauer und Löschung",
    placeholder: "[Fristen und Kriterien je Datenkategorie ergänzen]",
  },
  {
    label: "Rechte betroffener Personen",
    placeholder:
      "[Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit und Beschwerderecht konkretisieren]",
  },
  {
    label: "Kontakt für Datenschutzanfragen",
    placeholder: "[Kontaktstelle und gegebenenfalls Datenschutzbeauftragte ergänzen]",
  },
];

export default function DatenschutzScreen() {
  return (
    <LegalPlaceholder
      title="Datenschutz"
      description="Hier wird künftig transparent erklärt, welche personenbezogenen Daten verarbeitet werden und welche Rechte Familien und Mitarbeitende haben."
      fields={fields}
    />
  );
}
