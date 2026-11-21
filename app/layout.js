import { Geist, Geist_Mono } from "next/font/google";
import SiteHeader, { SiteFooter } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://incident-app-gamma.vercel.app"),
  title: {
    default: "Civicpin | Anonymous civic reporting",
    template: "%s",
  },
  description: "Report a local issue with a map pin and photo, then follow its progress using a private Civicpin tracking code.",
};

export const viewport = {
  themeColor: "#F7F7F2",
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
