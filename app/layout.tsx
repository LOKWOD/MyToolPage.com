import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mytoolpage.com"),
  title: "MyToolPage | Practical Tools for Real Work",
  description:
    "Twenty free time, wage, cash-flow, rental-property, business, and real estate appraisal tools in one searchable toolbox.",
  applicationName: "MyToolPage",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "MyToolPage",
    title: "MyToolPage | Practical Tools for Real Work",
    description: "Twenty free calculators and planning worksheets for workers, business owners, property professionals, and residential appraisers.",
  },
  other: { "codex-preview": "development" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#102338",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MyToolPage",
    url: "https://mytoolpage.com/",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    isAccessibleForFree: true,
    description: "A searchable collection of twenty free calculators and worksheets for work, property, and appraisal tasks.",
    featureList: [
      "Time clock", "Wage calculator", "Worker payout sheet", "Property tax proration",
      "Seller net sheet", "Rental property snapshot", "Field day planner", "Property inspection intake sheet",
      "Repair cost worksheet", "Market-condition adjustment",
      "GLA worksheet", "Property converter", "Comparable adjustment grid",
      "Paired sales support", "Assignment fee analysis", "Break-even billing rate", "Cash reserve runway",
      "Trip cost calculator", "Turnaround planner",
      "Appraisal fee builder",
    ],
  };
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        {children}
      </body>
    </html>
  );
}
