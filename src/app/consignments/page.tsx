import { ConsignmentListPage } from "@/components/consignment-list-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "ประวัติฝากส่ง" };

/** D236: finished requests only (delivered, closed, cancelled, returned). Unfinished ones are on /tracking. */
export default function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <ConsignmentListPage phase="finished" searchParams={searchParams} />;
}
