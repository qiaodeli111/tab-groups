document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('groupForm');
  const domainInput = document.getElementById('domain');
  const groupNameInput = document.getElementById('groupName');
  const message = document.getElementById('message');
  const colorInput = document.getElementById('color');
  const colorNameSelect = document.getElementById('colorName');

  function extractMainDomain(hostname) {
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  }

  // 获取当前标签页的URL并填充域名
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const url = new URL(tabs[0].url);
    const domain = extractMainDomain(url.hostname.replace(/^www\./, ''));
    domainInput.value = domain;
    groupNameInput.value = domain.split('.')[0]; // 使用主域名作为分组名称
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
      }
    });
  });

  // 设置默认选中的颜色
  document.querySelector('.color-btn.grey').classList.add('selected');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const domain = domainInput.value;
    const groupName = groupNameInput.value;
    // 确保颜色值有效
    if (!validColors.includes(selectedColor)) {
      selectedColor = 'grey'; // 如果无效就使用默认颜色
    }
    const color = selectedColor;

    chrome.storage.sync.get('groups', function(data) {
      const groups = data.groups || [];
      groups.push({ 
        domain, 
        groupName, 
        color
      });
      
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
                chrome.tabs.group({ tabIds: matchingTabIds, groupId: existingGroup.id });
              } else {
                chrome.tabs.group({ tabIds: matchingTabIds }, function(groupId) {
                  chrome.tabGroups.update(groupId, {
                    title: groupName,
                    color: color
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