// CP Extension Background Service Worker

// Create check alarm on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("CP Extension background service worker installed.");
  
  // Set alarm to check contest schedules every 30 minutes
  chrome.alarms.create("check_contests_alarm", {
    periodInMinutes: 30
  });
  
  // Initial check
  checkUpcomingContests();
});

// Alarm event listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "check_contests_alarm") {
    checkUpcomingContests();
  } else if (alarm.name.startsWith("contest-alarm|")) {
    const parts = alarm.name.split("|");
    const contestId = parts[1];
    const contestName = parts[2] || "Contest";
    
    // Trigger browser notification
    chrome.notifications.create(alarm.name, {
      type: "basic",
      iconUrl: "icon.png",
      title: "Contest Starting Soon!",
      message: `"${contestName}" starts in 5 minutes! Click here to open the page.`,
      priority: 2,
      requireInteraction: true
    });
    
    // Remove the alarm ID from active alarms storage
    chrome.storage.local.get(["active_contest_alarms"], (result) => {
      const activeAlarms = result.active_contest_alarms || [];
      const updated = activeAlarms.filter(id => id !== contestId);
      chrome.storage.local.set({ active_contest_alarms: updated });
    });
  }
});

// Notification click event listener
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith("contest-alarm|")) {
    const parts = notificationId.split("|");
    const contestUrl = parts[3];
    if (contestUrl) {
      chrome.tabs.create({ url: contestUrl });
    }
  }
});

// Fetch contests from backend and trigger notifications if starting soon
async function checkUpcomingContests() {
  try {
    const response = await fetch("http://localhost:8000/api/contests");
    if (!response.ok) return;
    
    const contests = await response.json();
    const now = new Date();
    const notificationThreshold = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    chrome.storage.local.get(["notified_contests"], (result) => {
      const notified = result.notified_contests || [];
      const newNotified = [...notified];
      let hasChanges = false;
      
      for (const contest of contests) {
        const startTime = new Date(contest.start_time);
        const timeDiff = startTime.getTime() - now.getTime();
        
        // Check if contest starts in less than 30 minutes and is in the future
        if (timeDiff > 0 && timeDiff <= notificationThreshold) {
          const contestKey = `notified-${contest.id}`;
          
          if (!notified.includes(contestKey)) {
            // Trigger browser notification
            chrome.notifications.create(contest.id, {
              type: "basic",
              iconUrl: "icon.png",
              title: "Contest Starting Soon!",
              message: `${contest.name} on ${contest.platform.toUpperCase()} starts in 30 minutes!`,
              priority: 2
            });
            newNotified.push(contestKey);
            hasChanges = true;
          }
        }
      }
      
      if (hasChanges) {
        // Keep storage size bounded (last 20 notifications)
        if (newNotified.length > 20) {
          newNotified.splice(0, newNotified.length - 20);
        }
        chrome.storage.local.set({ notified_contests: newNotified });
      }
    });
  } catch (err) {
    console.warn("Background contests notification check failed:", err);
  }
}
