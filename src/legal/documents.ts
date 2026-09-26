import { getLanguage, type Language } from '@/i18n';

/**
 * DRAFT legal texts in English and Italian. They describe how the app actually
 * works (data collected, moderation, AI research, ratings, groups) but must be
 * reviewed by a lawyer and completed with the company details before
 * publishing. Replace every [PLACEHOLDER] in both languages.
 */
export type LegalDocId = 'terms' | 'privacy' | 'guidelines';

type LegalDoc = { title: string; updated: string; sections: { heading: string; body: string }[] };

const en: Record<LegalDocId, LegalDoc> = {
  guidelines: {
    title: 'Community Guidelines',
    updated: 'Draft',
    sections: [
      {
        heading: 'Students only',
        body: 'UNIVERSE is for university students and researchers. Accounts are created with a university email address; do not share your account or sign up for someone else.',
      },
      {
        heading: 'Be accurate',
        body: 'Share requirements and equivalences only from your own experience or from official sources, and say which academic year they refer to. Wrong information can cost other students credits or money.',
      },
      {
        heading: 'Be kind',
        body: 'No harassment, hate speech, discrimination, threats, sexual content or personal attacks — in posts, comments, groups, channels or club chats. There is zero tolerance for objectionable content and abusive users.',
      },
      {
        heading: 'Fair ratings',
        body: 'Rate only universities where you actually studied or worked, based on your own experience. Ratings are about the university as a whole: do not name, rate or target individual professors or staff members.',
      },
      {
        heading: 'Protect privacy',
        body: 'Do not post other people’s personal data, grades, documents, screenshots of private chats or contact details. Do not share a private group’s invite code with people it was not meant for.',
      },
      { heading: 'No spam', body: 'No advertising, affiliate links, paid essay services, mass invites or repeated posts.' },
      {
        heading: 'Moderation',
        body: 'Every post, comment, message, group and club can be reported. Reported content is reviewed within 24 hours; content that breaks these rules is removed and repeat offenders are banned. You can block any user at any time.',
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: 'Draft',
    sections: [
      {
        heading: 'The service',
        body: 'UNIVERSE ([COMPANY NAME], [ADDRESS]) helps students and researchers plan study periods abroad. By creating an account you agree to these terms and to the Community Guidelines.',
      },
      {
        heading: 'Eligibility',
        body: 'You must be at least 16 years old and sign in with an email address issued by a university or research institution. We may ask for further proof of student status and suspend accounts that do not meet this requirement.',
      },
      {
        heading: 'Information is guidance, not approval',
        body: 'Course matches, entry requirements, scholarships and visa information are researched automatically from public sources and may be incomplete or out of date. Each item shows its source and the date it was checked, and anything not confirmed on an official page is flagged. Course recognition is decided only by your home institution through the Learning Agreement, admission only by the host university, and visas only by the competent authorities: always confirm with them.',
      },
      {
        heading: 'Scores and ratings',
        body: 'The UNIVERSE score combines ESG and teaching indicators found in public sources with averaged ratings from verified students. It is an opinion-based indicator for orientation, not an official ranking or accreditation.',
      },
      {
        heading: 'Your content',
        body: 'You keep ownership of what you post (posts, comments, messages, ratings, equivalences, club suggestions) and grant UNIVERSE a licence to display it in the app. You are responsible for its accuracy and lawfulness.',
      },
      {
        heading: 'Acceptable use',
        body: 'You may not misuse the service, scrape it, or impersonate others. We may remove content and suspend accounts that break these terms or the Community Guidelines.',
      },
      {
        heading: 'Liability',
        body: 'The service is provided “as is”. To the extent permitted by law, UNIVERSE is not liable for decisions taken on the basis of information in the app.',
      },
      { heading: 'Contact', body: 'Questions: [SUPPORT EMAIL]. Governing law: [JURISDICTION].' },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'Draft',
    sections: [
      { heading: 'Controller', body: '[COMPANY NAME], [ADDRESS], [SUPPORT EMAIL].' },
      {
        heading: 'Data we collect',
        body: 'University email address (to sign in and verify student status) and the university linked to its domain; the profile you enter (name, home university, field, level, destination, exchange period); content you post (posts, comments, group messages, equivalences, club suggestions); university ratings; AI research requests and results; saved universities; group memberships; reports and blocks. We do not use advertising trackers.',
      },
      {
        heading: 'Personalisation',
        body: 'To rank the “For you” feed we store what you search, the universities you view or save and the research you request. These signals are private to you, never shown to other students, and deleted with your account.',
      },
      {
        heading: 'Ratings',
        body: 'Your university ratings are stored with your account so you can update them, but only averages are shown to other students. Ratings of individual people are not collected.',
      },
      {
        heading: 'AI research',
        body: 'When you request AI research, your request (universities, programme, courses, citizenship, notes) is sent to our AI provider (Anthropic) to search public web pages. Do not include personal data in the notes field.',
      },
      {
        heading: 'Processors',
        body: 'Supabase (database, authentication and realtime chat, EU region recommended) and Anthropic (AI processing). Data is transferred outside the EU only under appropriate safeguards.',
      },
      {
        heading: 'Retention and deletion',
        body: 'You can delete your account in Settings at any time: your profile, posts, comments, messages, ratings, research and personalisation signals are deleted permanently.',
      },
      {
        heading: 'Your rights',
        body: 'Under the GDPR you can access, correct, export or delete your data and object to processing. Contact [SUPPORT EMAIL] or your supervisory authority.',
      },
    ],
  },
};

const it: Record<LegalDocId, LegalDoc> = {
  guidelines: {
    title: 'Linee guida della community',
    updated: 'Bozza',
    sections: [
      {
        heading: 'Solo studenti',
        body: 'UNIVERSE è per studenti universitari e ricercatori. Gli account si creano con un indirizzo email universitario; non condividere il tuo account e non registrarti per conto di altri.',
      },
      {
        heading: 'Sii preciso',
        body: 'Condividi requisiti ed equivalenze solo per esperienza diretta o da fonti ufficiali, indicando l’anno accademico a cui si riferiscono. Un’informazione sbagliata può costare crediti o denaro ad altri studenti.',
      },
      {
        heading: 'Sii gentile',
        body: 'Niente molestie, incitamento all’odio, discriminazioni, minacce, contenuti sessuali o attacchi personali, nei post, nei commenti, nei gruppi, nei canali e nelle chat dei club. Tolleranza zero per contenuti offensivi e utenti molesti.',
      },
      {
        heading: 'Valutazioni corrette',
        body: 'Valuta solo le università in cui hai davvero studiato o lavorato, in base alla tua esperienza. Le valutazioni riguardano l’università nel suo insieme: non nominare, valutare o prendere di mira singoli docenti o membri del personale.',
      },
      {
        heading: 'Rispetta la privacy',
        body: 'Non pubblicare dati personali, voti, documenti, screenshot di chat private o contatti di altre persone. Non condividere il codice invito di un gruppo privato con chi non ne fa parte.',
      },
      { heading: 'Niente spam', body: 'Niente pubblicità, link di affiliazione, servizi di tesi a pagamento, inviti di massa o post ripetuti.' },
      {
        heading: 'Moderazione',
        body: 'Ogni post, commento, messaggio, gruppo e club può essere segnalato. I contenuti segnalati vengono esaminati entro 24 ore; quelli che violano queste regole vengono rimossi e chi le viola ripetutamente viene escluso. Puoi bloccare qualsiasi utente in qualsiasi momento.',
      },
    ],
  },
  terms: {
    title: 'Termini d’uso',
    updated: 'Bozza',
    sections: [
      {
        heading: 'Il servizio',
        body: 'UNIVERSE ([RAGIONE SOCIALE], [INDIRIZZO]) aiuta studenti e ricercatori a pianificare periodi di studio all’estero. Creando un account accetti questi termini e le Linee guida della community.',
      },
      {
        heading: 'Requisiti',
        body: 'Devi avere almeno 16 anni e accedere con un indirizzo email rilasciato da un’università o da un istituto di ricerca. Possiamo chiedere ulteriori prove dello status di studente e sospendere gli account che non soddisfano questo requisito.',
      },
      {
        heading: 'Informazioni orientative, non approvazioni',
        body: 'Abbinamenti esami, requisiti d’ingresso, borse di studio e informazioni sui visti sono ricercati automaticamente da fonti pubbliche e possono essere incompleti o non aggiornati. Ogni voce mostra la sua fonte e la data della verifica, e ciò che non è confermato su una pagina ufficiale viene segnalato. Il riconoscimento degli esami spetta solo alla tua università tramite il Learning Agreement, l’ammissione solo all’università ospitante e i visti solo alle autorità competenti: verifica sempre con loro.',
      },
      {
        heading: 'Punteggi e valutazioni',
        body: 'Lo UNIVERSE score combina indicatori ESG e di didattica tratti da fonti pubbliche con le valutazioni medie di studenti verificati. È un indicatore d’opinione a scopo orientativo, non un ranking ufficiale né un accreditamento.',
      },
      {
        heading: 'I tuoi contenuti',
        body: 'Resti titolare di ciò che pubblichi (post, commenti, messaggi, valutazioni, equivalenze, suggerimenti di club) e concedi a UNIVERSE una licenza per mostrarlo nell’app. Sei responsabile della sua correttezza e liceità.',
      },
      {
        heading: 'Uso consentito',
        body: 'Non puoi abusare del servizio, estrarne dati in modo automatico o spacciarti per altri. Possiamo rimuovere contenuti e sospendere account che violano questi termini o le Linee guida della community.',
      },
      {
        heading: 'Responsabilità',
        body: 'Il servizio è fornito “così com’è”. Nei limiti consentiti dalla legge, UNIVERSE non è responsabile delle decisioni prese sulla base delle informazioni presenti nell’app.',
      },
      { heading: 'Contatti', body: 'Domande: [EMAIL DI SUPPORTO]. Legge applicabile: [GIURISDIZIONE].' },
    ],
  },
  privacy: {
    title: 'Informativa sulla privacy',
    updated: 'Bozza',
    sections: [
      { heading: 'Titolare del trattamento', body: '[RAGIONE SOCIALE], [INDIRIZZO], [EMAIL DI SUPPORTO].' },
      {
        heading: 'Dati raccolti',
        body: 'Indirizzo email universitario (per l’accesso e la verifica dello status di studente) e l’università collegata al suo dominio; il profilo che inserisci (nome, università di provenienza, area, livello, destinazione, periodo di scambio); i contenuti che pubblichi (post, commenti, messaggi nei gruppi, equivalenze, suggerimenti di club); le valutazioni delle università; richieste e risultati delle ricerche AI; università salvate; iscrizioni ai gruppi; segnalazioni e blocchi. Non usiamo tracker pubblicitari.',
      },
      {
        heading: 'Personalizzazione',
        body: 'Per ordinare il feed «Per te» memorizziamo ciò che cerchi, le università che visiti o salvi e le ricerche che richiedi. Questi segnali sono privati, non vengono mai mostrati ad altri studenti e vengono eliminati con il tuo account.',
      },
      {
        heading: 'Valutazioni',
        body: 'Le tue valutazioni delle università sono salvate con il tuo account per permetterti di aggiornarle, ma agli altri studenti mostriamo solo le medie. Non raccogliamo valutazioni di singole persone.',
      },
      {
        heading: 'Ricerca AI',
        body: 'Quando richiedi una ricerca AI, la tua richiesta (università, corso, esami, cittadinanza, note) viene inviata al nostro fornitore di AI (Anthropic) per cercare pagine web pubbliche. Non inserire dati personali nel campo note.',
      },
      {
        heading: 'Responsabili del trattamento',
        body: 'Supabase (database, autenticazione e chat in tempo reale, regione UE consigliata) e Anthropic (elaborazione AI). I dati sono trasferiti fuori dall’UE solo con garanzie adeguate.',
      },
      {
        heading: 'Conservazione ed eliminazione',
        body: 'Puoi eliminare il tuo account in qualsiasi momento dalle Impostazioni: profilo, post, commenti, messaggi, valutazioni, ricerche e segnali di personalizzazione vengono eliminati definitivamente.',
      },
      {
        heading: 'I tuoi diritti',
        body: 'In base al GDPR puoi accedere ai tuoi dati, correggerli, esportarli o cancellarli e opporti al trattamento. Scrivi a [EMAIL DI SUPPORTO] o all’autorità di controllo.',
      },
    ],
  },
};

const docs: Record<Language, Record<LegalDocId, LegalDoc>> = { en, it };

export function getLegalDoc(id: LegalDocId): LegalDoc {
  return docs[getLanguage()][id];
}
