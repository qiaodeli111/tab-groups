const validColors = ['blue', 'cyan', 'green', 'grey', 'orange', 'pink', 'purple', 'red', 'yellow'];

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.sync.get('groups', function(data) {
      const groups = data.groups || [];
      const url = new URL(tab.url);
      const domain = url.hostname;

      const matchingGroup = groups.find(group => domain.includes(group.domain));

      if (matchingGroup) {
        chrome.tabGroups.query({}, function(existingGroups) {
          const existingGroup = existingGroups.find(g => g.title === matchingGroup.groupName);
          const color = matchingGroup.color.toLowerCase();

          if (!validColors.includes(color)) {
            console.error('Invalid color:', color);
            matchingGroup.color = 'grey';
          }

          if (existingGroup) {
            chrome.tabs.group({ tabIds: tabId, groupId: existingGroup.id });
          } else {
            chrome.tabs.group({ tabIds: tabId }, function(groupId) {
              chrome.tabGroups.update(groupId, {
                title: matchingGroup.groupName,
                color: validColors.includes(color) ? color : 'grey'
              });
            });
          }
        });
      }
    });
  }
});

// 将 isProcessing 定义为全局变量
const state = {
  isProcessing: false
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', function(data) {
      resolve(data.settings || { autoCollapseGroups: false });
    });
  });
}

async function onTabGroupActivated(group) {
  if (state.isProcessing) return;
  state.isProcessing = true;

  try {
    const settings = await getSettings();
    
    if (settings.autoCollapseGroups) {
      const groups = await chrome.tabGroups.query({});
      
      for (const otherGroup of groups) {
        if (otherGroup.id !== group.id) {
          await chrome.tabGroups.update(otherGroup.id, { collapsed: true });
        }
      }
      
      await chrome.tabGroups.update(group.id, { collapsed: false });
    }
  } catch (error) {
    console.error('Error in onTabGroupActivated:', error);
  } finally {
    state.isProcessing = false;
  }
}

// 添加消息监听器来处理来自 popup.js 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'tabGroupActivated' && message.group) {
    onTabGroupActivated(message.group);
  }
});

// 只在 background.js 中添加一次事件监听
chrome.tabGroups.onUpdated.addListener((group) => {
  if (group.collapsed === false && !state.isProcessing) {
    onTabGroupActivated(group).catch(error => {
      console.error('Error handling tab group activation:', error);
    });
  }
});