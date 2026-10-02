// ⚠ DO NOT IMPORT ANYTHING EXCEPT TYPES HERE DUE THE `import()` ERRORS ⚠

// wrap everything to avoid polluting the global scope

;(() => {
  try {
    // Important Note:
    //
    // This script is a fallback for browsers without support for the `world` property in the
    // `chrome.scripting.registerContentScripts` API (FireFox before v128). In such browsers the "inject" script
    // code must be added to the page using the script tag.
    //
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/RegisteredContentScript

    const script = document.createElement('script')
    const parent = document.head || document.documentElement

    // the script must be a classic one (NOT `type="module"`): once any module script starts loading, the browser
    // ignores all the `<script type="importmap">` that follow it, and sites that rely on import maps (GitHub, for
    // example) stop working - https://github.com/tarampampam/random-user-agent/issues/634
    script.setAttribute('id', __UNIQUE_INJECT_FILENAME__)
    script.src = chrome.runtime.getURL(__UNIQUE_INJECT_FILENAME__)

    parent.prepend(script)
  } catch (err) {
    console.warn('🧨 RUA: An error occurred in the content script', err)
  }
})()
