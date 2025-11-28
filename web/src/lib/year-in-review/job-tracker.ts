/**
 * In-memory job tracker for year-in-review video rendering
 * For production, consider using Redis or a database for persistence
 */

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface RenderJob {
  id: string;
  userId: string;
  year: number;
  status: JobStatus;
  progress: number; // 0-100
  videoUrl?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory job storage (consider Redis for production)
const jobs = new Map<string, RenderJob>();

// Clean up completed jobs after 5 minutes
const JOB_CLEANUP_MS = 5 * 60 * 1000;

/**
 * Generate a unique job ID
 */
export function generateJobId(userId: string, year: number): string {
  return `${userId}-${year}-${Date.now()}`;
}

/**
 * Create a new render job
 */
export function createJob(userId: string, year: number): RenderJob {
  const jobId = generateJobId(userId, year);

  const job: RenderJob = {
    id: jobId,
    userId,
    year,
    status: "pending",
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  jobs.set(jobId, job);

  // Schedule cleanup
  setTimeout(() => {
    jobs.delete(jobId);
  }, JOB_CLEANUP_MS);

  return job;
}

/**
 * Get a job by ID
 */
export function getJob(jobId: string): RenderJob | null {
  return jobs.get(jobId) || null;
}

/**
 * Update job status
 */
export function updateJob(
  jobId: string,
  updates: Partial<Omit<RenderJob, "id" | "userId" | "year" | "createdAt">>
): RenderJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;

  const updatedJob: RenderJob = {
    ...job,
    ...updates,
    updatedAt: new Date(),
  };

  jobs.set(jobId, updatedJob);
  return updatedJob;
}

/**
 * Mark job as processing
 */
export function startJob(jobId: string): RenderJob | null {
  return updateJob(jobId, { status: "processing", progress: 0 });
}

/**
 * Update job progress (0-100)
 */
export function updateJobProgress(
  jobId: string,
  progress: number
): RenderJob | null {
  return updateJob(jobId, { progress: Math.min(100, Math.max(0, progress)) });
}

/**
 * Mark job as completed
 */
export function completeJob(jobId: string, videoUrl: string): RenderJob | null {
  return updateJob(jobId, {
    status: "completed",
    progress: 100,
    videoUrl,
  });
}

/**
 * Mark job as failed
 */
export function failJob(jobId: string, error: string): RenderJob | null {
  return updateJob(jobId, {
    status: "failed",
    error,
  });
}

/**
 * Get active job for a user/year (if any)
 */
export function getActiveJob(userId: string, year: number): RenderJob | null {
  for (const job of jobs.values()) {
    if (
      job.userId === userId &&
      job.year === year &&
      (job.status === "pending" || job.status === "processing")
    ) {
      return job;
    }
  }
  return null;
}

/**
 * Delete a job
 */
export function deleteJob(jobId: string): boolean {
  return jobs.delete(jobId);
}

/**
 * Get all jobs (for debugging)
 */
export function getAllJobs(): RenderJob[] {
  return Array.from(jobs.values());
}
