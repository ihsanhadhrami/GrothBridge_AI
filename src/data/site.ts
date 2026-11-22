/**
 * "Kemas kini terakhir" date on the legal pages. Deliberately unset: it is
 * filled in at Phase 6, on the day the live CHIP keys go on after the test
 * purchase (format: '14 Disember 2026'). While null, the legal pages show no
 * date and the build prints a reminder.
 */
export const LEGAL_LAST_UPDATED: string | null = null;

/** Business facts shown on every page. Values in [brackets] still need the owner's answer. */
export const site = {
  url: 'https://growthbridge.ai',
  brand: 'GrowthBridge',
  company: 'GROWTH BRIDGE ENTERPRISE',
  registration: '202603162028 (NS0324359-K)',
  email: 'growthbridge.biz@gmail.com',
  owner: 'Ihsan Hadhrami',
  threadsHandle: '@ihsaaann__',
  threadsUrl: 'https://www.threads.net/@ihsaaann__',
  supportHours: '9:00 pagi hingga 12:00 tengah hari',
  defaultImage: '/og/growthbridge.png',
  defaultImageAlt: 'GrowthBridge: sistem AI dan automasi untuk bisnes anda.',
} as const;
