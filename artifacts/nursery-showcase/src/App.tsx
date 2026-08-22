import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { AppProvider } from "@/lib/context";
import GalleryPage from "@/pages/GalleryPage";
import CreateQuotationPage from "@/pages/CreateQuotationPage";
import QuotationHistoryPage from "@/pages/QuotationHistoryPage";
import OldStyleQuotationPage from "@/pages/OldStyleQuotationPage";
import NoHeaderQuotationPage from "@/pages/NoHeaderQuotationPage";
import QadriOldQuotationPage from "@/pages/QadriOldQuotationPage";
import AgriStorePage from "@/pages/AgriStorePage";

const queryClient = new QueryClient();

function navigate(to: string) {
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export { navigate };

function usePathname() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  return path;
}

function RouterView() {
  const path = usePathname();

  if (path === "/create-quotation") return <CreateQuotationPage />;
  if (path === "/quotation-history") return <QuotationHistoryPage />;
  if (path === "/old-quotation") return <OldStyleQuotationPage />;
  if (path === "/no-header-quotation") return <NoHeaderQuotationPage />;
  if (path === "/qadri-old-quotation") return <QadriOldQuotationPage />;
  if (path === "/agri-store") return <AgriStorePage />;
  return <GalleryPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <RouterView />
        <Toaster richColors position="top-center" />
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
