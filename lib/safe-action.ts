import { createSafeActionClient } from 'next-safe-action'

// next-safe-action 클라이언트 — 서버 액션 전체에서 공통으로 사용
// [APP] 접두사가 있는 에러만 클라이언트에 전달, 나머지는 일반 메시지로 sanitize
export const action = createSafeActionClient({
  handleServerError(e) {
    if (e.message.startsWith('[APP]')) return e.message.replace('[APP] ', '')
    console.error('[ServerAction Error]', e)
    return '요청 처리 중 오류가 발생했습니다'
  },
})
