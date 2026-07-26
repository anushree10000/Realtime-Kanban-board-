import "./globals.css";

export const metadata = {
  title: "Realtime Kanban",
  description: "A real-time collaborative Kanban board",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
