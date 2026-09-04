import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wording Lens',
  description: 'A local-first Windows operations cockpit with a private, user-supplied wording layer.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body>{children}</body></html>;
}
