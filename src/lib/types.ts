export type ApprovalStatus = "pending" | "accepted" | "rejected";

export type KanbanGroup = "in_progress" | "completed" | "paid";

export interface Project {
  id: string;
  name: string;
  minRate: number;
  maxRate: number;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
}

export interface Status {
  id: string;
  name: string;
  kanbanGroup: KanbanGroup;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  showOnBoard: boolean;
}

export interface Task {
  id: string;
  taskNumber: number;
  projectId: string;
  projectName?: string;
  taskUuid: string;
  stageUuid: string;
  timeSpentMinutes: number;
  timerStartedAt: string | null;
  statusId: string | null;
  statusName?: string;
  statusColor?: string;
  statusKanbanGroup?: KanbanGroup;
  statusShowOnBoard?: boolean;
  approvalStatus: ApprovalStatus;
  reviewerComment: string;
  startAt: string | null;
  endAt: string | null;
  minRate: number;
  maxRate: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  workerEmail: string;
  usdInrRate: number | null;
  rateSource: "auto" | "manual";
  rateUpdatedAt: string | null;
}

export interface RateInfo {
  rate: number;
  source: "auto" | "manual";
  updatedAt: string | null;
  provider?: string;
}
