import axios from 'axios';
import { httpGet } from '../utils/http';

export interface CodeforcesSubmission {
  problem_id: string;
  title: string;
  rating?: number;
  topic_tags: string;
  solved_at: Date;
}

export interface CodeforcesHistoryItem {
  contestId: number;
  contestName: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export class CodeforcesService {
  private static BASE_URL = 'https://codeforces.com/api';

  public static async fetchUserInfo(username: string): Promise<{ rating?: number } | null> {
    try {
      const response = await httpGet(`${this.BASE_URL}/user.info`, {
        params: { handles: username },
        timeout: 10000,
      });
      if (response.data.status === 'OK' && response.data.result.length > 0) {
        const info = response.data.result[0];
        return {
          rating: info.rating,
        };
      }
    } catch (error: any) {
      console.error(`Error fetching Codeforces user info for ${username}:`, error.message);
    }
    return null;
  }

  public static async fetchUserSubmissions(username: string): Promise<CodeforcesSubmission[]> {
    try {
      const response = await httpGet(`${this.BASE_URL}/user.status`, {
        params: { handle: username, from: 1, count: 200 },
        timeout: 12000,
      });
      if (response.data.status === 'OK') {
        const submissions: any[] = response.data.result;
        const solvedMap = new Map<string, CodeforcesSubmission>();

        for (const sub of submissions) {
          if (sub.verdict === 'OK' && sub.problem) {
            const contestId = sub.problem.contestId;
            const index = sub.problem.index;
            if (!contestId || !index) continue;

            const problemId = `${contestId}-${index}`;
            // If already solved and has a later date, keep the earlier date
            const existing = solvedMap.get(problemId);
            const solvedAt = new Date(sub.creationTimeSeconds * 1000);

            if (!existing || existing.solved_at > solvedAt) {
              solvedMap.set(problemId, {
                problem_id: problemId,
                title: sub.problem.name || problemId,
                rating: sub.problem.rating,
                topic_tags: (sub.problem.tags || []).join(','),
                solved_at: solvedAt,
              });
            }
          }
        }
        return Array.from(solvedMap.values());
      }
    } catch (error: any) {
      console.error(`Error fetching Codeforces submissions for ${username}:`, error.message);
    }
    return [];
  }

  public static async fetchUserRatingHistory(username: string): Promise<CodeforcesHistoryItem[]> {
    try {
      const response = await httpGet(`${this.BASE_URL}/user.rating`, {
        params: { handle: username },
        timeout: 10000,
      });
      if (response.data.status === 'OK') {
        return response.data.result as CodeforcesHistoryItem[];
      }
    } catch (error: any) {
      console.error(`Error fetching Codeforces rating history for ${username}:`, error.message);
    }
    return [];
  }
}
