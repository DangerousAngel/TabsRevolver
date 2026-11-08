document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enableToggle');
  const timeInterval = document.getElementById('timeInterval');
  const timeValue = document.getElementById('timeValue');
  const disableOnSwitch = document.getElementById('disableOnSwitch');
  const tabsList = document.getElementById('tabsList');
  const selectAllBtn = document.getElementById('selectAllBtn');

  // 1. استرجاع الإعدادات المحفوظة
  const data = await chrome.storage.local.get({
    enabled: false,
    interval: 10,
    disableOnManualSwitch: true,
    selectedTabs: []
  });

  enableToggle.checked = data.enabled;
  timeInterval.value = data.interval;
  timeValue.textContent = data.interval;
  disableOnSwitch.checked = data.disableOnManualSwitch;

  // 2. جلب التبويبات المفتوحة في النافذة الحالية وعرضها
  const tabs = await chrome.tabs.query({ currentWindow: true });
  let selectedTabIds = new Set(data.selectedTabs);

  function renderTabs() {
    tabsList.innerHTML = '';
    tabs.forEach(tab => {
      const item = document.createElement('div');
      item.className = 'tab-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = tab.id;
      checkbox.id = `tab-${tab.id}`;
      checkbox.checked = selectedTabIds.has(tab.id);

      checkbox.addEventListener('change', async () => {
        if (checkbox.checked) {
          selectedTabIds.add(tab.id);
        } else {
          selectedTabIds.delete(tab.id);
        }
        await chrome.storage.local.set({ selectedTabs: Array.from(selectedTabIds) });
      });

      const icon = document.createElement('img');
      icon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>';

      const label = document.createElement('label');
      label.htmlFor = `tab-${tab.id}`;
      label.className = 'tab-title';
      label.textContent = tab.title || tab.url;
      label.title = tab.title;

      item.appendChild(checkbox);
      item.appendChild(icon);
      item.appendChild(label);
      tabsList.appendChild(item);
    });
  }

  renderTabs();

  // 3. زر تحديد / إلغاء تحديد الكل
  selectAllBtn.addEventListener('click', async () => {
    const allSelected = tabs.every(t => selectedTabIds.has(t.id));
    if (allSelected) {
      selectedTabIds.clear();
    } else {
      tabs.forEach(t => selectedTabIds.add(t.id));
    }
    renderTabs();
    await chrome.storage.local.set({ selectedTabs: Array.from(selectedTabIds) });
  });

  // 4. تحديث الأحداث وحفظها في التخزين
  enableToggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ enabled: enableToggle.checked });
  });

  timeInterval.addEventListener('input', () => {
    timeValue.textContent = timeInterval.value;
  });

  timeInterval.addEventListener('change', async () => {
    await chrome.storage.local.set({ interval: parseInt(timeInterval.value, 10) });
  });

  disableOnSwitch.addEventListener('change', async () => {
    await chrome.storage.local.set({ disableOnManualSwitch: disableOnSwitch.checked });
  });

  // تحديث زر التفعيل إذا تم إيقافه تلقائياً من الخلفية أثناء فتح النافذة
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
      enableToggle.checked = changes.enabled.newValue;
    }
  });
});