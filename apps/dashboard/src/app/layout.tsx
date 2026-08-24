// D5: public, no session anywhere in this tree -- RF-AP01 scenario 2.
import type { ReactNode } from "react";

export const metadata = { title: "ZevaUI Adoption Panel" };

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
