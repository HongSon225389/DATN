import { Navigate, Outlet } from "react-router";

import { useAuth } from "../contexts/AuthContext";

export default function PrivateRoute() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "user") {
    return <Navigate to="/admin/flood-events" replace />;
  }
  return <Outlet />;
}
