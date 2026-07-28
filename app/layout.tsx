import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Constraint Atlas — Queens is the smallest useful model";
const description =
  "An inspectable constraint workbench using regional Queens to connect Z3, formal models, explanations, and quantitative applications.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = (forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000")
    .split(",")[0]
    .trim();
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = (
    forwardedProtocol ?? (host.startsWith("localhost") ? "http" : "https")
  )
    .split(",")[0]
    .trim();
  const origin = `${protocol}://${host}`;
  const imageUrl = new URL("/og.png", origin).toString();

  return {
    title,
    description,
    metadataBase: new URL(origin),
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1734,
          height: 875,
          alt: "Constraint Atlas — Queens is the smallest useful model",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
