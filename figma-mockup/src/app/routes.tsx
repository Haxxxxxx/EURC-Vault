import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Portfolio } from "./pages/Portfolio";
import { Vaults } from "./pages/Vaults";
import { VaultDetail } from "./pages/VaultDetail";
import { DepositWithdraw } from "./pages/DepositWithdraw";
import { History } from "./pages/History";
import { Leaderboard } from "./pages/Leaderboard";
import { Settings } from "./pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Portfolio },
      { path: "vaults", Component: Vaults },
      { path: "vaults/:vaultId", Component: VaultDetail },
      { path: "deposit-withdraw/:vaultId", Component: DepositWithdraw },
      { path: "history", Component: History },
      { path: "leaderboard", Component: Leaderboard },
      { path: "settings", Component: Settings },
    ],
  },
]);