import { Header } from "./Header";
import { RightPane } from "./RightPane";

/**
 * Three panes at >= 1024px (nav | content | collapsible right). Below that they stack with the content first,
 * so nothing scrolls horizontally at 375px.
 */
export function AppShell({
  userName,
  left,
  right,
  rightTitle = "Guide",
  children,
}: {
  userName: string;
  left: React.ReactNode;
  right: React.ReactNode;
  rightTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header userName={userName} />
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="order-2 border-t p-4 lg:order-1 lg:w-64 lg:shrink-0 lg:border-t-0 lg:border-r">{left}</div>
        <main className="order-1 min-w-0 flex-1 px-4 py-8 sm:px-8 lg:order-2">{children}</main>
        <div className="order-3 lg:shrink-0">
          <RightPane title={rightTitle}>{right}</RightPane>
        </div>
      </div>
    </div>
  );
}
