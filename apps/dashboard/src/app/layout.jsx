// D5: public, no session anywhere in this tree -- RF-AP01 scenario 2.
export const metadata = { title: "ZevaUI Adoption Panel" };

/** @param {{ children: import("react").ReactNode }} props */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
