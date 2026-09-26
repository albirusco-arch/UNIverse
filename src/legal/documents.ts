/**
 * DRAFT legal texts. They describe how the app actually works (data collected,
 * moderation, AI research, ratings, groups) but must be reviewed by a lawyer
 * and completed with the company details before publishing. Replace every [PLACEHOLDER].
 */
export type LegalDocId = 'terms' | 'privacy' | 'guidelines';

type LegalDoc = { title: string; updated: string; sections: { heading: string; body: string }[] };

const docs: Record<LegalDocId, LegalDoc> = {
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

export function getLegalDoc(id: LegalDocId): LegalDoc {
  return docs[id];
}
