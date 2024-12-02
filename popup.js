document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('groupForm');
  const domainInput = document.getElementById('domain');
  const groupNameInput = document.getElementById('groupName');
  const message = document.getElementById('message');
  const colorInput = document.getElementById('color');
  const colorNameSelect = document.getElementById('colorName');
  const removeGroupBtn = document.getElementById('removeGroup');

  function extractMainDomain(hostname) {
    hostname = hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts.slice(1).join('.');
    }
    return hostname;
  }

  // 获取当前标签页的URL并填充域名，同时检查已有分组
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const url = new URL(tabs[0].url);
    const domain = extractMainDomain(url.hostname);
    domainInput.value = domain;
    
    // 检查是否已有该域名的分组设置
    chrome.storage.sync.get('groups', function(data) {
      const groups = data.groups || [];
      const existingGroup = groups.find(group => group.domain === domain);
      
      if (existingGroup) {
        // 如果找到已有分组，显示取消分组按钮
        removeGroupBtn.style.display = 'block';
        // 使用已有的设置
        groupNameInput.value = existingGroup.groupName;
        selectedColor = existingGroup.color;
        // 更新颜色按钮选中状态
        colorButtons.forEach(btn => {
          if (btn.dataset.color === existingGroup.color) {
            btn.classList.add('selected');
          } else {
            btn.classList.remove('selected');
          }
        });
      } else {
        removeGroupBtn.style.display = 'none';
        // 如果没有已有分组，使用默认设置
        groupNameInput.value = domain.split('.')[0];
        document.querySelector('.color-btn.grey').classList.add('selected');
      }
    });
  });

  // 定义有效的颜色列表
  const validColors = ['blue', 'cyan', 'green', 'grey', 'orange', 'pink', 'purple', 'red', 'yellow'];
  let selectedColor = 'grey'; // 默认颜色

  // 颜色选择逻辑
  const colorButtons = document.querySelectorAll('.color-btn');
  colorButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const color = this.dataset.color;
      // 确保颜色值有效
      if (validColors.includes(color)) {
        // 移除其他按钮的选中状态
        colorButtons.forEach(b => b.classList.remove('selected'));
        // 添加当前按钮的选中状态
        this.classList.add('selected');
        // 更新选中的颜色
        selectedColor = color;

        // 立即更新存储的设置和标签页分组
        const domain = domainInput.value;
        const groupName = groupNameInput.value;

        chrome.storage.sync.get('groups', function(data) {
          const groups = data.groups || [];
          const existingGroupIndex = groups.findIndex(group => group.domain === domain);
          
          if (existingGroupIndex !== -1) {
            // 更新已有分组
            groups[existingGroupIndex].color = color;
            
            chrome.storage.sync.set({ groups: groups }, function() {
              // 更新现有标签组的颜色
              chrome.tabGroups.query({}, function(existingGroups) {
                const existingGroup = existingGroups.find(g => g.title === groupName);
                if (existingGroup) {
                  // 更新颜色时保持当前的折叠状态
                  chrome.tabGroups.update(existingGroup.id, { 
                    color: color,
                    collapsed: true  // 更新颜色时也隐藏标签组
                  });
                }
              });
              
              message.textContent = '颜色更新成功';
              setTimeout(() => {
                message.textContent = '';
              }, 1500);
            });
          }
        });
      }
    });
  });

  // 添加取消分组按钮的点击事件处理
  removeGroupBtn.addEventListener('click', function() {
    const domain = domainInput.value;
    const groupName = groupNameInput.value;

    // 从存储中移除分组
    chrome.storage.sync.get('groups', function(data) {
      const groups = data.groups || [];
      const updatedGroups = groups.filter(group => group.domain !== domain);
      
      chrome.storage.sync.set({ groups: updatedGroups }, function() {
        // 查找所有匹配的标签页并解散分组
        chrome.tabs.query({}, function(allTabs) {
          // 找到所有匹配域名的标签页
          const matchingTabs = allTabs.filter(tab => {
            try {
              const tabDomain = extractMainDomain(new URL(tab.url).hostname.replace(/^www\./, ''));
              return tabDomain === domain;
            } catch (e) {
              return false;
            }
          });

          // 获取这些标签页的ID
          const matchingTabIds = matchingTabs.map(tab => tab.id);

          if (matchingTabIds.length > 0) {
            // 解散这些标签页的分组
            chrome.tabs.ungroup(matchingTabIds);
          }
          
          message.textContent = '已取消分组';
          setTimeout(function() {
            window.close();
          }, 1500);
        });
      });
    });
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const domain = domainInput.value;
    const groupName = groupNameInput.value;
    if (!validColors.includes(selectedColor)) {
      selectedColor = 'grey';
    }
    const color = selectedColor;

    chrome.storage.sync.get('groups', function(data) {
      const groups = data.groups || [];
      const existingGroupIndex = groups.findIndex(group => group.domain === domain);
      
      if (existingGroupIndex !== -1) {
        // 更新已有分组
        groups[existingGroupIndex] = { domain, groupName, color };
      } else {
        // 添加新分组
        groups.push({ domain, groupName, color });
      }
      
      chrome.storage.sync.set({ groups: groups }, function() {
        message.textContent = '保存成功';
        
        // 查找所有匹配的标签页并进行分组
        chrome.tabs.query({}, function(allTabs) {
          const matchingTabs = allTabs.filter(tab => {
            const tabDomain = extractMainDomain(new URL(tab.url).hostname.replace(/^www\./, ''));
            return tabDomain === domain;
          });

          const matchingTabIds = matchingTabs.map(tab => tab.id);

          if (matchingTabIds.length > 0) {
            chrome.tabGroups.query({}, function(existingGroups) {
              const existingGroup = existingGroups.find(g => g.title === groupName);
              if (existingGroup) {
                chrome.tabs.group({ tabIds: matchingTabIds, groupId: existingGroup.id }, function(groupId) {
                  // 隐藏已有的标签组
                  chrome.tabGroups.update(groupId, { collapsed: true });
                });
              } else {
                chrome.tabs.group({ tabIds: matchingTabIds }, function(groupId) {
                  chrome.tabGroups.update(groupId, {
                    title: groupName,
                    color: color,
                    collapsed: true  // 创建新分组时直接隐藏
                  });
                });
              }
            });
          }
        });

        setTimeout(function() {
          window.close();
        }, 1500);
      });
    });
  });
});