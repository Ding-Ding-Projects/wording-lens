import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  'https://wording-lens-status-workbench.gerktongdew.chatgpt.site/';
const previewUrl = new URL('social-preview.png', siteUrl).toString();
const basePath = process.env.SITE_BASE_PATH ?? '';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Wording Lens',
  description:
    'A local-first Windows operations cockpit with a private, user-supplied wording layer.',
  alternates: { canonical: siteUrl },
  icons: { icon: `${basePath}/favicon.svg` },
  openGraph: {
    title: 'Wording Lens',
    description:
      'Inspect, preview, and run local work from one calm Windows operations cockpit.',
    type: 'website',
    siteName: 'Wording Lens',
    url: siteUrl,
    images: [
      {
        url: previewUrl,
        width: 1280,
        height: 640,
        alt: 'Wording Lens logo and local operations cockpit description',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wording Lens',
    description:
      'Inspect, preview, and run local work from one calm Windows operations cockpit.',
    images: [previewUrl],
  },
};

export const viewport: Viewport = { themeColor: '#101722' };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
