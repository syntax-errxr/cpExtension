import axios from 'axios';
import { httpGet } from '../utils/http';
import * as cheerio from 'cheerio';

export interface AtCoderProfile {
  rating: number;
  last_contest_name?: string;
  last_contest_rank?: number;
  last_contest_delta?: number;
}

export interface AtCoderContest {
  id: string;
  name: string;
  platform: string;
  start_time: Date;
  duration_seconds: number;
  url: string;
  status: string;
}

export class AtCoderService {
  private static BASE_URL = 'https://atcoder.jp';
  private static HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  public static async fetchUserRating(username: string): Promise<AtCoderProfile | null> {
    try {
      const profileUrl = `${this.BASE_URL}/users/${username}`;
      const response = await httpGet(profileUrl, { headers: this.HEADERS, timeout: 10000 });
      if (response.status !== 200) return null;

      const $ = cheerio.load(response.data);
      
      // Parse current rating from the profile table
      let rating = 0;
      $('th').each((_, elem) => {
        const text = $(elem).text().trim();
        if (text === 'Rating') {
          const valText = $(elem).next().text().trim();
          const match = valText.match(/\d+/);
          if (match) {
            rating = parseInt(match[0], 10);
          }
        }
      });

      if (rating === 0) return null; // User not found or no rating

      // Fetch contest history JSON to get last contest details
      const historyUrl = `${this.BASE_URL}/users/${username}/history/json`;
      const historyResponse = await httpGet(historyUrl, { headers: this.HEADERS, timeout: 10000 });
      let lastContestName: string | undefined;
      let lastContestRank: number | undefined;
      let lastContestDelta: number | undefined;

      if (historyResponse.status === 200 && Array.isArray(historyResponse.data)) {
        const history = historyResponse.data.filter((item: any) => item.IsRated);
        if (history.length > 0) {
          const lastItem = history[history.length - 1];
          lastContestName = lastItem.ContestName;
          lastContestRank = lastItem.Place;
          lastContestDelta = lastItem.NewRating - lastItem.OldRating;
        }
      }

      return {
        rating,
        last_contest_name: lastContestName,
        last_contest_rank: lastContestRank,
        last_contest_delta: lastContestDelta,
      };
    } catch (error: any) {
      console.error(`Error fetching AtCoder stats for ${username}:`, error.message);
    }
    return null;
  }

  public static async fetchUpcomingContests(): Promise<AtCoderContest[]> {
    try {
      const response = await httpGet(`${this.BASE_URL}/contests/`, { headers: this.HEADERS, timeout: 10000 });
      if (response.status !== 200) return [];

      const $ = cheerio.load(response.data);
      const upcoming: AtCoderContest[] = [];

      // AtCoder has an "Upcoming Contests" table, usually inside the div with id #contest-table-upcoming
      const upcomingTable = $('#contest-table-upcoming table tbody');
      if (upcomingTable.length > 0) {
        upcomingTable.find('tr').each((_, row) => {
          const cols = $(row).find('td');
          if (cols.length >= 4) {
            // Col 0: Start Time (link)
            const timeStr = $(cols[0]).find('a').text().trim();
            // Format is usually: "2024-06-15 21:00:00+0900"
            const start_time = new Date(timeStr.replace(' ', 'T'));

            // Col 1: Contest Name
            const nameLink = $(cols[1]).find('a');
            const name = nameLink.text().trim();
            const href = nameLink.attr('href') || '';
            const contestId = href.split('/').pop() || '';

            // Col 2: Duration
            const durationStr = $(cols[2]).text().trim(); // e.g. "01:40"
            const durationParts = durationStr.split(':');
            let duration_seconds = 7200; // default 2h
            if (durationParts.length === 2) {
              const hours = parseInt(durationParts[0], 10);
              const minutes = parseInt(durationParts[1], 10);
              duration_seconds = (hours * 3600) + (minutes * 60);
            }

            upcoming.push({
              id: `atcoder-${contestId}`,
              name,
              platform: 'atcoder',
              start_time,
              duration_seconds,
              url: `${this.BASE_URL}${href}`,
              status: 'upcoming',
            });
          }
        });
      }
      return upcoming;
    } catch (error: any) {
      console.error('Error fetching AtCoder upcoming contests:', error.message);
    }
    return [];
  }
}
