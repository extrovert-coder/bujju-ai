import { useState } from 'react'
import {
  Brain,
  Sparkles,
  X,
  Trash2,
  Plus,
  Check,
  Lightbulb,
  ShieldCheck,
  Loader2,
} from 'lucide-react'

const CATEGORY_COLORS = {
  preference: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  project: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  instruction: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  correction: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  fact: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
}

export default function MemoryModal({
  isOpen,
  onClose,
  memories = [],
  onTeachMemory,
  onDeleteMemory,
  onClearMemories,
  isLoading = false,
}) {
  const [newFact, setNewFact] = useState('')
  const [category, setCategory] = useState('preference')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState(null)
  const [filter, setFilter] = useState('all')

  if (!isOpen) return null

  const handleTeach = async (e) => {
    e.preventDefault()
    if (!newFact.trim() || isSubmitting) return

    setIsSubmitting(true)
    setFeedbackMsg(null)
    try {
      await onTeachMemory(newFact.trim(), category)
      setNewFact('')
      setFeedbackMsg('Bujju AI has learned this knowledge!')
      setTimeout(() => setFeedbackMsg(null), 3000)
    } catch {
      setFeedbackMsg('Failed to teach memory. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredMemories =
    filter === 'all'
      ? memories
      : memories.filter((m) => (m.category || 'fact').toLowerCase() === filter.toLowerCase())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 select-none animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#1e1f20] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[#e3e3e3] z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#131314]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#4285f4] via-[#9b72cf] to-[#d96570] flex items-center justify-center shadow-lg shadow-indigo-500/25 text-white">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-white">
                  Continuous Self-Training & Memory
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
                  Active
                </span>
              </div>
              <p className="text-xs text-[#8e918f]">
                Bujju AI learns from your conversations and applies this knowledge to all answers.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-[#282a2c] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Autonomous Learning Status Banner */}
          <div className="p-4 rounded-2xl bg-[#131314] border border-white/5 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#8ab4f8]" />
              <span className="text-xs font-semibold text-white">
                How Bujju AI Trains Itself
              </span>
            </div>
            <p className="text-xs text-[#c4c7c5] leading-relaxed">
              Whenever you mention your coding preferences, project stack, rules, or correct Bujju AI during a chat,
              the AI extracts and remembers those facts automatically. You can also manually teach it custom instructions below.
            </p>
            <div className="flex items-center gap-4 pt-1 text-[11px] text-[#8e918f]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Private to your account
              </span>
              <span className="flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5 text-amber-400" /> Injected dynamically in real time
              </span>
            </div>
          </div>

          {/* Teach Bujju AI Directly Form */}
          <form onSubmit={handleTeach} className="p-4 rounded-2xl bg-[#282a2c]/60 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Teach Bujju AI Something New</span>
              {feedbackMsg && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 animate-fade-in font-medium">
                  <Check className="h-3.5 w-3.5" /> {feedbackMsg}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                placeholder="e.g. Always write clean TypeScript with Tailwind CSS..."
                className="flex-1 bg-[#131314] border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-[#8e918f] outline-none focus:border-[#4285f4]"
              />

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-[#131314] border border-white/10 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none cursor-pointer focus:border-[#4285f4]"
              >
                <option value="preference">Preference</option>
                <option value="project">Project</option>
                <option value="instruction">Instruction</option>
                <option value="correction">Correction</option>
                <option value="fact">Fact</option>
              </select>

              <button
                type="submit"
                disabled={!newFact.trim() || isSubmitting}
                className="px-4 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>Teach AI</span>
              </button>
            </div>
          </form>

          {/* Filter Pills */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {['all', 'preference', 'project', 'instruction', 'correction', 'fact'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(cat)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer capitalize ${
                    filter === cat
                      ? 'bg-white text-black shadow-xs'
                      : 'bg-[#131314] text-[#8e918f] hover:text-white hover:bg-[#282a2c]'
                  }`}
                >
                  {cat} {cat === 'all' ? `(${memories.length})` : ''}
                </button>
              ))}
            </div>

            {memories.length > 0 && (
              <button
                type="button"
                onClick={onClearMemories}
                className="text-[11px] text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {/* Learned Memories List */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="py-10 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-[#4285f4]" />
                <span>Loading learned knowledge...</span>
              </div>
            ) : filteredMemories.length === 0 ? (
              <div className="py-12 px-4 rounded-2xl bg-[#131314]/50 border border-white/5 text-center space-y-2">
                <Brain className="h-8 w-8 text-neutral-600 mx-auto" />
                <p className="text-sm font-medium text-neutral-300">
                  {filter === 'all'
                    ? 'No memories learned yet'
                    : `No ${filter} memories found`}
                </p>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Chat normally with Bujju AI or use the box above to teach it your preferences, tech stack, and guidelines.
                </p>
              </div>
            ) : (
              filteredMemories.map((mem) => {
                const catClass =
                  CATEGORY_COLORS[mem.category?.toLowerCase()] ||
                  'bg-neutral-800 text-neutral-300 border-neutral-700'

                return (
                  <div
                    key={mem.id}
                    className="group flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-[#131314] hover:bg-[#282a2c] border border-white/5 transition-all"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider ${catClass}`}
                        >
                          {mem.category || 'fact'}
                        </span>
                        {mem.updated_at && (
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {new Date(mem.updated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
                        {mem.fact}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteMemory(mem.id)}
                      className="p-1.5 rounded-full text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer"
                      title="Forget this memory"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/5 bg-[#131314]/90 flex items-center justify-between text-xs text-[#8e918f]">
          <span>{memories.length} learned items active in Bujju AI</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-[#282a2c] hover:bg-[#333538] text-white transition-colors cursor-pointer text-xs font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
