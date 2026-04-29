export interface FrequencyData {
  type: 'weekly' | 'monthly'
  count: number
  days?: string[] // 주 단위일 때만 사용
}

// 구 enum 값 → 표시 텍스트 (레거시 데이터 호환)
const LEGACY_LABEL: Record<string, string> = {
  weekly: '주 1회',
  biweekly: '격주 1회',
  monthly: '월 1회',
}

export function parseFrequency(value: string): FrequencyData | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as FrequencyData
    if (parsed.type === 'weekly' || parsed.type === 'monthly') {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function serializeFrequency(data: FrequencyData): string {
  return JSON.stringify(data)
}

// 표시용 텍스트 변환 (레거시 포함)
export function formatFrequency(value: string): string {
  if (!value) return '—'

  // 레거시 enum 값
  if (LEGACY_LABEL[value]) return LEGACY_LABEL[value]!

  const parsed = parseFrequency(value)
  if (!parsed) return value // 파싱 실패 시 원본 반환

  if (parsed.type === 'weekly') {
    const days = parsed.days && parsed.days.length > 0
      ? ` (${parsed.days.join('·')})`
      : ''
    return `주 ${parsed.count}회${days}`
  }

  return `월 ${parsed.count}회`
}
