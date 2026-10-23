// Refreshes SKAdNetworkItems in ios/App/App/Info.plist from Google's AdMob list.
//   npm run ios:skadnetwork
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const PAGE = 'https://developers.google.com/admob/ios/3p-skadnetworks'
const plistPath = join(resolve(import.meta.dirname, '../..'), 'ios/App/App/Info.plist')

const res = await fetch(PAGE)
if (!res.ok) throw new Error(`${PAGE}: HTTP ${res.status}`)
const html = await res.text()
const ids = [...new Set([...html.matchAll(/([a-z0-9]+\.skadnetwork)/g)].map((m) => m[1]!))]
if (!ids.includes('cstr6suwn9.skadnetwork')) throw new Error('Google id missing; the page format may have changed')

const items = ids
  .map((id) => `\t\t<dict>\n\t\t\t<key>SKAdNetworkIdentifier</key>\n\t\t\t<string>${id}</string>\n\t\t</dict>`)
  .join('\n')
const plist = readFileSync(plistPath, 'utf8')
const next = plist.replace(
  /<key>SKAdNetworkItems<\/key>\s*<array>[\s\S]*?<\/array>/,
  `<key>SKAdNetworkItems</key>\n\t<array>\n${items}\n\t</array>`,
)
writeFileSync(plistPath, next)
console.log(`Wrote ${ids.length} SKAdNetwork ids to Info.plist`)
