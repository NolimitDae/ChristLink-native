import { SUPPORT_EMAIL } from '../lib/constants';

export type LegalDocKey = 'privacy' | 'terms' | 'host' | 'guidelines';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export const LEGAL_UPDATED = 'October 15, 2026';
export const LEGAL_DRAFT_NOTICE = 'Draft — pending legal review';

export const LEGAL_DOC_KEYS: readonly LegalDocKey[] = ['privacy', 'terms', 'host', 'guidelines'];

export function isLegalDocKey(v: unknown): v is LegalDocKey {
  return typeof v === 'string' && (LEGAL_DOC_KEYS as readonly string[]).includes(v);
}

const privacy: LegalDoc = {
  title: 'Privacy Policy',
  updated: LEGAL_UPDATED,
  intro:
    'Christ Link Social ("we", "us") helps people find faith events, churches and community. This policy explains what we collect when you use the Christ Link Social app and website, why we collect it, who we share it with and the choices you have.',
  sections: [
    {
      heading: '1. Information you give us',
      paragraphs: [
        'Account. We use passwordless sign-in: you enter your email address and we email you a one-time code. We store your email address and, if you provide it, your name. We do not create or store a password.',
        'Profile. You can add a profile photo, banner image, bio, city, favorite Bible verse, a pinned prayer request and a link to your Instagram account. Your name, photo and public profile details are visible to other members.',
        'Content. Posts, replies, prayers (including whether you chose to post anonymously), testimonies, event forum messages, reports you submit and Amens or "I prayed" taps are stored so the community features work. Anonymous prayers are hidden from other members, but we still know who posted them so we can moderate and so you can manage or delete them.',
        'Photos. Images you upload — avatars, banners and event cover or gallery images — are stored in our file storage and are publicly viewable by anyone with the link.',
        'Events and tickets. When you RSVP, buy a ticket, sign up to serve or host an event, we store those records, including ticket type, quantity, price, check-in status and refund requests.',
        'Host verification. Hosts who sell tickets must verify their identity. We collect your legal name and a photo of a government-issued ID. ID photos are stored in a private storage bucket, can be viewed only by authorized administrators through short-lived signed links, and are deleted 30 days after we approve or reject the verification.',
        'Support. If you email us, we keep the correspondence so we can help you.',
      ],
    },
    {
      heading: '2. Information collected automatically',
      paragraphs: [
        'Location. If you tap "Near me" or open the map, the app asks your device for your approximate or precise location so it can show nearby events and churches. Your location is used for that request only. We do not store your location history or share it with other members.',
        'Push notifications. If you allow notifications, we store a push token for your device so we can send ticket confirmations, reminders and updates you have turned on. Event reminders are scheduled on your device.',
        'Crash and diagnostics. When the app crashes or hits an error, we receive a crash report (device model, operating system, app version and the error) so we can fix problems. We configure crash reporting not to include your name or email.',
        'Basic usage. Our servers log requests (such as time, IP address and the page or endpoint requested) for security, abuse prevention and troubleshooting. Event pages count views in aggregate.',
      ],
    },
    {
      heading: '3. Payments',
      paragraphs: [
        'Payments are processed by Stripe. When you buy a ticket or pay a listing fee, your card details are entered into Stripe’s secure payment form and sent directly to Stripe. We never see or store your full card number or security code. We receive a payment confirmation, the amount, fees and the last four digits and brand of your card where Stripe provides them.',
        'Hosts who receive payouts connect a Stripe account. Stripe collects the information it needs to pay you and to meet its legal obligations; we store your Stripe account ID and payout status.',
      ],
    },
    {
      heading: '4. How we use information',
      paragraphs: [
        'To provide the service: sign you in, show events, process RSVPs and tickets, run the community feed and Prayer Wall, deliver notifications you have chosen and help hosts check guests in.',
        'To keep the community safe: review reports, enforce our Community Guidelines, prevent fraud and verify hosts.',
        'To show friends’ activity: if you and another member follow each other, you may see which public events each other plans to attend. You can hide your RSVPs from people who are not friends in Settings → Privacy.',
        'To improve the app and fix bugs. We do not sell your personal information, and we do not use it for third-party advertising.',
      ],
    },
    {
      heading: '5. Who we share information with',
      paragraphs: [
        'Other members see your public profile and the content you post. Hosts see the name and email of people who RSVP or buy tickets to their events so they can manage attendance and contact guests about the event.',
        'Service providers process data on our behalf under contract: Supabase (database, authentication and file storage), Railway (API hosting), Stripe (payments and host payouts), Sentry (crash reports), Expo (push notification delivery) and our email provider (sign-in codes and receipts).',
        'We may disclose information if required by law, to protect the safety of any person, or as part of a merger or acquisition, in which case this policy will continue to apply.',
      ],
    },
    {
      heading: '6. Data retention',
      paragraphs: [
        'We keep your account information while your account is active. Host ID photos are deleted 30 days after a verification decision. Server logs and crash reports are kept for a limited period and then deleted.',
        'Ticket, payment, payout and refund records are kept for as long as tax, accounting and payment-network rules require, even after you delete your account. After deletion those records are anonymized so they are no longer linked to your profile.',
      ],
    },
    {
      heading: '7. Your choices and rights',
      paragraphs: [
        'You can edit your profile at any time, delete your posts and prayers, choose which notifications you receive, set quiet hours, block other members and turn off location or notification permissions in your device settings.',
        'Deleting your account. You can delete your account in the app under Settings → Delete account. This permanently removes your profile, photos, posts, replies, prayers, follows and settings. Ticket and payment records are kept in anonymized form as described above. If you host upcoming events with sold tickets, you must cancel or complete them first so guests can be refunded.',
        `Depending on where you live, you may have rights to access, correct, export or delete your information, or to object to certain processing. To make a request, email ${SUPPORT_EMAIL}. We will respond within the time required by law.`,
      ],
    },
    {
      heading: '8. Children',
      paragraphs: [
        `Christ Link Social is not directed to children under 13, and we do not knowingly collect personal information from them. If you believe a child under 13 has created an account, contact ${SUPPORT_EMAIL} and we will delete it. You must be at least 18 to host events or sell tickets.`,
      ],
    },
    {
      heading: '9. Security',
      paragraphs: [
        'We use encryption in transit, row-level access rules in our database, private storage for sensitive files and limited administrator access. No system is perfectly secure, so please keep access to your email account safe, since it is how you sign in.',
      ],
    },
    {
      heading: '10. Changes and contact',
      paragraphs: [
        'If we make material changes to this policy, we will let you know in the app or by email before they take effect.',
        `Questions? Email ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

const terms: LegalDoc = {
  title: 'Terms of Service',
  updated: LEGAL_UPDATED,
  intro:
    'These Terms govern your use of Christ Link Social. By creating an account or using the app, you agree to these Terms, our Privacy Policy and our Community Guidelines. If you host events, the Host Agreement also applies.',
  sections: [
    {
      heading: '1. Your account',
      paragraphs: [
        'You must be at least 13 years old to use Christ Link Social, and at least 18 to host events or sell tickets. You sign in with a one-time code sent to your email, so you are responsible for keeping your email account secure. Provide accurate information and do not impersonate anyone.',
      ],
    },
    {
      heading: '2. What we provide',
      paragraphs: [
        'Christ Link Social is a platform that helps people discover faith events and churches, RSVP or buy tickets, connect with others and serve. Events are organized by independent hosts, not by us. We do not run, supervise or guarantee events, and we are not responsible for what happens at them.',
      ],
    },
    {
      heading: '3. Tickets, fees and refunds',
      paragraphs: [
        'Ticket prices are set by hosts. When you buy a paid ticket, a 7% service fee is added at checkout unless the host has chosen to absorb it, and applicable taxes may be added. The full price, fees and total are shown before you pay.',
        'Payments are processed by Stripe. Your ticket is confirmed once payment succeeds; you will find it under Tickets in the app.',
        'Refunds are at the host’s discretion. You can request a refund from your ticket, and the host decides whether to approve it. If a host cancels an event, we will work with the host to refund ticket buyers. Our service fee may be non-refundable except where the law requires otherwise or the event is cancelled.',
        'Tickets are personal to the event and may not be resold for more than face value.',
      ],
    },
    {
      heading: '4. Your content',
      paragraphs: [
        'You own what you post. By posting, you give us a worldwide, non-exclusive, royalty-free license to host, display and distribute it within Christ Link Social and in share cards you choose to create, for as long as it remains on the service.',
        'You are responsible for your content and must have the rights to anything you upload. Do not post anything that breaks the law or our Community Guidelines.',
      ],
    },
    {
      heading: '5. Moderation, reports and blocking',
      paragraphs: [
        'Members can report posts, replies, prayers, forum messages, profiles, events and churches. Our team aims to review reports within 24 hours. We may remove content, limit features or suspend accounts that violate these Terms or our Community Guidelines, with or without notice.',
        'You can block any member. Blocked members cannot see your posts or prayers or contact you, and you will not see theirs.',
      ],
    },
    {
      heading: '6. Acceptable use',
      paragraphs: [
        'Do not misuse the service: no scraping, spamming, harassment, fraudulent events or payments, attempts to access other accounts or our systems without permission, or use of the service to break the law.',
      ],
    },
    {
      heading: '7. Ending your account',
      paragraphs: [
        'You can delete your account at any time in Settings. We may suspend or end your access if you violate these Terms or if required by law. Some records, such as ticket and payment records, are kept in anonymized form as described in the Privacy Policy.',
      ],
    },
    {
      heading: '8. Disclaimers and liability',
      paragraphs: [
        'The service is provided "as is" without warranties of any kind, to the extent permitted by law. We are not liable for the conduct of hosts, attendees or other members, or for events organized through the service.',
        'To the fullest extent permitted by law, our total liability to you for any claim related to the service is limited to the greater of the amount you paid us in fees in the 12 months before the claim or $100. Nothing in these Terms limits liability that cannot be limited by law.',
      ],
    },
    {
      heading: '9. Changes and contact',
      paragraphs: [
        'We may update these Terms. If changes are material, we will notify you in the app or by email, and you may be asked to accept the new Terms to keep using the service.',
        `Questions? Email ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

const host: LegalDoc = {
  title: 'Host Agreement',
  updated: LEGAL_UPDATED,
  intro:
    'This Host Agreement applies when you create events on Christ Link Social, in addition to the Terms of Service and Community Guidelines.',
  sections: [
    {
      heading: '1. Eligibility and verification',
      paragraphs: [
        'You must be at least 18 years old to host. To sell paid tickets you must verify your identity by submitting your legal name and a photo of a government-issued ID, and connect a Stripe account to receive payouts.',
        'ID photos are stored privately, viewed only by authorized administrators through short-lived signed links, and deleted 30 days after a decision.',
      ],
    },
    {
      heading: '2. Your events',
      paragraphs: [
        'You are the organizer of your events and are solely responsible for them, including accurate descriptions, dates, venue details, capacity, safety, permits, insurance, accessibility and compliance with local law.',
        'Events must be faith-centered or community-serving and must follow our Community Guidelines. We may unpublish events that are misleading, unsafe or otherwise violate our policies.',
      ],
    },
    {
      heading: '3. Fees',
      paragraphs: [
        'Free events are free to list. Paid events require a one-time $19.99 listing fee per event before they can be published.',
        'Attendees pay a 7% service fee on paid tickets. You can choose to absorb that fee so attendees see a single price; in that case it is deducted from your payout. Stripe’s payment processing fees also apply and are shown in your sales breakdown.',
      ],
    },
    {
      heading: '4. Payouts',
      paragraphs: [
        'Ticket revenue, minus fees and refunds, is paid to your connected Stripe account on Stripe’s payout schedule. You are responsible for any taxes on your income from events. Stripe’s terms apply to your connected account.',
      ],
    },
    {
      heading: '5. Refunds and cancellations',
      paragraphs: [
        'Refunds are at your discretion, and you should state your refund policy in your event description. You must respond to refund requests promptly and honor the policy you state.',
        'If you cancel an event, you must refund all ticket buyers. You cannot delete your account while you have upcoming events with sold tickets.',
      ],
    },
    {
      heading: '6. Guest information',
      paragraphs: [
        'You may see attendees’ names and email addresses. Use them only to manage and communicate about your event. Do not sell them, add guests to unrelated mailing lists without consent, or share them with others.',
      ],
    },
    {
      heading: '7. Volunteers',
      paragraphs: [
        'If you create Serve roles and shifts, you are responsible for supervising volunteers, giving accurate shift details and following any background-check or safeguarding requirements that apply to your ministry, especially for work with children.',
      ],
    },
    {
      heading: '8. Contact',
      paragraphs: [`Questions about hosting? Email ${SUPPORT_EMAIL}.`],
    },
  ],
};

const guidelines: LegalDoc = {
  title: 'Community Guidelines',
  updated: LEGAL_UPDATED,
  intro:
    'Christ Link Social is a place to find your people and grow your faith. These guidelines keep it welcoming for everyone. "Let all that you do be done in love." — 1 Corinthians 16:14',
  sections: [
    {
      heading: 'Lead with kindness',
      paragraphs: [
        'Encourage one another. Disagree graciously. Assume the best about people, and remember that prayer requests are often shared in hard moments.',
      ],
    },
    {
      heading: 'Respect every tradition',
      paragraphs: [
        'Members come from many denominations and backgrounds. Share your convictions without mocking or attacking other churches, traditions or people of other faiths.',
      ],
    },
    {
      heading: 'No harassment or hate',
      paragraphs: [
        'Do not bully, threaten, shame or target anyone. Hate speech or attacks based on race, ethnicity, nationality, sex, disability, age or any other protected characteristic are not allowed.',
      ],
    },
    {
      heading: 'Keep it clean',
      paragraphs: ['No sexual content, nudity, graphic violence or content that sexualizes minors in any way.'],
    },
    {
      heading: 'No scams or spam',
      paragraphs: [
        'Do not ask for money outside of legitimate ticketed events, post fake events or fundraisers, impersonate a church or leader, or flood the feed with promotions.',
      ],
    },
    {
      heading: 'Protect privacy',
      paragraphs: [
        'Do not share someone else’s private information or prayer needs without their permission. Use the anonymous option on the Prayer Wall when you need it.',
      ],
    },
    {
      heading: 'Be truthful',
      paragraphs: ['Do not spread misinformation that could cause real harm, including false health or safety claims.'],
    },
    {
      heading: 'How to report',
      paragraphs: [
        'Tap the ⋯ menu on a post, prayer or profile, or long-press a reply, and choose Report. Reports are anonymous to the person you report, and our team aims to review them within 24 hours.',
        'You can also block someone from the report screen. They will not be notified.',
        `If someone is in immediate danger, contact local emergency services first. For anything else, email ${SUPPORT_EMAIL}.`,
      ],
    },
    {
      heading: 'What happens next',
      paragraphs: [
        'Content that breaks these guidelines may be removed. Repeated or serious violations can lead to limited features or account suspension.',
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = { privacy, terms, host, guidelines };
