import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { RequireWriteAccess } from "@/components/RequireWriteAccess";
import { SignIn } from "@/screens/SignIn";
import { Leaderboard } from "@/screens/Leaderboard";
import { BurgerDetail } from "@/screens/BurgerDetail";
import { AddBurger } from "@/screens/AddBurger";
import { Reviewers } from "@/screens/Reviewers";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Leaderboard />} />
        <Route path="/burger/:id" element={<BurgerDetail />} />
        <Route path="/signin" element={<SignIn />} />
        <Route
          path="/add"
          element={
            <RequireWriteAccess>
              <AddBurger />
            </RequireWriteAccess>
          }
        />
        <Route
          path="/reviewers"
          element={
            <RequireWriteAccess>
              <Reviewers />
            </RequireWriteAccess>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
