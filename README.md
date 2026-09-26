# UNIverse

App mobile (iOS e Android) per studenti universitari e ricercatori che vanno in scambio all'estero: requisiti dei corsi ricercati da un agente AI con **fonte ufficiale per ogni voce**, community di chi ha fatto lo stesso percorso ed **equivalenze approvate** nei learning agreement.

Costruita con Expo (React Native + TypeScript), Supabase (database, login, funzioni server) e l'API di Claude (ricerca web).

![Schermate di UNIverse](docs/preview.jpg)

---

## Cosa è cambiato rispetto al prototipo Figma

| Prototipo Figma | App |
| --- | --- |
| Home scura, tutte le altre schermate chiare con colori diversi | Un unico tema scuro coerente (viola → teal, logo a orbita) su tutte le schermate |
| Contenuti da ammissione USA (SAT, Early Action, tasso di ammissione) | Centrata sullo scambio: università di provenienza → destinazione, esami da far riconoscere, learning agreement |
| Requisiti scritti a mano nell'app | **AI Course Match**: un agente cerca pagine ufficiali e cataloghi dei corsi, fa il match esame per esame e cita la fonte di ogni voce. Il server controlla che ogni fonte citata sia stata davvero aperta durante la ricerca; ciò che non è confermato su una pagina ufficiale viene segnato come «Da verificare» |
| Numeri inventati (6.500+ università, match 92%, +24%) | Solo dati reali: studenti iscritti ed equivalenze condivise |
| Stessa foto di Stanford per ogni università | Copertina con bandiera e colore per regione, nessuna immagine fuorviante |
| «Rate My Professor» e dormitori come pagine separate | Recensioni e alloggi diventano argomenti della community per ogni università (evita rischi legali di diffamazione) |
| Barra di ricerca finta, pulsanti senza azione, pagine inesistenti | Ogni elemento funziona |
| Testo grigio poco leggibile sullo sfondo scuro | Contrasto conforme WCAG AA |
| — | Onboarding, login con codice via email, badge «Studente verificato» per email universitarie, segnalazione e blocco utenti, eliminazione account, italiano/inglese automatici |

Novità pensate per il tuo esempio (biochimica, Milano → Germania):

1. **Il mio percorso**: filtro della community per destinazione e area di studio.
2. **Equivalenze approvate**: gli studenti condividono quali esami sono stati davvero riconosciuti (o rifiutati) e in che anno accademico. L'AI Match mostra «Già approvato per N studenti» accanto ai suoi risultati: fonti ufficiali e dati reali della community insieme.

## Struttura

```
src/app/                 Schermate (Expo Router)
  (tabs)/                Home, Esplora, AI Match, Community, Profilo
  university/[id].tsx    Pagina università (panoramica, corsi, community, vita)
  match/[id].tsx         Report dell'AI con fonti e verifiche
  post/…, equivalence/…  Post, commenti, nuove equivalenze
  onboarding.tsx, auth.tsx, settings.tsx, legal/[doc].tsx
src/components/          Design system (ui/) e componenti
src/data/                Tipi, accesso ai dati (Supabase o demo), catalogo università
src/i18n/                Testi in inglese e italiano
src/legal/documents.ts   BOZZE di Termini, Privacy e Linee guida
supabase/migrations/     Schema del database con Row Level Security
supabase/functions/      course-match (agente AI) e delete-account
supabase/tests/          Test del database su Postgres in memoria
```

## Provarla subito (modalità demo)

Senza backend l'app usa dati di esempio (etichetta «Demo» in alto) e un report AI dimostrativo.

```bash
npm install
npx expo start
```

Inquadra il QR code con l'app **Expo Go** sul telefono. Con `w` si apre anche nel browser.

## Collegare il backend

1. **Crea un progetto Supabase** su [supabase.com](https://supabase.com), preferibilmente in regione UE (GDPR).
2. **Database**:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ID-PROGETTO>
   npx supabase db push --include-seed
   ```
   In alternativa, incolla nell'SQL Editor prima `supabase/migrations/20260926000000_init.sql` e poi `supabase/seed.sql`.
3. **Login via email**: nei template email di Supabase (sezione *Authentication*) aggiungi `{{ .Token }}` al template «Magic Link», così arriva il codice a 6 cifre. Nelle impostazioni del provider Email imposta la lunghezza del codice (OTP) a 6.
4. **Chiave dell'API di Claude** (da [console.anthropic.com](https://console.anthropic.com)):
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   # opzionali: COURSE_MATCH_DAILY_LIMIT=5  CLAUDE_MODEL=claude-opus-5
   ```
5. **Funzioni server**:
   ```bash
   npx supabase functions deploy course-match
   npx supabase functions deploy delete-account
   ```
   Una ricerca dura di solito 1–3 minuti. Il piano Free di Supabase ferma le funzioni dopo 150 secondi, il Pro dopo 400: per la produzione serve il **piano Pro**.
6. **App**: copia `.env.example` in `.env.local` e inserisci URL e *anon key* del progetto (*Settings → API*).

### Come lavora l'agente AI

`supabase/functions/course-match/` riceve la richiesta, salva una riga in `course_matches` e risponde subito; la ricerca continua in background e l'app aggiorna la schermata finché il report non è pronto.

- Modello `claude-opus-5` con ricerca web e lettura delle pagine lato server. Se il modello rifiuta una richiesta, l'API la ripete automaticamente su un modello di riserva.
- Il report è validato contro uno schema; se non è valido, l'agente deve correggerlo.
- **Verifica delle fonti**: ogni URL citato viene confrontato con quelli effettivamente trovati o aperti durante la ricerca. Una voce è «Fonte ufficiale» solo se è supportata da una pagina ufficiale realmente consultata; altrimenti è «Da verificare».
- Le ricerche identiche vengono riusate per 14 giorni e ogni utente ha un limite giornaliero (5 di default), per contenere i costi.
- Il consumo di token e ricerche è registrato nei log della funzione. Il costo di una ricerca è indicativamente tra 0,50 e 2 $; misuralo sui primi utenti reali.

### Moderazione

Segnalazioni e blocchi sono obbligatori per l'App Store nelle app con contenuti degli utenti. Un post o commento segnalato da 3 persone viene nascosto automaticamente. Le segnalazioni vanno controllate entro 24 ore:

```sql
select * from reports where status = 'open' order by created_at;
```

## Pubblicare sull'App Store

1. **Apple Developer Program** (99 $/anno) su [developer.apple.com](https://developer.apple.com). Per iscrivere una società serve il numero D-U-N-S.
2. Controlla il bundle ID in `app.json` (`com.universeapp.mobile`): deve essere unico, e dopo la prima pubblicazione non si può più cambiare.
3. Collega EAS, il servizio Expo che compila l'app nel cloud (non serve un Mac):
   ```bash
   npx eas-cli login
   npx eas-cli init
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://... --visibility plaintext
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value ... --visibility plaintext
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPPORT_EMAIL --value ... --visibility plaintext
   ```
4. Compila: `npx eas-cli build --platform ios --profile production` (EAS gestisce certificati e profili; ti chiederà il login Apple).
5. Crea l'app su [App Store Connect](https://appstoreconnect.apple.com), inserisci il suo *Apple ID* in `eas.json` (`ascAppId`) e invia: `npx eas-cli submit --platform ios --latest`.
6. Provala con **TestFlight**, poi inviala in revisione.

Da preparare per la revisione Apple:

- [ ] **Termini, Privacy e Linee guida**: completa le parti `[PLACEHOLDER]` in `src/legal/documents.ts`, falle rivedere da un legale e pubblicale su un sito (l'URL della privacy policy è obbligatorio).
- [ ] **Email di supporto** (`EXPO_PUBLIC_SUPPORT_EMAIL`) e URL di supporto.
- [ ] **Account per i revisori**: il login via codice non funziona per chi fa la revisione. Crea in Supabase un utente con password, imposta `EXPO_PUBLIC_REVIEW_EMAIL` e scrivi email e password nelle note per la revisione.
- [ ] **Privacy dell'app** su App Store Connect: email, nome e contenuti degli utenti, collegati all'identità, nessun tracciamento (corrisponde a `PrivacyInfo` in `app.json`).
- [ ] **Screenshot** per iPhone da 6,9" (1320 × 2868).
- [ ] **Classificazione per età**: dichiara che ci sono contenuti generati dagli utenti con moderazione.
- [ ] **Note per la revisione**: spiega che l'AI cerca solo pagine pubbliche e che ogni risultato mostra la sua fonte.

Per Android il procedimento è lo stesso con `--platform android` e un account Google Play Console (25 $ una tantum).

## Comandi utili

```bash
npm run typecheck   # TypeScript per app e funzioni server
npm run lint        # ESLint
npm test            # test dell'agente AI (Claude simulato) e del database (Postgres in memoria)
npm run gen:seed    # rigenera supabase/seed.sql da src/data/universities.json
```

Per aggiungere università modifica `src/data/universities.json`, esegui `npm run gen:seed` e ripeti il seed. I domini email servono per il badge «Studente verificato».
