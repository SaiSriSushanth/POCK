import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("pock_token");
    if (token) {
      router.replace("/inbox");
    } else {
      router.replace("/login");
    }
  }, []);

  return null;
}
