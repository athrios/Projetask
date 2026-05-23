import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import PublicForm from "./pages/PublicForm.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import AcceptInvite from "./pages/AcceptInvite.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import { AuthProvider } from "./hooks/useAuth";
import { WorkspaceProvider } from "./hooks/useWorkspace";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/f/:slug" element={<PublicForm />} />
                <Route path="/convite/:id" element={<AcceptInvite />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
