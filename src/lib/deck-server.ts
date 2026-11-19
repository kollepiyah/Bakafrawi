import "server-only";

// Ambil data GitHub Actions workflow runs dan tugas Studio dari database untuk dashboard deck.

const GITHUB_TOKEN = () => process.env.GITHUB_STUDIO_TOKEN ?? "";
const REPO = () => process.env.GITHUB_STUDIO_REPO ?? "kollepiyah/Bakafrawi";

export type StatusWorkflow = "queued" | "in_progress" | "completed";
export type KesimpulanWorkflow = "success" | "failure" | "cancelled" | "timed_out" | "action_required" | "skipped" | null;

export type RunWorkflow = {
  id: number;
  nama: string;
  status: StatusWorkflow;
  kesimpulan: KesimpulanWorkflow;
  cabang: string;
  mulai: string;
  selesai: string | null;
  durasi: number | null; // detik
  url: string;
  pemicu: string;
};

/**
 * Ambil workflow runs terbaru dari GitHub Actions API.
 * Token yang sama dengan `picuStudio` di studio-server.ts (GITHUB_STUDIO_TOKEN).
 */
export async function ambilWorkflowRuns(batas = 10): Promise<RunWorkflow[]> {
  const token = GITHUB_TOKEN();
  if (!token) return [];

  const res = await fetch(
    `https://api.github.com/repos/${REPO()}/actions/runs?per_page=${batas}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.error(`GitHub Actions API ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`);
    return [];
  }

  const data = (await res.json()) as {
    workflow_runs: {
      id: number;
      name: string;
      status: StatusWorkflow;
      conclusion: KesimpulanWorkflow;
      head_branch: string;
      run_started_at: string;
      updated_at: string;
      html_url: string;
      event: string;
      run_attempt: number;
      created_at: string;
    }[];
  };

  return data.workflow_runs.map((r) => {
    const mulai = r.run_started_at || r.created_at;
    const selesai = r.status === "completed" ? r.updated_at : null;
    return {
      id: r.id,
      nama: r.name,
      status: r.status,
      kesimpulan: r.conclusion,
      cabang: r.head_branch,
      mulai,
      selesai,
      durasi: selesai ? Math.round((new Date(selesai).getTime() - new Date(mulai).getTime()) / 1000) : null,
      url: r.html_url,
      pemicu: r.event,
    };
  });
}
