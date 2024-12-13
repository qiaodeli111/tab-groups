document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('groupForm');
  const domainInput = document.getElementById('domain');
  const groupNameInput = document.getElementById('groupName');
  const message = document.getElementById('message');
  const removeGroupBtn = document.getElementById('removeGroup');
  const autoCollapseCheckbox = document.getElementById('autoCollapse');

  // 提取主域名的函数
  function extractMainDomain(hostname) {
    // 移除开头的 www.
    hostname = hostname.replace(/^www\./, '');
    
    // 处理特殊的二级顶级域名（如 .com.cn, .org.cn 等）
    const specialTLDs = ['.com.cn', '.org.cn', '.net.cn', '.gov.cn'];
    
    // 检查是否是特殊的二级顶级域名
    const isSpecialTLD = specialTLDs.some(tld => hostname.endsWith(tld));
    
    if (isSpecialTLD) {
      // 如果是特殊的二级顶级域名，保留完整域名
      return hostname;
    } else {
      // 对于普通域名，如果有超过两个部分，只保留最后两个部分
      const parts = hostname.split('.');
      if (parts.length > 2) {
        return parts.slice(-2).join('.');
      }
      return hostname;
    }
  }

  // 获取当前标签页的URL并填充域名
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

  // 颜色选择逻辑
  const colorButtons = document.querySelectorAll('.color-btn');
  let selectedColor = 'grey'; // 默认颜色

  colorButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      colorButtons.forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
      selectedColor = this.dataset.color;

      // 立即更新颜色
      const domain = domainInput.value;
      const groupName = groupNameInput.value;

      chrome.storage.sync.get('groups', function(data) {
        const groups = data.groups || [];
        const existingGroupIndex = groups.findIndex(group => group.domain === domain);
        
        if (existingGroupIndex !== -1) {
          // 更新已有分组
          groups[existingGroupIndex] = { 
            ...groups[existingGroupIndex], 
            color: selectedColor 
          };
          
          chrome.storage.sync.set({ groups: groups }, function() {
            // 更新现有标签组的颜色
            chrome.tabGroups.query({}, function(existingGroups) {
              const existingGroup = existingGroups.find(g => g.title === groupName);
              if (existingGroup) {
                chrome.tabGroups.update(existingGroup.id, {
                  color: selectedColor
                }, function() {
                  window.close();
                });
              } else {
                window.close();
              }
            });
          });
        }
      });
    });
  });

  // 表单提交处理
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const domain = domainInput.value;
    const groupName = groupNameInput.value;
    const autoCollapse = autoCollapseCheckbox.checked;

    chrome.storage.sync.get('groups', function(data) {
      const groups = data.groups || [];
      const existingGroupIndex = groups.findIndex(group => group.domain === domain);
      
      if (existingGroupIndex !== -1) {
        // 更新已有分组
        groups[existingGroupIndex] = { domain, groupName, color: selectedColor };
      } else {
        // 添加新分组
        groups.push({ domain, groupName, color: selectedColor });
      }
      
      chrome.storage.sync.set({ groups: groups }, function() {
        // 查找所有匹配的标签页并进行分组
        chrome.tabs.query({}, function(allTabs) {
          const matchingTabs = allTabs.filter(tab => {
            try {
              const tabDomain = extractMainDomain(new URL(tab.url).hostname);
              return tabDomain === domain;
            } catch (e) {
              return false;
            }
          });

          const matchingTabIds = matchingTabs.map(tab => tab.id);

          if (matchingTabIds.length > 0) {
            chrome.tabGroups.query({}, function(existingGroups) {
              const existingGroup = existingGroups.find(g => g.title === groupName);
              if (existingGroup) {
                // 更新现有分组
                chrome.tabs.group({ tabIds: matchingTabIds, groupId: existingGroup.id }, function() {
                  // 更新分组的颜色
                  chrome.tabGroups.update(existingGroup.id, {
                    color: selectedColor
                  }, function() {
                    window.close();
                  });
                });
              } else {
                // 创建新分组
                chrome.tabs.group({ tabIds: matchingTabIds }, function(groupId) {
                  chrome.tabGroups.update(groupId, {
                    title: groupName,
                    color: selectedColor
                  }, function() {
                    window.close();
                  });
                });
              }
            });
          } else {
            window.close();
          }
        });
      });
    });
  });

  // 取消分组按钮处理
  removeGroupBtn.addEventListener('click', function() {
    const domain = domainInput.value;
    
    chrome.storage.sync.get('groups', function(data) {
      const groups = data.groups || [];
      const updatedGroups = groups.filter(group => group.domain !== domain);
      
      chrome.storage.sync.set({ groups: updatedGroups }, function() {
        // 查找所有匹配的标签页并解散分组
        chrome.tabs.query({}, function(allTabs) {
          const matchingTabs = allTabs.filter(tab => {
            try {
              const tabDomain = extractMainDomain(new URL(tab.url).hostname);
              return tabDomain === domain;
            } catch (e) {
              return false;
            }
          });

          const matchingTabIds = matchingTabs.map(tab => tab.id);

          if (matchingTabIds.length > 0) {
            chrome.tabs.ungroup(matchingTabIds, function() {
              window.close();
            });
          } else {
            window.close();
          }
        });
      });
    });
  });

  // 在页面加载时获取设置状态
  chrome.storage.sync.get('settings', function(data) {
    const settings = data.settings || {};
    autoCollapseCheckbox.checked = settings.autoCollapseGroups || false;
  });

  // 修改复选框变化事件处理
  autoCollapseCheckbox.addEventListener('change', function() {
    const autoCollapse = this.checked;

    // 更新全局设置
    chrome.storage.sync.get('settings', function(data) {
      const settings = data.settings || {};
      settings.autoCollapseGroups = autoCollapse;
      
      chrome.storage.sync.set({ settings: settings }, function() {
        // 立即应用新的折叠状态
        if (autoCollapse) {
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0] && tabs[0].groupId && tabs[0].groupId !== -1) {
              // 确保 groupId 存在且有效
              chrome.tabGroups.query({}, function(groups) {
                const currentGroup = groups.find(g => g.id === tabs[0].groupId);
                if (currentGroup) {
                  chrome.runtime.sendMessage({ 
                    type: 'tabGroupActivated', 
                    group: currentGroup 
                  });
                }
              });
            }
          });
        }
      });
    });
  });
});