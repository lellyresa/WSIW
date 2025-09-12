import '@/app/globals.css';

export const metadata = {
  title: 'What Should I Watch?',
  description: "Don't spend 40 minutes picking a show, we'll do it for you.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
