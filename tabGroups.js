// 在标签组激活的处理函数中
async function onTabGroupActivated(group) {
  const settings = await getSettings();
  
  if (settings.autoCollapseGroups) {
    // 获取所有标签组
    const groups = await chrome.tabGroups.query({});
    
    // 折叠除了当前激活组之外的所有组
    for (const otherGroup of groups) {
      if (otherGroup.id !== group.id) {
        await chrome.tabGroups.update(otherGroup.id, { collapsed: true });
      }
    }
    
    // 确保当前组展开
    await chrome.tabGroups.update(group.id, { collapsed: false });
  }
}

// 添加事件监听
chrome.tabGroups.onUpdated.addListener((group) => {
  if (group.collapsed === false) {
    onTabGroupActivated(group);
  }
}); 