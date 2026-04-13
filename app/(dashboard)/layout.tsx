// 대시보드 레이아웃 (사이드바 포함, Phase 2에서 완성)
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* 사이드바 자리 */}
      <aside className="w-64 border-r bg-card p-4">
        <p className="font-bold text-lg">퀄리오</p>
      </aside>
      {/* 메인 콘텐츠 */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}
