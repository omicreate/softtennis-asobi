import { describe, expect, it } from 'vitest'
import { externalOpenUrl, inAppName, osOf } from './browser'

const IG_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.27.105 (iPhone15,2; iOS 18_5; ja_JP; ja; scale=3.00; 1179x2556; 712345678)'
const IG_AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Instagram 390.0.0.27.105 Android (34/14; 420dpi; 1080x2400; Google; Pixel 7; panther; tensor; ja_JP; 712345678)'
const THREADS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 360.0.0.10.105 (iPhone15,2; iOS 18_5; ja_JP; ja)'
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const CHROME_AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'

describe('どのブラウザで開いているか', () => {
  it('インスタ・スレッズ・LINE の中のブラウザを見分ける。ふつうの Safari・Chrome は null', () => {
    expect(inAppName(IG_IOS)).toBe('Instagram')
    expect(inAppName(IG_AND)).toBe('Instagram')
    expect(inAppName(THREADS)).toBe('Threads')
    expect(inAppName('Mozilla/5.0 (iPhone) Line/14.0.0')).toBe('LINE')
    expect(inAppName(SAFARI)).toBeNull()
    expect(inAppName(CHROME_AND)).toBeNull()
  })

  it('iPhone か Android か（iPad の Safari は Mac と名のるので、さわれるかで見る）', () => {
    expect(osOf(IG_IOS, 5)).toBe('ios')
    expect(osOf(IG_AND, 5)).toBe('android')
    expect(osOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 5)).toBe('ios')
    expect(osOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 0)).toBe('other')
  })

  it('ふつうのブラウザで開くリンク：Android は Chrome の intent（# は intent の前に1つだけ）、iPhone は x-safari', () => {
    const url = 'https://omicreate.github.io/pickle-asobi/?src=pb_ig_bio&go=install'
    const a = externalOpenUrl('android', url)!
    expect(a.startsWith('intent://omicreate.github.io/pickle-asobi/?src=pb_ig_bio&go=install#Intent;')).toBe(true)
    expect(a.split('#')).toHaveLength(2)
    expect(a).toContain('package=com.android.chrome')
    expect(a).toContain(`S.browser_fallback_url=${encodeURIComponent(url)}`)
    expect(externalOpenUrl('ios', url)).toBe(`x-safari-${url}`)
    expect(externalOpenUrl('other', url)).toBeNull()
  })
})
