/**
 * "Kemas kini terakhir" date on the legal pages. Set to the pre-launch date
 * (owner, 2026-11-23); update it whenever the legal text changes, and again
 * on the day live CHIP keys go on (Phase 6).
 */
export const LEGAL_LAST_UPDATED: string | null = '23 November 2026';

/** Business facts shown on every page. Values in [brackets] still need the owner's answer. */
export const site = {
  url: 'https://growthbridge.my',
  brand: 'GrowthBridge',
  company: 'GROWTH BRIDGE ENTERPRISE',
  registration: '202603162028 (NS0324359-K)',
  email: 'growthbridge.biz@gmail.com',
  owner: 'Ihsan Hadhrami',
  threadsHandle: '@ihsaaann__',
  threadsUrl: 'https://www.threads.net/@ihsaaann__',
  /** The owner's personal site: full background, linked from "Tentang saya". */
  ownerBackgroundUrl: 'https://ihsanhadhrami.com/about/background',
  supportHours: '9:00 pagi hingga 12:00 tengah hari',
  defaultImage: '/og/og-home.png',
  defaultImageAlt: 'GrowthBridge: sistem AI dan automasi untuk bisnes anda.',
} as const;
