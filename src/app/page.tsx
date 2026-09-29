import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mb-5">
        ▦
      </div>
      <h1 className="text-2xl font-bold">Task Board</h1>
      <p className="text-muted text-sm mt-2 max-w-md">
        The kanban board (In Progress / Completed / Paid) with the payout hero
        banner lands here in Phase 2.
      </p>
      <div className="flex gap-3 mt-6">
        <Link href="/sheet" className="btn-primary px-5 py-2.5 text-sm">
          Open Detailed Sheet
        </Link>
        <Link href="/focus" className="btn-ghost px-5 py-2.5 text-sm">
          Active Focus Workbench
        </Link>
      </div>
    </div>
  );
}
