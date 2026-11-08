const ALARM_NAME = 'revolveTabsAlarm';

// متغير لتتبع التبويب الذي قامت الإضافة بتفعيله برمجياً
// لمنع الخلط بين تبديل الإضافة وتبديل المستخدم اليدوي
let expectedProgrammaticTabId = null;

// تهيئة الإعدادات الافتراضية عند التثبيت
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    enabled: false,
    interval: 10,
    disableOnManualSwitch: true,
    selectedTabs: [],
    currentIndex: 0
  });
});

// الاستماع لأي تغييرات في الإعدادات
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local') {
    if (changes.enabled || changes.interval) {
      await setupAlarm();
    }
  }
});

// ضبط المؤقت الزمني
async function setupAlarm() {
  const data = await chrome.storage.local.get(['enabled', 'interval']);
  await chrome.alarms.clear(ALARM_NAME);

  if (data.enabled) {
    const periodInMinutes = (data.interval || 10) / 60;
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: periodInMinutes,
      periodInMinutes: periodInMinutes
    });
    updateBadge(true);
  } else {
    updateBadge(false);
  }
}

// إظهار شارة (ON) على أيقونة الإضافة عند عملها
function updateBadge(isEnabled) {
  if (isEnabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#38bdf8' }); // Sky-Blue
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// تنفيذ التدوير عند رنين المؤقت
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await revolveNextTab();
  }
});

async function revolveNextTab() {
  const data = await chrome.storage.local.get({
    enabled: false,
    selectedTabs: [],
    currentIndex: 0
  });

  if (!data.enabled) return;

  // جلب جميع التبويبات المفتوحة
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  if (allTabs.length === 0) return;

  // تصفية التبويبات المختارة في القائمة (إن وجدت)
  let targetTabs = allTabs.filter(tab => data.selectedTabs.includes(tab.id));

  // إذا لم يحدد المستخدم أي تبويب (أو أُغلقت التبويبات المختارة)، يتم تدوير كل التبويبات في النافذة
  if (targetTabs.length === 0) {
    targetTabs = allTabs;
  }

  let nextIndex = (data.currentIndex + 1) % targetTabs.length;
  const nextTab = targetTabs[nextIndex];

  if (nextTab) {
    // تسجيل هوية التبويب القادم كـ "تبديل برمجي" قبل الانتقال إليه
    expectedProgrammaticTabId = nextTab.id;
    await chrome.storage.local.set({ currentIndex: nextIndex });
    
    try {
      await chrome.tabs.update(nextTab.id, { active: true });
    } catch (error) {
      expectedProgrammaticTabId = null;
    }
  }
}

// مراقبة انتقال المستخدم إلى تبويب آخر يدوياً
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // إذا كان التبويب النشط هو نفسه الذي انتقلت إليه الإضافة تلقائياً، نتجاهل الحدث
  if (activeInfo.tabId === expectedProgrammaticTabId) {
    expectedProgrammaticTabId = null;
    return;
  }

  // أما إذا انتقل المستخدم بنفسه إلى تبويب آخر:
  const data = await chrome.storage.local.get(['enabled', 'disableOnManualSwitch']);
  if (data.enabled && data.disableOnManualSwitch) {
    await chrome.storage.local.set({ enabled: false });
  }
});

// تنظيف قائمة التبويبات المختارة تلقائياً إذا قام المستخدم بإغلاق أحدها
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.local.get({ selectedTabs: [] });
  if (data.selectedTabs.includes(tabId)) {
    const updatedTabs = data.selectedTabs.filter(id => id !== tabId);
    await chrome.storage.local.set({ selectedTabs: updatedTabs });
  }
});