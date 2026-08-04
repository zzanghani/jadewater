"use client";

import { useRouter } from "next/navigation";
import { kstDateString } from "@/lib/date";
import SingleDatePicker from "@/components/SingleDatePicker";

export default function ReceiptDateJump({ date }: { date: string }) {
  const router = useRouter();

  return (
    <SingleDatePicker
      label=""
      date={date}
      onChange={(d) => router.push(`/receipts?date=${d}`)}
      maxDate={kstDateString(0)}
    />
  );
}
