import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from '../config';

export async function httpGet<T = any>(url: string, options: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
  const scraperApiKey = process.env.SCRAPER_API_KEY || config.scraperApiKey || '';

  if (scraperApiKey) {
    // Construct full target URL including query parameters
    const targetUrl = axios.getUri({ url, params: options.params });
    console.log(`[ScraperAPI] Routing request for: ${targetUrl}`);

    return axios.get<T>('http://api.scraperapi.com', {
      params: {
        api_key: scraperApiKey,
        url: targetUrl,
      },
      headers: {}, // ScraperAPI manages headers for anti-scraping
      timeout: options.timeout,
    });
  }

  // Direct fallback
  return axios.get<T>(url, options);
}
