import { ConsignmentListPage } from "@/components/consignment-list-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "ติดตามงานฝากส่ง" };

/** D236: requests that are not finished yet, grouped by the step they are waiting at. */
export default function TrackingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <ConsignmentListPage phase="active" searchParams={searchParams} />;
}
