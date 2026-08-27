import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
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
        <Route path="/add" element={<AddBurger />} />
        <Route path="/reviewers" element={<Reviewers />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
