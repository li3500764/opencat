"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CustomerDetailPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/customers");
  }, [router]);

  return null;
}
