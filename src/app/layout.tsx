import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "./providers";

export const metadata: Metadata = {
  title: "Annotation Activity Console",
  description: "Live console for annotation tasks",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
