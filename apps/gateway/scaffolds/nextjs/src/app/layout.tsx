import type { Metadata } from "next";
export const metadata: Metadata = { title: "__PROJECT_NAME__" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body style={{fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif"}}>{children}</body></html>;
}
