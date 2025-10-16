import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'CT vs MRI Analyzer',
  description: 'Client-side DICOM and image AI to distinguish CT vs MRI'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
