import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <title>ModCalc - Performance Tuning Calculator</title>
        <meta name="description" content="Calculate your car's performance gains with ModCalc's advanced tuning calculator" />
      </head>
      <body className="animated-bg min-h-screen">
        <div className="relative min-h-screen">
          {/* Background gradient overlay */}
          <div className="fixed inset-0 bg-gradient-to-br from-blue-900/5 via-purple-900/5 to-indigo-900/5 pointer-events-none" />
          
          {/* Main content */}
          <div className="relative z-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </div>
          </div>

          {/* Floating background elements */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl float" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl float" style={{animationDelay: '-3s'}} />
            <div className="absolute top-1/2 left-1/2 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl float" style={{animationDelay: '-6s'}} />
          </div>
        </div>
      </body>
    </html>
  );
}
