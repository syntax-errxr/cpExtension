declare const chrome: any;

const API_BASE_URL = "http://localhost:8000/api";

const isExtension = typeof chrome !== 'undefined' && chrome.storage !== undefined && chrome.storage.local !== undefined;

// Storage utility with fallback for browser development
export const storage = {
  get: async (key: string): Promise<string | null> => {
    if (isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result: any) => {
          resolve(result[key] || null);
        });
      });
    } else {
      return localStorage.getItem(key);
    }
  },
  set: async (key: string, value: string): Promise<void> => {
    if (isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          resolve();
        });
      });
    } else {
      localStorage.setItem(key, value);
    }
  },
  remove: async (key: string): Promise<void> => {
    if (isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.remove([key], () => {
          resolve();
        });
      });
    } else {
      localStorage.removeItem(key);
    }
  }
};

// Base Fetch request with auth token headers
async function request(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await storage.get("jwt_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Session expired, remove token
    await storage.remove("jwt_token");
    window.location.reload();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Request failed");
  }

  return response.json();
}

export const api = {

  // Linked Handles
  getLinkedPlatforms: async (): Promise<any> => {
    return request("/user/platforms");
  },

  linkPlatform: async (platform: string, username: string): Promise<any> => {
    return request("/user/platforms", {
      method: "POST",
      body: JSON.stringify({ platform, username }),
    });
  },

  unlinkPlatform: async (platform: string): Promise<any> => {
    return request(`/user/platforms/${platform}`, {
      method: "DELETE",
    });
  },

  // User Stats & Dashboard
  getPreviousContests: async (): Promise<any> => {
    return request("/user/prev-contests");
  },

  syncPlatforms: async (): Promise<any> => {
    return request("/user/sync", {
      method: "POST",
    });
  },

  // Contests
  getUpcomingContests: async (): Promise<any> => {
    return request("/contests");
  }
};
