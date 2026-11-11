import { createFileRoute } from "@tanstack/react-router";
import { OfflineHome } from "@/components/offline-home";

export const Route = createFileRoute("/offline")({ component: OfflineHome });
