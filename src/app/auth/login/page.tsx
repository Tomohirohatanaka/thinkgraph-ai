import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)" }} />}>
      <LoginForm />
    </Suspense>
  );
}
