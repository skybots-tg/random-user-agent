import RegisteredContentScript = chrome.scripting.RegisteredContentScript
import { canonizeDomain, validateDomainOrIP } from '~/shared'
import type { ReadonlySettingsState } from '~/shared/types'

// the common properties for the content scripts
const common: Omit<RegisteredContentScript, 'id' | 'matches'> = {
  allFrames: true,
  runAt: 'document_start',
}

/** Converts the domains list into the match patterns (including all subdomains). */
const toMatchPatterns = (domains: ReadonlyArray<string>): Array<string> => [
  ...new Set(
    domains
      .map(canonizeDomain)
      .filter(validateDomainOrIP)
      .flatMap((domain) =>
        // IPv6 addresses must be wrapped into the brackets, and IP addresses have no subdomains
        domain.includes(':')
          ? [`*://[${domain}]/*`]
          : /^[\d.]+$/.test(domain)
            ? [`*://${domain}/*`]
            : [`*://${domain}/*`, `*://*.${domain}/*`]
      )
  ),
]

/**
 * Returns the matching rules for the content scripts, based on the blacklist settings. On the sites where the
 * extension is disabled the scripts must not be injected at all, because any injected code can break the page.
 *
 * Returns undefined if the scripts should not be registered at all.
 */
const matchingRules = (
  settings: ReadonlySettingsState
): Pick<RegisteredContentScript, 'matches' | 'excludeMatches'> | undefined => {
  if (!settings.enabled || !settings.jsProtection.enabled) {
    return // nothing to protect - the injected script works only with the JS protection enabled
  }

  const patterns = toMatchPatterns(settings.blacklist.domains)

  switch (settings.blacklist.mode) {
    case 'blacklist':
      return patterns.length ? { matches: ['<all_urls>'], excludeMatches: patterns } : { matches: ['<all_urls>'] }

    case 'whitelist':
      return patterns.length ? { matches: patterns } : undefined
  }
}

/** Register the content scripts (or unregister them, if they are not needed with the current settings) */
export async function registerContentScripts(settings: ReadonlySettingsState) {
  // first, unregister (probably) previously registered content scripts
  await chrome.scripting.unregisterContentScripts()

  const rules = matchingRules(settings)
  if (!rules) {
    return
  }

  try {
    // the script is executed in the main world directly, without adding any tags to the page
    await chrome.scripting.registerContentScripts([
      { ...common, ...rules, id: 'inject', js: [__UNIQUE_INJECT_FILENAME__], world: 'MAIN' },
    ])
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.toLowerCase().includes('unexpected property') &&
      err.message.includes('world')
    ) {
      // if so, it means that the "world" property is not supported by the current browser (FireFox before v128),
      // so we need to register the content script that adds the "inject" script to the page using the script tag
      //
      // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/RegisteredContentScript#browser_compatibility
      return await chrome.scripting.registerContentScripts([{ ...common, ...rules, id: 'content', js: ['content.js'] }])
    }

    throw err
  }
}
