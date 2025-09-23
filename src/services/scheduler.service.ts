import Queue from "bull";
import { Post, PostStatus } from "../entity";
import { Repository } from "typeorm";
import { AppDataSource } from "../typeorm.config";
import { logger } from "../utils";
import { configs } from "../config";

// Define job data interface
export interface SchedulePostJob {
  postId: string;
  userId: string;
}

class SchedulerService {
  private postQueue: Queue.Queue<SchedulePostJob>;
  private postRepository: Repository<Post>;

  constructor() {
    // Initialize Bull queue
    this.postQueue = new Queue<SchedulePostJob>("scheduled-posts", {
      redis: {
        host: configs.REDIS_HOST || "ec2-54-162-117-48.compute-1.amazonaws.com",
        port: Number(configs.REDIS_PORT) || 5579,
        password: configs.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
      },
    });

    // Get repository from TypeORM
    this.postRepository = AppDataSource.getRepository(Post);

    // Setup job processing
    this.setupProcessor();

    // Setup event listeners
    this.setupListeners();
  }

  async schedulePost(
    postId: string,
    userId: string,
    publishAt: Date
  ): Promise<Queue.Job<SchedulePostJob>> {
    try {
      const delay = publishAt.getTime() - Date.now();

      if (delay <= 0) {
        throw new Error("Scheduled time must be in the future");
      }

      const job = await this.postQueue.add(
        {
          postId,
          userId,
        },
        {
          delay,
          jobId: `post:${postId}:${userId}`,
        }
      );

      logger.info(
        `Post with ID ${postId} scheduled for publication at ${publishAt}`
      );
      return job;
    } catch (error) {
      logger.error(
        `Error scheduling post with ID ${postId}: ${(error as Error).message}`
      );
      throw error;
    }
  }

  // Method to cancel a scheduled post
  async cancelScheduledPost(postId: string): Promise<void> {
    try {
      const jobs = await this.postQueue.getJobs(["delayed", "waiting"]);

      for (const job of jobs) {
        const data = job.data as SchedulePostJob;
        if (data.postId === postId) {
          await job.remove();
          logger.info(`Scheduled post with ID ${postId} has been cancelled`);
          return;
        }
      }

      logger.warn(`No scheduled post found with ID ${postId}`);
    } catch (error) {
      logger.error(
        `Error cancelling scheduled post with ID ${postId}: ${
          (error as Error).message
        }`
      );
      throw error;
    }
  }

  // Get all scheduled posts for a user
  async getScheduledPostsForUser(
    userId: string
  ): Promise<{ postId: string; scheduledFor: Date }[]> {
    try {
      const jobs = await this.postQueue.getJobs(["delayed", "waiting"]);

      return jobs
        .filter((job) => (job.data as SchedulePostJob).userId === userId)
        .map((job) => ({
          postId: (job.data as SchedulePostJob).postId,
          scheduledFor: new Date(Date.now() + job.opts.delay!),
          jobId: job.id,
        }));
    } catch (error) {
      logger.error(
        `Error getting scheduled posts for user ${userId}: ${
          (error as Error).message
        }`
      );
      throw error;
    }
  }

  // Setup job processor
  private setupProcessor(): void {
    this.postQueue.process(async (job) => {
      const { postId } = job.data;

      try {
        logger.info(`Processing scheduled post job for post ID: ${postId}`);

        // Find the post in the database
        const post = await this.postRepository.findOne({
          where: { id: postId },
        });

        if (!post) {
          logger.error(`Post with ID ${postId} not found, job aborted`);
          throw new Error(`Post with ID ${postId} not found`);
        }

        // Update post status to PUBLISH
        post.status = PostStatus.PUBLISH;
        post.scheduledFor = null; // Clear the scheduled date

        await this.postRepository.save(post);

        logger.info(`Post with ID ${postId} has been published successfully`);
        return { success: true, postId };
      } catch (error) {
        logger.error(
          `Failed to publish post with ID ${postId}: ${
            (error as Error).message
          }`
        );
        throw error;
      }
    });
  }

  // Setup event listeners for monitoring
  private setupListeners(): void {
    this.postQueue.on("completed", (job) => {
      logger.info(`Job ${job.id} completed successfully`);
    });

    this.postQueue.on("failed", (job, error) => {
      logger.error(`Job ${job?.id} failed with error: ${error.message}`);
    });

    this.postQueue.on("error", (error) => {
      logger.error(`Queue error: ${error.message}`);
    });

    this.postQueue.isReady().then((r) => {
      logger.info(`Scheduler queue is ready to accept jobs`);
    });
  }

  // Clean up method to close connections
  async close(): Promise<void> {
    await this.postQueue.close();
  }
}

// Export a singleton instance
export const schedulerService = new SchedulerService();
