/**
 * DRAFT legal texts. They describe how the app actually works (data collected,
 * moderation, AI research) but must be reviewed by a lawyer and completed with
 * the company details before publishing. Replace every [PLACEHOLDER].
 */
import type { Locale } from '@/i18n';

export type LegalDocId = 'terms' | 'privacy' | 'guidelines';

type LegalDoc = { title: string; updated: string; sections: { heading: string; body: string }[] };

const en: Record<LegalDocId, LegalDoc> = {
  guidelines: {
    title: 'Community Guidelines',
    updated: 'Draft',
    sections: [
      { heading: 'Be accurate', body: 'Share requirements and equivalences only from your own experience or from official sources, and say which academic year they refer to. Wrong information can cost other students credits or money.' },
      { heading: 'Be kind', body: 'No harassment, hate speech, discrimination, threats, sexual content or personal attacks. There is zero tolerance for objectionable content and abusive users.' },
      { heading: 'Protect privacy', body: 'Do not post other people’s personal data, grades, documents or contact details. Do not rate or name individual staff members in a defamatory way.' },
      { heading: 'No spam', body: 'No advertising, affiliate links, paid essay services or repeated posts.' },
      { heading: 'Moderation', body: 'Every post and comment can be reported. Reported content is reviewed within 24 hours; content that breaks these rules is removed and repeat offenders are banned. You can block any user at any time.' },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: 'Draft',
    sections: [
      { heading: 'The service', body: 'UNIverse ([COMPANY NAME], [ADDRESS]) helps students and researchers plan study periods abroad. By creating an account you agree to these terms and to the Community Guidelines.' },
      { heading: 'Information is guidance, not approval', body: 'Course matches and requirements are researched automatically from public sources and may be incomplete or out of date. Each item shows its source and the date it was checked. Recognition of courses is decided only by your home institution through the Learning Agreement: always confirm with your exchange coordinator.' },
      { heading: 'Your content', body: 'You keep ownership of what you post and grant UNIverse a licence to display it in the app. You are responsible for its accuracy and lawfulness.' },
      { heading: 'Acceptable use', body: 'You must be at least 16 years old. You may not misuse the service, scrape it, or impersonate others. We may suspend accounts that break these terms.' },
      { heading: 'Liability', body: 'The service is provided “as is”. To the extent permitted by law, UNIverse is not liable for decisions taken on the basis of information in the app.' },
      { heading: 'Contact', body: 'Questions: [SUPPORT EMAIL]. Governing law: [JURISDICTION].' },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'Draft',
    sections: [
      { heading: 'Controller', body: '[COMPANY NAME], [ADDRESS], [SUPPORT EMAIL].' },
      { heading: 'Data we collect', body: 'Email address (to sign in and verify student status), the profile you enter (name, home university, field, level, destination, exchange period), content you post, course-match requests and results, reports and blocks. We do not use advertising trackers.' },
      { heading: 'AI research', body: 'When you request a course match, your request (universities, programme, course names, notes) is sent to our AI provider (Anthropic) to search public web pages. Do not include personal data in the notes field.' },
      { heading: 'Processors', body: 'Supabase (database and authentication, EU region recommended) and Anthropic (AI processing). Data is transferred outside the EU only under appropriate safeguards.' },
      { heading: 'Retention and deletion', body: 'You can delete your account in Settings at any time: your profile, posts, comments and matches are deleted permanently.' },
      { heading: 'Your rights', body: 'Under the GDPR you can access, correct, export or delete your data and object to processing. Contact [SUPPORT EMAIL] or your supervisory authority.' },
    ],
  },
};

const it: Record<LegalDocId, LegalDoc> = {
  guidelines: {
    title: 'Linee guida della community',
    updated: 'Bozza',
    sections: [
      { heading: 'Sii preciso', body: 'Condividi requisiti ed equivalenze solo se li hai vissuti in prima persona o vengono da fonti ufficiali, indicando l’anno accademico. Un’informazione sbagliata può costare crediti o soldi ad altri studenti.' },
      { heading: 'Sii gentile', body: 'Niente molestie, incitamento all’odio, discriminazioni, minacce, contenuti sessuali o attacchi personali. Tolleranza zero per contenuti offensivi e utenti molesti.' },
      { heading: 'Rispetta la privacy', body: 'Non pubblicare dati personali, voti, documenti o contatti di altre persone. Non nominare o giudicare singoli docenti in modo diffamatorio.' },
      { heading: 'Niente spam', body: 'Niente pubblicità, link di affiliazione, servizi di tesi a pagamento o post ripetuti.' },
      { heading: 'Moderazione', body: 'Ogni post e commento può essere segnalato. Le segnalazioni vengono esaminate entro 24 ore; i contenuti che violano queste regole vengono rimossi e chi le viola ripetutamente viene bannato. Puoi bloccare qualsiasi utente in ogni momento.' },
    ],
  },
  terms: {
    title: 'Termini d’uso',
    updated: 'Bozza',
    sections: [
      { heading: 'Il servizio', body: 'UNIverse ([RAGIONE SOCIALE], [INDIRIZZO]) aiuta studenti e ricercatori a pianificare periodi di studio all’estero. Creando un account accetti questi termini e le Linee guida della community.' },
      { heading: 'Le informazioni sono indicative', body: 'I match dei corsi e i requisiti sono ricercati automaticamente su fonti pubbliche e possono essere incompleti o non aggiornati. Ogni voce mostra la fonte e la data di controllo. Il riconoscimento degli esami è deciso solo dalla tua università tramite il Learning Agreement: conferma sempre con il tuo coordinatore.' },
      { heading: 'I tuoi contenuti', body: 'Resti titolare di ciò che pubblichi e concedi a UNIverse una licenza per mostrarlo nell’app. Sei responsabile della sua correttezza e liceità.' },
      { heading: 'Uso consentito', body: 'Devi avere almeno 16 anni. Non puoi fare un uso improprio del servizio, copiarne i contenuti in modo automatizzato o fingerti un’altra persona. Possiamo sospendere gli account che violano questi termini.' },
      { heading: 'Responsabilità', body: 'Il servizio è fornito “così com’è”. Nei limiti di legge, UNIverse non risponde di decisioni prese sulla base delle informazioni presenti nell’app.' },
      { heading: 'Contatti', body: 'Domande: [EMAIL SUPPORTO]. Legge applicabile: [GIURISDIZIONE].' },
    ],
  },
  privacy: {
    title: 'Informativa sulla privacy',
    updated: 'Bozza',
    sections: [
      { heading: 'Titolare del trattamento', body: '[RAGIONE SOCIALE], [INDIRIZZO], [EMAIL SUPPORTO].' },
      { heading: 'Dati raccolti', body: 'Indirizzo email (per l’accesso e la verifica dello status di studente), il profilo che inserisci (nome, università, area di studio, livello, destinazione, periodo), i contenuti che pubblichi, le richieste e i risultati dei match, segnalazioni e blocchi. Non usiamo tracker pubblicitari.' },
      { heading: 'Ricerca con l’AI', body: 'Quando richiedi un match dei corsi, la richiesta (università, corso di laurea, nomi degli esami, note) viene inviata al nostro fornitore di AI (Anthropic) per cercare pagine web pubbliche. Non inserire dati personali nel campo note.' },
      { heading: 'Responsabili del trattamento', body: 'Supabase (database e autenticazione, consigliata regione UE) e Anthropic (elaborazione AI). I dati sono trasferiti fuori dall’UE solo con garanzie adeguate.' },
      { heading: 'Conservazione e cancellazione', body: 'Puoi eliminare il tuo account in qualsiasi momento dalle Impostazioni: profilo, post, commenti e match vengono cancellati definitivamente.' },
      { heading: 'I tuoi diritti', body: 'Ai sensi del GDPR puoi accedere ai tuoi dati, rettificarli, esportarli, cancellarli e opporti al trattamento. Scrivi a [EMAIL SUPPORTO] o rivolgiti al Garante per la protezione dei dati personali.' },
    ],
  },
};

export function getLegalDoc(id: LegalDocId, locale: Locale): LegalDoc {
  return (locale === 'it' ? it : en)[id];
}
