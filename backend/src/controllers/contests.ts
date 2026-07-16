import { Router, Request, Response } from 'express';
import axios from 'axios';
import { httpGet } from '../utils/http';
import { redis } from '../utils/redis';
import { AtCoderService } from '../services/atcoder';
import { CodeChefService } from '../services/codechef';

const router = Router();

const CACHE_KEY = 'upcoming_contests';
const CACHE_TTL = 900; // 15 minutes in seconds

// In-memory cache fallback
let memoryCache: any[] | null = null;
let memoryCacheExpiry = 0;

function getLeetCodeUpcomingContests(): any[] {
  const contests = [];
  const now = new Date();

  // 1. Weekly Contest (Every Sunday 02:30 UTC)
  // Next 2 Sundays
  for (let i = 0; i < 2; i++) {
    const weekly = new Date();
    weekly.setUTCHours(2, 30, 0, 0);
    const day = weekly.getUTCDay();
    const daysToAdd = day === 0 ? i * 7 : 7 - day + i * 7;
    weekly.setUTCDate(weekly.getUTCDate() + daysToAdd);

    if (weekly > now) {
      // Pivot: Weekly Contest 400 was on June 2, 2024.
      const pivotDate = new Date('2024-06-02T02:30:00Z');
      const diffWeeks = Math.floor((weekly.getTime() - pivotDate.getTime()) / (7 * 24 * 3600 * 1000));
      const contestNum = 400 + diffWeeks;

      contests.push({
        id: `leetcode-weekly-contest-${contestNum}`,
        name: `Weekly Contest ${contestNum}`,
        platform: 'leetcode',
        start_time: weekly.toISOString(),
        duration_seconds: 5400, // 1.5h
        url: 'https://leetcode.com/contest/',
        status: 'upcoming',
      });
    }
  }

  // 2. Biweekly Contest (Every 2 weeks on Saturday 14:30 UTC)
  // Pivot: Biweekly Contest 132 was on June 8, 2024.
  const biweeklyPivot = new Date('2024-06-08T14:30:00Z');
  const msInTwoWeeks = 14 * 24 * 3600 * 1000;
  const elapsed = now.getTime() - biweeklyPivot.getTime();
  const intervals = Math.ceil(elapsed / msInTwoWeeks);

  for (let i = 0; i < 2; i++) {
    const biweeklyTime = new Date(biweeklyPivot.getTime() + (intervals + i) * msInTwoWeeks);
    if (biweeklyTime > now) {
      const contestNum = 132 + intervals + i;
      contests.push({
        id: `leetcode-biweekly-contest-${contestNum}`,
        name: `Biweekly Contest ${contestNum}`,
        platform: 'leetcode',
        start_time: biweeklyTime.toISOString(),
        duration_seconds: 5400,
        url: 'https://leetcode.com/contest/',
        status: 'upcoming',
      });
    }
  }

  return contests;
}

async function fetchCodeforcesUpcoming(): Promise<any[]> {
  try {
    const response = await httpGet('https://codeforces.com/api/contest.list', { timeout: 8000 });
    if (response.data.status === 'OK') {
      const list: any[] = response.data.result;
      return list
        .filter((c) => c.phase === 'BEFORE')
        .map((c) => ({
          id: `codeforces-${c.id}`,
          name: c.name,
          platform: 'codeforces',
          start_time: new Date(c.startTimeSeconds * 1000).toISOString(),
          duration_seconds: c.durationSeconds,
          url: `https://codeforces.com/contest/${c.id}`,
          status: 'upcoming',
        }));
    }
  } catch (error: any) {
    console.error('Error fetching Codeforces upcoming contests:', error.message);
  }
  return [];
}

router.get('/', async (req: Request, res: Response) => {
  const nowMs = Date.now();

  try {
    // 1. Try Redis cache
    if (redis) {
      try {
        const cached = await redis.get(CACHE_KEY);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (redisErr: any) {
        console.warn('Redis read failed, falling back to database/in-memory:', redisErr.message);
      }
    }

    // 2. Try In-memory cache fallback (also checked if Redis read failed or was disabled)
    if (memoryCache && nowMs < memoryCacheExpiry) {
      return res.json(memoryCache);
    }

    console.log('Cache miss: fetching upcoming contests from platforms...');

    // 3. Fetch from all platforms concurrently
    const [cfContests, acContests, ccContests] = await Promise.all([
      fetchCodeforcesUpcoming(),
      AtCoderService.fetchUpcomingContests().catch(() => []),
      CodeChefService.fetchUpcomingContests().catch(() => []),
    ]);

    const lcContests = getLeetCodeUpcomingContests();

    // Map Atcoder and CodeChef start_times to strings
    const acMapped = acContests.map(c => ({ ...c, start_time: c.start_time.toISOString() }));
    const ccMapped = ccContests.map(c => ({ ...c, start_time: c.start_time.toISOString() }));

    // 4. Combine and sort
    const combined = [...cfContests, ...acMapped, ...ccMapped, ...lcContests];
    combined.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // 5. Store in Cache
    let storedInRedis = false;
    if (redis) {
      try {
        await redis.set(CACHE_KEY, JSON.stringify(combined), 'EX', CACHE_TTL);
        storedInRedis = true;
      } catch (redisErr: any) {
        console.warn('Redis write failed:', redisErr.message);
      }
    }

    if (!storedInRedis) {
      memoryCache = combined;
      memoryCacheExpiry = nowMs + (CACHE_TTL * 1000);
    }

    return res.json(combined);
  } catch (error: any) {
    console.error('Error in upcoming contests retrieval:', error.message);
    return res.status(500).json({ detail: 'Failed to retrieve contest schedule.' });
  }
});

export const contestsRouter = router;
