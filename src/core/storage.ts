// 端末の中だけに保存する（ベスト記録・設定）。プライベートブラウズなどで使えなくても遊べるようにする
const PREFIX = 'pickle-asobi:'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // 保存できなくても遊びは続ける
  }
}
