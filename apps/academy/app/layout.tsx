import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ProgressProvider } from "@/components/game/ProgressProvider";
import { Toaster } from "@/components/game/Toaster";
import { LabImplProvider } from "@/components/playground/LabImpl";
import { TooltipProvider } from "@/components/ui/tooltip";
import { currentUser } from "@/lib/auth/session";
import { getProgress } from "@/lib/game/award";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Auth Academy",
  description: "Learn authentication by building and breaking it.",
};

// Runs before paint so the saved (or system) theme applies without a flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // UTC here; ProgressProvider refetches with the browser timezone on mount.
  const user = await currentUser();
  const initial = user ? await getProgress(user.id, "UTC") : null;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <LabImplProvider>{initial ? <ProgressProvider initial={initial}>{children}</ProgressProvider> : children}</LabImplProvider>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
