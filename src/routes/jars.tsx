import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/jars")({
  component: () => <Outlet />,
});
