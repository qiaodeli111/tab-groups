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