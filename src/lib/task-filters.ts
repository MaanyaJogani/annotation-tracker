import { summarizePayouts } from "./payout";
import type { Task } from "./types";

export interface TaskFilters {
  types: string[];
  stages: string[];
  projects: string[];
  approvals: string[];
  comments: string[];
}

export const emptyTaskFilters = (): TaskFilters => ({ types: [], stages: [], projects: [], approvals: [], comments: [] });
export const filterCount = (filters: TaskFilters) => Object.values(filters).reduce((sum, values) => sum + values.length, 0);

export function filterTasks(tasks: Task[], search: string, filters: TaskFilters) {
  const query = search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (filters.types.length && !filters.types.includes(task.taskType ?? "annotation")) return false;
    if (filters.stages.length && !filters.stages.includes(task.statusKanbanGroup ?? "")) return false;
    if (filters.projects.length && !filters.projects.includes(task.projectId)) return false;
    if (filters.approvals.length && (task.taskType === "review" || !filters.approvals.includes(task.approvalStatus))) return false;
    const comment = task.reviewerComment.trim() ? "with" : "without";
    if (filters.comments.length && !filters.comments.includes(comment)) return false;
    return !query || [task.name, task.reviewWorkerEmail ?? "", task.reviewJustification ?? "", task.taskerFeedback ?? "", task.taskType ?? "annotation", task.taskUuid, task.stageUuid, task.notes, task.reviewerComment, task.projectName ?? ""].some((value) => value.toLowerCase().includes(query));
  });
}

export function summarizeTasks(tasks: Task[]) {
  const reviewed = tasks.filter((task) => task.taskType !== "review" && task.approvalStatus !== "pending");
  const accepted = reviewed.filter((task) => task.approvalStatus === "accepted").length;
  const paid = tasks.filter((task) => task.statusKanbanGroup === "paid");

  return {
    totalTasks: tasks.length,
    inProgress: tasks.filter((task) => task.statusKanbanGroup === "in_progress").length,
    ready: tasks.filter((task) => task.statusKanbanGroup === "completed").length,
    paid: paid.length,
    revoked: tasks.filter((task) => task.statusShowOnBoard === false).length,
    totalMinutes: tasks.reduce((sum, task) => sum + task.timeSpentMinutes, 0),
    ...summarizePayouts(tasks),
    minRateSeen: tasks.length ? Math.min(...tasks.map((task) => task.minRate)) : 0,
    maxRateSeen: tasks.length ? Math.max(...tasks.map((task) => task.taskType === "review" ? task.minRate : task.maxRate)) : 0,
    approvalRate: reviewed.length ? Math.round(accepted / reviewed.length * 100) : null,
    reviewedCount: reviewed.length,
  };
}
