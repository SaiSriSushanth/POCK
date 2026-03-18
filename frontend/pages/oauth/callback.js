import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { connectFacebook } from "../../lib/api";

export default function OAuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState("Connecting your Facebook account...");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!router.isReady) return;

    const { code, error: fbError } = router.query;

    if (fbError) {
      setError("Facebook login was cancelled or failed.");
      return;
    }

    if (!code) return;

    connectFacebook(code)
      .then(() => {
        setStatus("Connected! Redirecting to inbox...");
        setTimeout(() => router.push("/inbox"), 1500);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || "Failed to connect Facebook account.");
      });
  }, [router.isReady, router.query]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-md text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-4">POCK</h1>
        {error ? (
          <>
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => router.push("/login")}
              className="text-sm text-blue-600 hover:underline"
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600 text-sm">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
