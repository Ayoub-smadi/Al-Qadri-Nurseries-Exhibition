import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AppProvider } from "@/lib/context";
import GalleryPage from "@/pages/GalleryPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <GalleryPage />
        <Toaster richColors position="top-center" />
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
