import {
  LegalPlaceholder,
  LegalPlaceholderField,
} from "@/components/legal-placeholder";

const fields: LegalPlaceholderField[] = [
  {
    label: "Anbieter",
    placeholder: "[Vollständigen Namen oder Organisation ergänzen]",
  },
  {
    label: "Anschrift",
    placeholder: "[Straße, Hausnummer, Postleitzahl und Ort ergänzen]",
  },
  {
    label: "Kontakt",
    placeholder: "[E-Mail-Adresse und gegebenenfalls Telefonnummer ergänzen]",
  },
  {
    label: "Vertretungsberechtigte Person",
    placeholder: "[Name und Funktion ergänzen, falls zutreffend]",
  },
  {
    label: "Weitere Pflichtangaben",
    placeholder:
      "[Rechtsform, Registerangaben, Umsatzsteuer-ID und inhaltlich verantwortliche Person prüfen und ergänzen, soweit erforderlich]",
  },
];

export default function ImpressumScreen() {
  return (
    <LegalPlaceholder
      title="Impressum"
      description="Hier werden künftig die gesetzlich erforderlichen Anbieter- und Kontaktangaben der Islam-Kinderakademie veröffentlicht."
      fields={fields}
    />
  );
}
