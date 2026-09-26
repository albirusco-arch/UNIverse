# Universe

App mobile (iOS e Android) per studenti universitari e ricercatori che studiano all'estero — Erasmus+, scambi overseas o lauree complete. L'interfaccia è in inglese.

- **Solo studenti**: si entra solo con l'email universitaria (oltre 10.000 università riconosciute dal dominio).
- **Ricerca AI con fonti**: abbinamento esami, requisiti d'ingresso, borse di studio e visti; ogni voce cita una pagina ufficiale e ciò che non è confermato viene segnalato.
- **UNIVERSE score**: indici ESG e qualità della didattica ricercati dall'AI (conta solo l'evidenza verificata) più i voti degli studenti verificati. Le università migliori vengono promosse come «Top rated».
- **Community personalizzata**: il feed «For you» si adatta a corsi, ricerche e università di ogni studente.
- **Gruppi e canali** (un mix tra WhatsApp e Telegram), **club studenteschi** con chat.

Costruita con Expo (React Native + TypeScript), Supabase (database, login, chat in tempo reale, funzioni server) e l'API di Claude (ricerca web).

![Schermate di Universe](docs/preview.jpg)

---

## Le funzioni

| Funzione | Come funziona |
| --- | --- |
| **Nuovo brand** | Logo «U» con orbita (`assets/brand/`), palette blu → viola su sfondo quasi nero (`src/theme/tokens.ts`), icone e splash rigenerati. |
| **Login con email universitaria** | Codice a 6 cifre via email. L'app riconosce l'università dal dominio (anche sottodomini come `studenti.unimi.it`) e la precompila nel profilo. Il database rifiuta comunque le email non universitarie (trigger su `auth.users`): Gmail, Outlook ecc. non possono registrarsi. Domini mancanti si aggiungono in `email_allowlist`. |
| **Ricerca AI** (tab *AI*) | Quattro tipi: *Course match* (esame per esame con il catalogo della destinazione), *Entry requirements*, *Scholarships*, *Visa* (USA, Asia, UK… e libera circolazione UE). Ogni report mostra fonti numerate, data di verifica, anno accademico, passaggi, scadenze e avvertenze. |
| **Qualità delle università** | Scheda *Quality* di ogni università. ESG (ambientale, sociale, governance) e didattica sono ricercati da Claude su rapporti di sostenibilità, ranking e sondaggi ufficiali: un indicatore conta solo se la sua fonte è stata davvero aperta, e senza abbastanza evidenza il punteggio resta vuoto. Gli studenti votano 4 aspetti (didattica, docenti, ambiente, sostenibilità); si mostrano solo le medie. Score = ESG 35% + didattica 25% + studenti 40%; sotto i 3 voti è «provvisorio». «Top rated» = score ≥ 75 e non provvisorio. |
| **Docenti** | Per evitare rischi di diffamazione e GDPR non ci sono pagine o voti su singoli professori: la qualità dei docenti è una delle dimensioni votate a livello di università. |
| **Community «For you»** | Ogni ricerca, università visitata o salvata e ricerca AI diventa un segnale privato (con decadimento di 2 settimane). Il feed ordina i post per destinazione, università salvate, area di studio, parole chiave dei corsi, freschezza e interazioni, e spiega perché ogni post è lì («Your destination», «You looked at…»). |
| **Gruppi e canali** | Gruppi dove tutti scrivono (WhatsApp) e canali dove scrivono solo gli admin (Telegram); pubblici (si trovano in *Discover*) o privati (codice invito di 8 caratteri). Messaggi in tempo reale, non letti, separatori per giorno, segnala/blocca/elimina. |
| **Club studenteschi** | Scheda *Clubs* di ogni università: sezioni ESN, associazioni, sport. I club trovati dall'AI citano la pagina ufficiale; gli studenti possono suggerirne altri. Ogni club ha la sua chat. |
| **Dati Erasmus e overseas** | Catalogo di 10.265 università in 200 paesi (lista *university-domains*, licenza MIT) con i domini email, più codici Erasmus dal registro europeo *Erasmus Without Paper* quando raggiungibile. Filtro Worldwide / Erasmus+ / Overseas in *Explore*. |

## Struttura

```
src/app/                    Schermate (Expo Router)
  welcome.tsx, auth.tsx     Benvenuto e login con email universitaria
  onboarding.tsx            Profilo (università già riconosciuta dall'email) e destinazione
  (tabs)/                   Home, Explore, AI, Community, Groups
  university/[id].tsx       Overview, Quality, Courses, Clubs, Community
  research/[id].tsx         Report AI con fonti e verifiche
  rate/[id].tsx             Voto all'università
  group/…, club/…           Chat, info gruppo, nuovo gruppo, codice invito, club
  profile.tsx, settings.tsx, legal/[doc].tsx
src/components/             Design system (ui/) e componenti
src/data/api/               Accesso ai dati (Supabase o demo), un file per area
src/data/catalogue.ts       Catalogo università incluso nell'app
src/lib/                    Sessione, riconoscimento email, score, ranking del feed
src/legal/documents.ts      BOZZE di Termini, Privacy e Linee guida
scripts/                    Import del catalogo università e generazione del seed
supabase/migrations/        Schema del database con Row Level Security
supabase/functions/         research, university-insights, delete-account
supabase/tests/             Test del database su Postgres in memoria
```

## Provarla subito (modalità demo)

Senza backend l'app usa dati di esempio (etichetta «Demo») e report AI dimostrativi.

```bash
npm install
npx expo start
```

Inquadra il QR code con **Expo Go**. In demo qualsiasi email universitaria e qualsiasi codice a 6 cifre funzionano (prova `nome@studenti.unimi.it`).

## Collegare il backend

1. **Crea un progetto Supabase** su [supabase.com](https://supabase.com), in regione UE (GDPR).
2. **Database**:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ID-PROGETTO>
   npx supabase db push --include-seed
   ```
   Le migrazioni creano tabelle, regole di accesso (RLS), il controllo delle email universitarie, lo score e i gruppi; il seed carica paesi e università.
3. **Login via email**: in *Authentication → Email Templates* aggiungi `{{ .Token }}` al template «Magic Link» (codice a 6 cifre) e imposta la lunghezza OTP a 6.
4. **Chat in tempo reale**: già attiva (la migrazione aggiunge `group_messages` alla pubblicazione Realtime).
5. **Chiave dell'API di Claude** (da [console.anthropic.com](https://console.anthropic.com)):
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   # opzionali:
   #   RESEARCH_DAILY_LIMIT=5   ricerche AI per studente al giorno
   #   INSIGHTS_DAILY_LIMIT=3   ricerche ESG/didattica per studente al giorno
   #   INSIGHTS_FRESH_DAYS=90   dopo quanti giorni un'analisi ESG può essere rifatta
   #   CLAUDE_MODEL=claude-opus-5
   ```
6. **Funzioni server**:
   ```bash
   npx supabase functions deploy research
   npx supabase functions deploy university-insights
   npx supabase functions deploy delete-account
   ```
   Una ricerca dura 1–3 minuti: il piano Free di Supabase ferma le funzioni dopo 150 secondi, quindi in produzione serve il **piano Pro**.
7. **App**: copia `.env.example` in `.env.local` e inserisci URL e *anon key* (*Settings → API*).

### Come lavorano gli agenti AI

`research` e `university-insights` salvano la richiesta, rispondono subito e continuano in background; l'app aggiorna la schermata finché il report è pronto.

- Modello `claude-opus-5` con ricerca web e lettura delle pagine lato server; se il modello rifiuta una richiesta, l'API la ripete su un modello di riserva.
- Il report è validato contro uno schema (`schema.ts`); se non è valido l'agente deve correggerlo.
- **Verifica delle fonti**: ogni URL citato è confrontato con quelli davvero trovati o aperti durante la ricerca. Una voce è «Official source» solo se poggia su una pagina ufficiale consultata; altrimenti è «To verify». Per l'ESG servono almeno 2 indicatori verificati, per la didattica almeno 1, altrimenti niente punteggio; i club senza una pagina che li citi vengono scartati.
- Ricerche identiche sono riusate per 14 giorni, le analisi ESG per 90; limiti giornalieri per studente per contenere i costi (indicativamente 0,50–2 $ a ricerca: misuralo sui primi utenti).

### Aggiornare il catalogo università

```bash
npm run import:universities   # scarica la lista mondiale + registro Erasmus (se raggiungibile)
npm run gen:seed              # rigenera supabase/seed.sql
npx supabase db push --include-seed
```

Le voci curate a mano sono in `scripts/data/universities.curated.json` e hanno la precedenza.

### Moderazione

Post, commenti, messaggi, gruppi e club si possono segnalare; gli utenti si possono bloccare (obbligatorio per l'App Store). Un contenuto segnalato da 3 persone viene nascosto automaticamente. Le segnalazioni vanno controllate entro 24 ore:

```sql
select * from reports where status = 'open' order by created_at;
```

## Pubblicare sull'App Store

1. **Apple Developer Program** (99 $/anno) su [developer.apple.com](https://developer.apple.com); per una società serve il D-U-N-S.
2. Controlla il bundle ID in `app.json` (`com.universeapp.mobile`): è unico e non si cambia dopo la prima pubblicazione.
3. Collega EAS (compila nel cloud, non serve un Mac):
   ```bash
   npx eas-cli login
   npx eas-cli init
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://... --visibility plaintext
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value ... --visibility plaintext
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPPORT_EMAIL --value ... --visibility plaintext
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_REVIEW_EMAIL --value ... --visibility plaintext
   ```
4. Compila: `npx eas-cli build --platform ios --profile production`.
5. Crea l'app su [App Store Connect](https://appstoreconnect.apple.com), inserisci il suo *Apple ID* in `eas.json` (`ascAppId`) e invia: `npx eas-cli submit --platform ios --latest`.
6. Provala con **TestFlight**, poi inviala in revisione.

Da preparare per la revisione Apple:

- [ ] **Termini, Privacy e Linee guida**: completa i `[PLACEHOLDER]` in `src/legal/documents.ts`, falli rivedere da un legale e pubblicali su un sito.
- [ ] **Email e URL di supporto** (`EXPO_PUBLIC_SUPPORT_EMAIL`).
- [ ] **Account per i revisori**: non hanno un'email universitaria né ricevono i codici. Crea in Supabase un utente con password, aggiungi la sua email a `email_allowlist` (`insert into email_allowlist (value, note) values ('review@tuodominio.com', 'App Store review');`), imposta `EXPO_PUBLIC_REVIEW_EMAIL` e scrivi email e password nelle note per la revisione.
- [ ] **Privacy dell'app** su App Store Connect: email, nome, contenuti degli utenti e interazioni con il prodotto (personalizzazione), collegati all'identità, nessun tracciamento (come `privacyManifests` in `app.json`).
- [ ] **Screenshot** per iPhone da 6,9" (1320 × 2868).
- [ ] **Classificazione per età**: contenuti generati dagli utenti e chat, con moderazione.
- [ ] **Note per la revisione**: l'AI cerca solo pagine pubbliche e ogni risultato mostra la sua fonte; lo score è un indicatore d'opinione, non un ranking ufficiale.

Per Android: stesso procedimento con `--platform android` e un account Google Play Console (25 $ una tantum).

## Comandi utili

```bash
npm run typecheck             # TypeScript per app, test e funzioni server
npm run lint                  # ESLint
npm test                      # score, feed, email, import Erasmus, agenti AI (Claude simulato), database (Postgres in memoria)
npm run import:universities   # aggiorna il catalogo università
npm run gen:seed              # rigenera supabase/seed.sql dal catalogo
```
