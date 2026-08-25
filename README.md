# Islam-Kinderakademie

Web-first Lernplattform der Islam-Kinderakademie auf Basis von Expo 57, React Native, React Native Web und Supabase.

## Voraussetzungen

- Node.js 24 empfohlen; mindestens Node `22.13.x`
- npm
- ein Supabase-Projekt für Auth, Datenbank und privaten Storage

Node 23 wird von Expo 57 beziehungsweise Metro 0.84 nicht unterstützt. Mit nvm kann die empfohlene Version so aktiviert werden:

```bash
nvm install 24
nvm use 24
export PATH="$NVM_BIN:$PATH"
hash -r

command -v node
command -v npm
node -v
```

`node` und `npm` müssen anschließend beide aus einem Pfad unter `~/.nvm/versions/node/v24.../bin/` kommen und `node -v` muss eine Version `v24.x` ausgeben. Zeigt einer der Pfade weiterhin auf `/opt/homebrew/bin/`, dürfen die Release-Prüfungen nicht mit diesem Homebrew-Binary ausgeführt werden. Bis die PATH-Reihenfolge dauerhaft korrigiert ist, können die nvm-Binaries ausdrücklich verwendet werden:

```bash
"$NVM_BIN/npm" install
"$NVM_BIN/npx" expo-doctor@latest
```

## Enthaltene Bereiche

- Kinderansicht mit Übersicht, Lernreisen, Kalender und Islam-Pass
- Elternbereich mit Kinderprofilen, Terminen und Mitteilungen
- Team-Bereich mit Curriculum, Lektionen, Zeitgruppen und Medien
- Lektionsablauf mit Einstiegstext, geschütztem PDF-Reader, geplanter Live-Zoom-Vorlesung und separatem Multiple-Choice-Quiz
- responsive Desktop- und Mobilnavigation
- öffentliche Werbe-Startseite sowie Registrierung und Anmeldung
- geschützte Akademie-Routen mit Expo Router
- Supabase-Sitzungsspeicherung im Browser sowie verschlüsselt über Expo SecureStore auf iOS und Android
- Accountbereich mit Profil-, Passwort-, sicherer Lösch- und Abmeldefunktion
- separates Admin-Dashboard mit Konten- und Rollenverwaltung
- Admins können mit demselben Konto zwischen Administration und einem auf die eigenen Kinder begrenzten Elternbereich wechseln
- durchsuchbare Themen- und Quizverwaltung im Admin-Dashboard zum Bearbeiten vorhandener Lektionen sowie zum Anlegen und Bearbeiten von Multiple-Choice-Fragen
- hierarchische Lektionsverwaltung nach Akademiejahr → Lernreise → Lektion mit Filtern sowie Admin-Sammelfreigabe
- frei verwaltbare Altersgruppen und anklickbare Akademiejahre; Lernreisen bleiben verborgen, bis ein Jahr ausgewählt wurde
- kalender- und zeitgestützte Planung von Live-Terminen
- getrennte Admin-Freigabe für Lektionen und Quizze; die Quizfreigabe ist unabhängig vom Live-Terminstatus
- Supabase-Datenschicht für CRUD, Lernfortschritt, Abgaben und Medien
- verpflichtende Zahlungsart und Name des verwendeten PayPal- oder Bankkontos bei der Registrierung sowie eine geschützte Admin-Zahlungsübersicht
- mehrere Zeitgruppen pro Altersgruppe mit verpflichtender Elternanfrage und Admin-Freigabe; Lernreisen sind sofort sichtbar, ihre Inhalte erst nach der Freigabe
- mehrere Admin-PDF-Uploads pro Lektion, die für berechtigte Kinder direkt in der Lektion als Reader erscheinen

Das gelieferte Akademiekonzept 2026/27 ist als strukturierter Lehrplan enthalten. Es werden keine künstlichen Auth-Nutzer, Kinderprofile oder Passwörter angelegt.

## Supabase einrichten

1. Die Beispieldatei kopieren und die Werte aus **Supabase → Project Settings → API** eintragen:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=DEIN_PUBLISHABLE_KEY
EXPO_PUBLIC_HCAPTCHA_SITE_KEY=DEIN_HCAPTCHA_SITEKEY
EXPO_PUBLIC_HCAPTCHA_BASE_URL=https://bufib.github.io
```

In der App dürfen nur der Supabase-Publishable-Key und der öffentliche hCaptcha-Sitekey verwendet werden. Der `service_role`-Key und der hCaptcha-Secret-Key dürfen niemals im Client landen. Der hCaptcha-Secret-Key gehört ausschließlich in die CAPTCHA-Konfiguration des gehosteten Supabase-Projekts. Nur für einen separat gestarteten lokalen Supabase-Auth-Dienst wird `SUPABASE_AUTH_CAPTCHA_SECRET` benötigt; diese Variable gehört nicht in die App-`.env`.

Für hCaptcha einen eigenen Sitekey anlegen und die Produktionsdomain freigeben. Anschließend in **Supabase → Authentication → Attack Protection → CAPTCHA Protection** hCaptcha auswählen, den hCaptcha-Secret-Key eintragen und den Schutz aktivieren. Supabase prüft CAPTCHA global auf Registrierung, Anmeldung und Passwort-Reset; die App sendet deshalb bei allen drei Abläufen sowie bei der erneuten Anmeldung vor einer Accountlöschung ein frisches Token.

Unter **Supabase → Authentication → Password security** zusätzlich mindestens 12 Zeichen sowie die stärkste Zeichenanforderung mit Klein-/Großbuchstaben, Zahlen und Sonderzeichen einstellen. Falls der Tarif es unterstützt, außerdem die Prüfung gegen bekannte geleakte Passwörter aktivieren. Die gleichen Regeln sind im Client und für die lokale Supabase-Instanz bereits hinterlegt.

2. Die Migration auf das verknüpfte Supabase-Projekt anwenden:

```bash
npx supabase db push
```

Die Migrationen gleichen `profiles` und `user_roles` ab, reparieren fehlende Profile älterer Auth-Konten, richten den Trigger für neue Elternkonten ein und legen das Akademie-Datenmodell an:

- `academy_years`, `age_groups`, `learning_journeys`, `lessons` und `lesson_steps`
- `children`, `groups` und `group_members`
- `live_sessions`
- `lesson_quizzes`, `quiz_questions`, `quiz_options` und geschützte Lösungsschlüssel
- `quiz_attempts` und `quiz_attempt_answers`
- `child_lesson_progress`, `child_step_progress` und `submissions`
- `badges` und `child_badges`
- `media_assets`, `lesson_documents` und `messages`
- `payment_agreements` und `monthly_payments`

Alle Tabellen sind durch RLS geschützt. Familien sehen nur ihre eigenen Kinder- und Fortschrittsdaten sowie vom Admin freigegebene Inhalte; Lehrkräfte und Admins können Akademie-Inhalte vorbereiten. Dateien liegen im privaten Storage-Bucket `academy-media` und werden über kurzlebige signierte URLs geöffnet.

Die Migration `20260814065000_academy_2026_27_curriculum.sql` entfernt die früheren Beispieldaten und richtet das Akademiejahr 2026/27 ein. Enthalten sind zwei Altersgruppen, vier jährliche Lernreisen, ein 40-Wochen-Themengerüst je Altersgruppe, zwei Kursgruppen, sechs Abzeichen und eine Startmitteilung. Reale Zoom-Termine, Links und Lehrkraft-Zuordnungen werden anschließend im geschützten Team-Bereich gepflegt.

Die Migration `20260814070000_lesson_live_quizzes.sql` ergänzt den aktuellen Lektionsablauf aus Einstiegstext, geplantem Live-Unterricht und Multiple-Choice-Quiz. Richtige Antworten sind von den sichtbaren Antwortmöglichkeiten getrennt und werden ausschließlich durch eine geschützte Supabase-Funktion ausgewertet.

Die Migration `20260815080000_manual_lesson_quiz_release.sql` ergänzt den Freigabe-Workflow. Lektionen müssen den Status `published` haben und werden anschließend manuell durch einen Admin freigegeben. Wird eine Lektion gesperrt oder wieder zum Entwurf, wird auch ihr Quiz gesperrt. Die spätere Migration `20260823100000_remove_completed_session_quiz_release_requirement.sql` hebt die historische Live-Termin-Voraussetzung auf: Ein Quiz kann separat freigegeben werden, sobald seine veröffentlichte Lektion freigegeben ist.

Die Migration `20260815100000_dynamic_age_groups.sql` überführt Altersgruppen in eine eigene Tabelle. Admins können sie unter **Curriculum & Altersgruppen** anlegen, bearbeiten und löschen, solange sie nicht von Kindern, Lernreisen oder Zeitgruppen verwendet werden.

Die Migration `20260821090000_payment_payer_names.sql` sichert den Zahlungsbereich ab. Neue Registrierungen müssen PayPal oder Banküberweisung sowie den Namen des verwendeten Zahlungskontos angeben. Der Monatsbeitrag wird serverseitig auf 14,99 Euro festgelegt; IBAN, Kontonummern und PayPal-Zugangsdaten werden nicht erfasst. Nur Admins können diese Zahlungsdaten lesen.

Die Migration `20260821110000_time_group_approval.sql` trennt Altersgruppen und Zeitgruppen fachlich. Beim Kinderprofil wird zuerst die Altersgruppe und anschließend eine passende Zeitgruppe des aktiven Akademiejahres ausgewählt. Altersgruppe und passende Lernreisen sind sofort sichtbar; die Zeitgruppe bleibt bis zur Admin-Freigabe angefragt. Erst danach werden Lektionen, Quizze, Termine, Links und gruppenspezifische Mitteilungen zugänglich.

Die Migration `20260821113000_time_group_age_integrity.sql` verhindert nachträgliche Änderungen, durch die Zeitgruppe, Akademiejahr und altersgruppenspezifische Lektion eines Termins auseinanderfallen würden.

Die Migration `20260821114500_time_group_request_serialization.sql` macht gleichzeitige Änderungen eines Kinderprofils und Admin-Entscheidungen konfliktfrei und verhindert neue Freigaben für inaktive Akademiejahre.

Die Migration `20260821121500_approved_time_group_content_access.sql` lässt Lernreisen der gewählten Altersgruppe sofort sichtbar, sperrt aber Lektionen, Videos, Live-Inhalte, Quizze und neue Fortschrittsdaten bis zur Admin-Freigabe der Zeitgruppe.

Die Migration `20260821123500_admin_assign_child_time_group.sql` erlaubt Admins, freigeschaltete Kinder direkt zwischen passenden aktiven Zeitgruppen derselben Altersgruppe zu verschieben. Die neue Zuordnung gilt sofort; alte Freigaben und offene Anfragen werden beendet.

Die Migration `20260821125500_admin_parent_accounts.sql` macht die Administration zu einer zusätzlichen Rolle: Admins behalten ein normales Elternkonto für ihre eigenen Kinder und können in der App zwischen Administration und Elternbereich wechseln.

Die Migration `20260821131500_lesson_pdf_documents.sql` ergänzt mehrere PDF-Dokumente pro Lektion. Nur Admins können sie einer Lektion zuordnen oder entfernen. Der private Storage-Pfad und die Metadaten sind für Familien nur lesbar, wenn auch die veröffentlichte Lektion freigegeben ist und eine passende genehmigte Zeitgruppe besteht. Die Lektionsseite zeigt die Dokumente über kurzlebige signierte URLs in einem eingebetteten Reader.

Die Migration `20260823120000_harden_account_deletion.sql` ermöglicht eine vollständige Auth-Accountlöschung, ohne aufbewahrte Buchungshistorie zu verlieren: Zahlungsvereinbarungen werden beendet, vom Nutzer getrennt und beim Zahlernamen anonymisiert. Das letzte Admin-Konto ist vor einer Löschung geschützt.

Die Migration `20260823121000_bind_learning_writes_to_lessons.sql` bindet Quizversuche, Lektions- und Schrittfortschritt sowie Abgaben an die konkret freigegebene Lektion. Ein Kind benötigt eine genehmigte Zeitgruppe derselben Altersgruppe und desselben Akademiejahres; eine beliebige andere Gruppenfreigabe genügt nicht.

Die Accountlöschung benötigt zusätzlich die Edge Function. Sie validiert den Bearer-Token selbst und akzeptiert nur eine unmittelbar zuvor per Passwort bestätigte Sitzung:

```bash
npx supabase functions deploy delete-account --no-verify-jwt
```

`verify_jwt` ist für diesen Endpunkt bewusst auf Plattformebene deaktiviert, damit aktuelle Publishable Keys unterstützt werden. Ohne gültigen, durch `auth.getUser()` geprüften User-Token wird der Service-Role-Löschpfad nicht erreicht.

3. Unter **Authentication → URL Configuration** die URLs freigeben:

- Site URL lokal: `http://localhost:8081`
- Redirect lokal: `http://localhost:8081/login`
- Redirect lokal Passwort: `http://localhost:8081/account`
- Redirect Produktion: `https://DEINE-DOMAIN/login`
- Redirect Produktion Passwort: `https://DEINE-DOMAIN/account`
- Redirect App: `islamkinderakademie://login`
- Redirect App Passwort: `islamkinderakademie://account`

## Starten

```bash
npm install
npm run web
```

Die öffentliche Seite liegt unter `/`. Nach der Anmeldung führt `/dashboard` abhängig von der Rolle in den Eltern-, Lehrkraft- oder Adminbereich. Neue Konten erhalten automatisch die Rolle `parent`; Admins können Konten anschließend geschützt unter `/konten` zu Lehrkräften oder weiteren Admins machen.

Eine Lektion wird im Lektionseditor unter **Status & Freigabe** zunächst auf **Veröffentlicht** gesetzt und gespeichert. Danach kann ein Admin sie dort mit **Lektion jetzt freigeben** für Familien sichtbar machen. PDFs werden nach dem ersten Speichern im Abschnitt **PDF-Lesematerial** hochgeladen. Live-Termine verwenden ein separates Kalenderfeld sowie Felder für Beginn und Ende.

## Auf GitHub Pages veröffentlichen

Das Projekt ist für das Repository `Bufib/islam-kinderakademie` und damit für den Unterpfad `/islam-kinderakademie` konfiguriert. Der Workflow `.github/workflows/deploy-pages.yml` baut und veröffentlicht die Web-App automatisch bei jedem Push auf `erweiterung4`. Während des Builds wird außerdem ein Pages-Fallback für direkt aufgerufene dynamische Lektions- und Mitteilungsrouten erzeugt.

Im GitHub-Repository müssen unter **Settings → Secrets and variables → Actions** diese Repository-Secrets angelegt werden:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
EXPO_PUBLIC_HCAPTCHA_SITE_KEY
```

Nur den Publishable Key und den öffentlichen hCaptcha-Sitekey verwenden, niemals den `service_role`- oder hCaptcha-Secret-Key. Unter **Settings → Pages → Build and deployment** anschließend als Quelle **GitHub Actions** auswählen.

In Supabase unter **Authentication → URL Configuration → Redirect URLs** ergänzen:

```text
https://bufib.github.io/islam-kinderakademie/login
https://bufib.github.io/islam-kinderakademie/account
```

Nach einem Push auf `erweiterung4` ist die App unter `https://bufib.github.io/islam-kinderakademie/` erreichbar. Den Fortschritt zeigt GitHub im Tab **Actions** an.

## Prüfungen

```bash
npm run lint
npx tsc --noEmit
npx expo export --platform web
npx expo-doctor@latest
npm audit --omit=dev
```

## Abhängigkeitsaudit vor dem Release

Die aktuell von `npm audit` gemeldeten 20 Einträge sind Kaskaden aus nur zwei transitiven Ursachen: acht hohe Einträge aus `image-size` über Metro und zwölf moderate Einträge aus `uuid` über Expos iOS-Build-Tool `xcode`.

Die hohen Metro-Befunde werden beseitigt, ohne von der durch Expo 57 validierten React-Native-Version `0.86.2` abzuweichen:

```bash
npm install --save-dev --save-exact metro@0.84.5

npm ls metro image-size
npm audit --omit=dev
npx expo-doctor@latest
npm run lint
npx tsc --noEmit
npx expo export --platform web
```

Metro `0.84.5` entfernt die betroffene Abhängigkeit `image-size@1.2.1`. Nach der Installation dürfen deshalb keine hohen `image-size`-/Metro-Befunde mehr verbleiben.

Der moderate Restbefund `GHSA-w5hq-g745-h8pq` folgt dem Pfad `@expo/config-plugins -> xcode@3.0.1 -> uuid@7.0.3`. Er betrifft `uuid.v3()`, `v5()` und `v6()` mit übergebenem Buffer; das verwendete `xcode` ruft nur `uuid.v4()` auf. Ein erzwungener Major-Override von UUID ist daher riskanter als eine befristete, dokumentierte Akzeptanz dieses nicht erreichbaren Build-Pfads. Die Bewertung ist spätestens am 15. September 2026 sowie bei jedem Expo-/xcode-Update zu erneuern.

`npm audit fix --force` nicht verwenden: npm schlägt derzeit inkompatible Expo-Downgrades vor. Expo-Paketstände ausschließlich mit `npx expo install --fix` ausrichten und danach erneut mit Expo Doctor sowie den obigen Build-Prüfungen validieren.
