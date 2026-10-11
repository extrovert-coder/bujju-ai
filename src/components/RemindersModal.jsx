import { useState, useMemo } from 'react'
import {
  Bell,
  Plus,
  Check,
  Trash2,
  Edit3,
  X,
  Clock,
  AlertCircle,
  Loader2,
  Sparkles,
  Info,
  Volume2,
} from 'lucide-react'

// Helper: Format ISO date string into friendly local time string
function formatLocalReminderTime(isoString) {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return isoString
  }
}

// Helper: Format default datetime-local value (1 hour in future in local time)
function getDefaultDueDateTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const pad = (n) => String(n).padStart(2, '0')
  const year = d.getFullYear()
  const month = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function RemindersModal({
  isOpen,
  onClose,
  reminders = [],
  onCreateReminder,
  onUpdateReminder,
  onDeleteReminder,
  isLoading = false,
  notificationPermission = 'default',
  onRequestNotificationPermission,
}) {
  const [filter, setFilter] = useState('all') // 'all' | 'upcoming' | 'completed'
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)

  // New Reminder form state
  const [newTitle, setNewTitle] = useState('')
  const [newDueAt, setNewDueAt] = useState(getDefaultDueDateTime)
  const [newNotes, setNewNotes] = useState('')
  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit form state
  const [editTitle, setEditTitle] = useState('')
  const [editDueAt, setEditDueAt] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const [currentTime] = useState(() => Date.now())

  // Filtered and sorted reminders with precalculated overdue/due soon status
  const sortedReminders = useMemo(() => {
    const list = [...reminders]
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
      .map((r) => {
        const dueTime = new Date(r.due_at).getTime()
        const isOverdue = !r.completed && dueTime < currentTime
        const isDueSoon = !r.completed && !isOverdue && dueTime - currentTime < 30 * 60 * 1000
        return { ...r, isOverdue, isDueSoon }
      })
    if (filter === 'upcoming') {
      return list.filter((r) => !r.completed)
    }
    if (filter === 'completed') {
      return list.filter((r) => r.completed)
    }
    return list
  }, [reminders, filter, currentTime])

  const pendingCount = reminders.filter((r) => !r.completed).length
  const completedCount = reminders.filter((r) => r.completed).length

  if (!isOpen) return null

  // Start editing a reminder
  const startEdit = (reminder) => {
    setEditingId(reminder.id)
    setEditTitle(reminder.title)
    setEditNotes(reminder.notes || '')
    try {
      const d = new Date(reminder.due_at)
      const pad = (n) => String(n).padStart(2, '0')
      setEditDueAt(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      )
    } catch {
      setEditDueAt(getDefaultDueDateTime())
    }
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditDueAt('')
    setEditNotes('')
  }

  // Save edited reminder
  const handleSaveEdit = async (id) => {
    if (!editTitle.trim()) return
    setIsSubmitting(true)
    try {
      await onUpdateReminder(id, {
        title: editTitle.trim(),
        notes: editNotes.trim(),
        due_at: new Date(editDueAt).toISOString(),
      })
      cancelEdit()
    } catch (err) {
      setFormError(err.message || 'Failed to update reminder.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit new reminder
  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newTitle.trim() || isSubmitting) return

    setFormError(null)
    setIsSubmitting(true)

    try {
      const parsedDate = new Date(newDueAt)
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Please select a valid scheduled time.')
      }

      await onCreateReminder({
        title: newTitle.trim(),
        notes: newNotes.trim(),
        due_at: parsedDate.toISOString(),
      })

      setNewTitle('')
      setNewNotes('')
      setNewDueAt(getDefaultDueDateTime())
      setIsCreating(false)
    } catch (err) {
      setFormError(err.message || 'Failed to create reminder.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 md:p-6 select-none animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full sm:max-w-2xl bg-[#1e1f20] border border-white/10 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden text-[#e3e3e3] z-10"
        style={{ maxHeight: 'min(90dvh, 100dvh - env(safe-area-inset-bottom))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#131314]/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white">
                <Bell className="h-5 w-5" />
              </div>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm">
                  {pendingCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-white">Reminders & Alerts</h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-medium">
                  Phase 2
                </span>
              </div>
              <p className="text-xs text-[#8e918f]">
                Schedule, track, and receive notifications for your important tasks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-[#282a2c] transition-colors cursor-pointer"
            aria-label="Close Reminders modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Browser Notification Status Bar */}
        <div className="px-6 py-2.5 bg-[#131314]/50 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#8e918f]">Browser Alerts:</span>
            {notificationPermission === 'granted' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
                <Check className="h-3 w-3" /> Enabled
              </span>
            ) : notificationPermission === 'denied' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[11px] font-medium">
                <AlertCircle className="h-3 w-3" /> Blocked in browser settings
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-medium">
                <Clock className="h-3 w-3" /> Permission not requested
              </span>
            )}
          </div>

          {notificationPermission !== 'granted' && onRequestNotificationPermission && (
            <button
              type="button"
              onClick={onRequestNotificationPermission}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#282a2c] hover:bg-[#333538] text-white border border-white/10 hover:border-neutral-500 transition-colors cursor-pointer"
            >
              <Volume2 className="h-3 w-3 text-amber-400" />
              <span>Enable Browser Notifications</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Action Row: Create Toggle & Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-[#131314] p-1 rounded-2xl border border-white/5 text-xs">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                  filter === 'all'
                    ? 'bg-[#282a2c] text-white font-medium shadow-xs'
                    : 'text-[#8e918f] hover:text-[#e3e3e3]'
                }`}
              >
                All ({reminders.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('upcoming')}
                className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                  filter === 'upcoming'
                    ? 'bg-[#282a2c] text-white font-medium shadow-xs'
                    : 'text-[#8e918f] hover:text-[#e3e3e3]'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('completed')}
                className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                  filter === 'completed'
                    ? 'bg-[#282a2c] text-white font-medium shadow-xs'
                    : 'text-[#8e918f] hover:text-[#e3e3e3]'
                }`}
              >
                Completed ({completedCount})
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsCreating(!isCreating)
                setFormError(null)
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm transition-all cursor-pointer"
            >
              {isCreating ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{isCreating ? 'Cancel' : 'New Reminder'}</span>
            </button>
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Create Reminder Form */}
          {isCreating && (
            <form
              onSubmit={handleCreate}
              className="p-4 rounded-2xl bg-[#131314] border border-white/10 space-y-3 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Add New Reminder
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8e918f] mb-1">
                  Reminder Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Follow up on project proposal or deploy updates"
                  className="w-full px-3 py-2 rounded-xl bg-[#1e1f20] border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#8e918f] mb-1">
                    Scheduled Date & Time (Local Time) *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newDueAt}
                    onChange={(e) => setNewDueAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#1e1f20] border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#8e918f] mb-1">
                    Notes or Context (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={2000}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Include meeting link or metrics summary"
                    className="w-full px-3 py-2 rounded-xl bg-[#1e1f20] border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-[#8e918f] hover:text-white hover:bg-[#282a2c] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>Save Reminder</span>
                </button>
              </div>
            </form>
          )}

          {/* Reminders List */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#8e918f]">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              <span className="text-xs">Loading reminders...</span>
            </div>
          ) : sortedReminders.length === 0 ? (
            <div className="py-12 px-4 rounded-3xl bg-[#131314]/50 border border-white/5 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-2xl bg-[#1e1f20] border border-white/5 flex items-center justify-center text-[#8e918f] mb-3">
                <Bell className="h-6 w-6 opacity-40" />
              </div>
              <p className="text-sm font-medium text-white mb-1">No reminders found</p>
              <p className="text-xs text-[#8e918f] max-w-sm mb-4">
                {filter === 'completed'
                  ? 'You have not marked any reminders as completed yet.'
                  : filter === 'upcoming'
                  ? 'You are all caught up! No pending reminders scheduled.'
                  : 'Create your first reminder to have Bujju AI keep track of your schedule.'}
              </p>
              {filter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="px-3 py-1.5 rounded-full text-xs bg-[#282a2c] text-white hover:bg-[#333538] transition-colors cursor-pointer"
                >
                  View All Reminders
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Reminder</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedReminders.map((reminder) => {
                const isEditing = editingId === reminder.id
                const isOverdue = reminder.isOverdue
                const isDueSoon = reminder.isDueSoon

                if (isEditing) {
                  return (
                    <div
                      key={reminder.id}
                      className="p-3.5 rounded-2xl bg-[#131314] border border-amber-500/40 space-y-2.5 animate-fade-in"
                    >
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-[#1e1f20] border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
                        placeholder="Reminder title"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="datetime-local"
                          value={editDueAt}
                          onChange={(e) => setEditDueAt(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl bg-[#1e1f20] border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Notes or context"
                          className="w-full px-3 py-1.5 rounded-xl bg-[#1e1f20] border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-2.5 py-1 rounded-lg text-xs text-neutral-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(reminder.id)}
                          disabled={!editTitle.trim() || isSubmitting}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={reminder.id}
                    className={`group flex items-start justify-between gap-3 p-3.5 rounded-2xl border transition-all duration-150 ${
                      reminder.completed
                        ? 'bg-[#131314]/40 border-white/5 opacity-70 hover:opacity-100'
                        : isOverdue
                        ? 'bg-rose-950/20 border-rose-500/30'
                        : isDueSoon
                        ? 'bg-amber-950/20 border-amber-500/30'
                        : 'bg-[#131314] border-white/5 hover:border-neutral-700/60'
                    }`}
                  >
                    {/* Completion Checkbox */}
                    <button
                      type="button"
                      onClick={() => onUpdateReminder(reminder.id, { completed: !reminder.completed })}
                      className={`mt-0.5 h-5 w-5 rounded-lg border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        reminder.completed
                          ? 'bg-emerald-500 border-emerald-500 text-black'
                          : 'border-neutral-600 hover:border-emerald-400 text-transparent hover:text-emerald-400/50'
                      }`}
                      title={reminder.completed ? 'Mark as pending' : 'Mark as completed'}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </button>

                    {/* Reminder Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-medium truncate ${
                            reminder.completed
                              ? 'line-through text-neutral-400'
                              : 'text-white'
                          }`}
                        >
                          {reminder.title}
                        </span>

                        {/* Status Badge */}
                        {reminder.completed ? (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
                            Completed
                          </span>
                        ) : isOverdue ? (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-medium animate-pulse">
                            Overdue
                          </span>
                        ) : isDueSoon ? (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-medium">
                            Due Soon
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-medium">
                            Upcoming
                          </span>
                        )}
                      </div>

                      {/* Scheduled Time */}
                      <div className="flex items-center gap-1.5 text-[11px] text-[#8e918f]">
                        <Clock className="h-3 w-3 text-neutral-500" />
                        <span>{formatLocalReminderTime(reminder.due_at)}</span>
                      </div>

                      {/* Optional Notes */}
                      {reminder.notes && (
                        <p className="text-[11px] text-[#c4c7c5] line-clamp-2 pt-0.5 bg-[#1e1f20]/50 p-1.5 rounded-lg border border-white/5">
                          {reminder.notes}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => startEdit(reminder)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#282a2c] transition-colors cursor-pointer"
                        title="Edit reminder"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteReminder(reminder.id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-[#282a2c] transition-colors cursor-pointer"
                        title="Delete reminder"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Delivery Transparency Callout */}
          <div className="p-3 rounded-2xl bg-[#131314]/60 border border-white/5 flex items-start gap-2.5 text-[11px] text-[#8e918f] leading-relaxed">
            <Info className="h-4 w-4 shrink-0 text-amber-400/80 mt-0.5" />
            <p>
              <strong className="text-neutral-300">Delivery Notice:</strong> Due reminders will trigger browser desktop notifications and in-app alerts while Bujju AI is open in your browser tab. Standard web applications cannot deliver notifications when your browser is completely closed without dedicated background push services.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/5 bg-[#131314]/80 flex items-center justify-between text-xs text-[#8e918f]">
          <span>
            {pendingCount} pending &bull; {completedCount} completed
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-[#282a2c] hover:bg-[#333538] text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
