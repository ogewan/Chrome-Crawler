/* jshint ignore:start*/
chrome.runtime.onMessage.addListener((m, s) => {
    let {text, color, title, disable} = m, tabId = (s.tab) ? s.tab.id : -1;

    if (tabId >= 0) {
        if (!disable) {
            chrome.browserAction.setBadgeText({text, tabId});
            chrome.browserAction.setBadgeBackgroundColor({color, tabId});
            chrome.browserAction.setTitle({title, tabId});
        } else {
            chrome.browserAction.setTitle({title, tabId});
            chrome.browserAction.disable(tabId);
        }
    }
});
/* jshint ignore:end*/
