import { Suspense } from "react";
import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0A2342 0%, #1A6B72 100%)" }} />
    }>
      <SignupForm />
    </Suspense>
  );
}
