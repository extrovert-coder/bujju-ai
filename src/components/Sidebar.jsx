import { Plus, MessageSquare, Settings, X, Trash2, LogOut, FileText, Brain, Code2, Bell, Download as DownloadIcon } from 'lucide-react'
import BujjuLogo from './BujjuLogo'

export default function Sidebar({
  isOpen,
  onClose,
  recentChats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  user,
  onLogout,
  onOpenMemory,
  memoriesCount = 0,
  onOpenReminders,
  pendingRemindersCount = 0,
  isLoadingConversations = false,
  currentView = 'chat',
  onSelectView,
  isInstallable = false,
  onInstallApp,
  isIosPwa = false,
  isInstalled = false,
  onOpenInstallGuide,
}) {
  const displayName =
    user?.user_metadata?.name ||
    user?.name ||
    user?.email?.split('@')[0] ||
    'User'
  const userEmail = user?.email || 'authenticated'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col w-[82vw] max-w-[288px] md:w-72 bg-[#1e1f20] border-r border-white/5 text-[#e3e3e3] transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header: Logo and Close (on mobile) */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <BujjuLogo size="md" subtitle="Gemini Flash Intelligence" animated={true} />

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-[#282a2c] md:hidden transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* New Chat Button (Gemini Pill) */}
        <div className="p-3 pb-1">
          <button
            type="button"
            onClick={() => {
              onSelectView?.('chat')
              onNewChat?.()
              onClose?.()
            }}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-full bg-[#131314] hover:bg-[#282a2c] text-[#e3e3e3] border border-white/5 hover:border-neutral-600/40 shadow-xs transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Plus className="h-4 w-4 text-[#8ab4f8]" />
              <span className="text-sm font-medium">New chat</span>
            </div>
            <kbd className="text-[10px] text-[#8e918f] bg-[#1e1f20] px-2 py-0.5 rounded-full border border-white/5">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Workspace Navigation: Chat & Coding Workspace */}
        <div className="px-3 py-2 space-y-1 border-b border-white/5">
          <button
            type="button"
            onClick={() => {
              onSelectView?.('chat')
              onClose?.()
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentView === 'chat'
                ? 'bg-[#282a2c] text-white border border-white/10 shadow-xs'
                : 'text-[#c4c7c5] hover:text-white hover:bg-[#282a2c]/60'
            }`}
          >
            <MessageSquare className="h-4 w-4 text-[#8ab4f8]" />
            <span>Chat Assistant</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectView?.('code')
              onClose?.()
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentView === 'code'
                ? 'bg-[#282a2c] text-white border border-white/10 shadow-xs'
                : 'text-[#c4c7c5] hover:text-white hover:bg-[#282a2c]/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Code2 className="h-4 w-4 text-[#9b72cf]" />
              <span>Coding Workspace</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[#9b72cf]/20 text-[#cbb2fe] font-semibold">
              IDE
            </span>
          </button>
        </div>

        {/* Recent Chats Section */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-3 py-1.5 text-xs font-medium text-[#8e918f]">
            Recent
          </div>

          {isLoadingConversations ? (
            <div className="px-3 py-2 space-y-2">
              <div className="h-7 rounded-full bg-white/5 animate-pulse" />
              <div className="h-7 rounded-full bg-white/5 animate-pulse w-[85%]" />
              <div className="h-7 rounded-full bg-white/5 animate-pulse w-[70%]" />
            </div>
          ) : recentChats.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-neutral-500">
              No recent conversations yet.
            </div>
          ) : (
            recentChats.map((chat) => {
              const isActive = chat.id === activeChatId
              return (
                <div
                  key={chat.id}
                  onClick={() => {
                    onSelectChat(chat.id)
                    onClose?.()
                  }}
                  className={`group relative flex items-center justify-between px-3.5 py-2 rounded-full text-[13px] cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'bg-[#282a2c] text-white font-medium shadow-xs'
                      : 'text-[#c4c7c5] hover:bg-[#282a2c]/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    {chat.file_name ? (
                      <FileText
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-emerald-400'
                            : 'text-emerald-500/70 group-hover:text-emerald-400'
                        }`}
                      />
                    ) : (
                      <MessageSquare
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-[#8ab4f8]'
                            : 'text-[#8e918f] group-hover:text-[#c4c7c5]'
                        }`}
                      />
                    )}
                    <span className="truncate">{chat.title}</span>
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteChat(chat.id)
                    }}
                    title="Delete chat"
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-full text-neutral-400 hover:text-rose-400 hover:bg-[#333538] transition-opacity duration-150 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Bottom Section: Settings & User Profile with Logout */}
        <div className="p-3 border-t border-white/5 space-y-1.5 bg-[#1e1f20]">
          {onOpenMemory && (
            <button
              type="button"
              onClick={() => {
                onOpenMemory()
                onClose?.()
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-full text-xs text-[#c4c7c5] hover:text-white hover:bg-[#282a2c] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <Brain className="h-3.5 w-3.5 text-[#9b72cf] group-hover:scale-110 transition-transform" />
                <span>AI Memory & Training</span>
              </div>
              {memoriesCount > 0 && (
                <span className="text-[10px] bg-[#9b72cf]/20 text-[#cbb2fe] px-2 py-0.5 rounded-full font-mono font-medium">
                  {memoriesCount}
                </span>
              )}
            </button>
          )}

          {onOpenReminders && (
            <button
              type="button"
              onClick={() => {
                onOpenReminders()
                onClose?.()
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-full text-xs text-[#c4c7c5] hover:text-white hover:bg-[#282a2c] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <Bell className="h-3.5 w-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Reminders & Alerts</span>
              </div>
              {pendingRemindersCount > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-medium">
                  {pendingRemindersCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs text-[#c4c7c5] hover:text-white hover:bg-[#282a2c] transition-colors cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5 text-[#8e918f]" />
            <span>Settings</span>
          </button>

          {/* PWA Install App Button */}
          {isInstallable ? (
            <button
              type="button"
              onClick={onInstallApp}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs text-[#c4c7c5] hover:text-white hover:bg-[#282a2c] transition-colors cursor-pointer group"
            >
              <DownloadIcon className="h-3.5 w-3.5 text-[#8ab4f8] group-hover:scale-110 transition-transform" />
              <span>Install App</span>
              <span className="ml-auto text-[9px] bg-[#8ab4f8]/15 text-[#8ab4f8] border border-[#8ab4f8]/30 px-1.5 py-0.5 rounded-full font-medium">PWA</span>
            </button>
          ) : !isInstalled ? (
            <button
              type="button"
              onClick={onOpenInstallGuide}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs text-[#c4c7c5] hover:text-white hover:bg-[#282a2c] transition-colors cursor-pointer group"
            >
              <DownloadIcon className="h-3.5 w-3.5 text-[#8ab4f8] group-hover:scale-110 transition-transform" />
              <span>Install App</span>
              <span className="ml-auto text-[9px] bg-white/10 text-[#c4c7c5] border border-white/15 px-1.5 py-0.5 rounded-full font-medium">
                {isIosPwa ? 'iOS' : 'Info'}
              </span>
            </button>
          ) : null}

          {/* iOS Add to Home Screen hint */}
          {isIosPwa && !isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={onOpenInstallGuide}
              className="w-full text-left px-3.5 text-[10px] text-[#8e918f] hover:text-[#c4c7c5] transition-colors leading-relaxed cursor-pointer"
            >
              📱 Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install.
            </button>
          )}

          {/* User Profile Card */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#131314] border border-white/5">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#4285f4]/30 to-[#9b72cf]/30 border border-[#4285f4]/40 flex items-center justify-center text-xs font-bold text-[#8ab4f8] shrink-0">
                {initial}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-white truncate">{displayName}</p>
                <p className="text-[11px] text-[#8e918f] truncate" title={userEmail}>
                  {userEmail}
                </p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-full text-neutral-400 hover:text-rose-400 hover:bg-[#282a2c] transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
