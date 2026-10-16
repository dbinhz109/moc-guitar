import type { Metadata } from "next";
export const metadata: Metadata = {title: "Mộc — Guitar Studio", description: "A little practice. A lot of music."};
export default function RootLayout({children}: {children: React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
