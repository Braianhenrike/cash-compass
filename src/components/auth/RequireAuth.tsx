import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";

import FullPageLoader from "@/components/app/FullPageLoader";
import { useAuth } from "@/providers/AuthProvider";

export default function RequireAuth({ children }: PropsWithChildren) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoader message="Validando sessao..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
