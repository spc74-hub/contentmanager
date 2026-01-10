import { useState, useMemo, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  useAreas,
  useTopics,
  useTags,
  useTagGroups,
  useTagsByGroup,
  useSearchTags,
  useTaxonomyVideosInfinite,
  useTaxonomyVideosByTopic,
  useTaxonomyVideosByTagGroup,
  useTaxonomyVideosByTag,
  useTaxonomyVideosByMultipleTags,
  useBulkArchive,
  useBulkValidate,
  useBulkAssignArea,
  useBulkAssignTopic,
  useCreateArea,
  useUpdateArea,
  useDeleteArea,
  useCreateTopic,
  useUpdateTopic,
  useDeleteTopic,
  useArchiveVideo,
  useValidateVideo,
  useVideo,
  useFilteredCounts,
  useAnalyzeSelection,
  type Tag,
  type TagGroup,
  type TagWithGroup,
  type TaxonomyVideoPreviewWithTags,
  type VideoSortField,
  type VideoSortOrder,
  type SourceFilter,
  type FilteredCounts,
} from '@/hooks'
import { VIDEO_SOURCES } from '@/types'
import { VideoDetailModal } from '@/components/VideoDetailModal'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Hash,
  Layers,
  Search,
  X,
  Video,
  ExternalLink,
  User,
  Plus,
  Edit2,
  Trash2,
  Archive,
  CheckCircle,
  GripVertical,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  SortAsc,
  SortDesc,
  Clock,
  ThumbsUp,
  Calendar,
  Eye,
  Filter,
  Sparkles,
  Loader2,
} from 'lucide-react'
import type { Area, TopicWithArea } from '@/types'

// ============================================================================
// TYPES
// ============================================================================

type SelectedItem =
  | { type: 'area'; data: Area }
  | { type: 'topic'; data: TopicWithArea }
  | { type: 'tag'; data: Tag | TagWithGroup }
  | { type: 'tagGroup'; data: TagGroup }
  | { type: 'multipleTags'; data: { ids: number[]; searchTerm: string } }
  | null

type StatusFilter = 'all' | 'pending' | 'validated' | 'archived'
type TagGroupSortField = 'video_count' | 'name'

// Helper function to format duration
function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Helper function to format numbers (likes, views)
function formatNumber(count: number | null): string {
  if (!count) return ''
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

// Helper function to format date (short format)
function formatDateShort(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ============================================================================
// TREE NODE COMPONENT
// ============================================================================

interface TreeNodeProps {
  area: Area
  topics: TopicWithArea[]
  selectedItem: SelectedItem
  onSelect: (item: SelectedItem) => void
  expandedAreas: Set<number>
  toggleArea: (areaId: number) => void
  onEditArea: (area: Area) => void
  onDeleteArea: (area: Area) => void
  onAddTopic: (areaId: number) => void
  onEditTopic: (topic: TopicWithArea) => void
  onDeleteTopic: (topic: TopicWithArea) => void
  onDropVideos?: (areaId: number, topicId?: number) => void
  isDragOver?: string | null
  setIsDragOver?: (id: string | null) => void
  filteredCounts?: FilteredCounts | null
}

function TreeNode({
  area,
  topics,
  selectedItem,
  onSelect,
  expandedAreas,
  toggleArea,
  onEditArea,
  onDeleteArea,
  onAddTopic,
  onEditTopic,
  onDeleteTopic,
  onDropVideos,
  isDragOver,
  setIsDragOver,
  filteredCounts,
}: TreeNodeProps) {
  const isExpanded = expandedAreas.has(area.id)
  const areaTopics = topics.filter((t) => t.area_id === area.id)
  const isSelected = selectedItem?.type === 'area' && selectedItem.data.id === area.id
  const areaDropId = `area-${area.id}`
  const isAreaDragOver = isDragOver === areaDropId

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver?.(areaDropId)
  }

  const handleDragLeave = () => {
    setIsDragOver?.(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver?.(null)
    onDropVideos?.(area.id)
  }

  return (
    <div className="select-none">
      {/* Area node */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
          isSelected
            ? 'bg-blue-100 text-blue-800'
            : isAreaDragOver
            ? 'bg-blue-50 ring-2 ring-blue-400'
            : 'hover:bg-gray-100'
        }`}
        onClick={() => onSelect({ type: 'area', data: area })}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          className="p-0.5 hover:bg-gray-200 rounded"
          onClick={(e) => {
            e.stopPropagation()
            toggleArea(area.id)
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>
        {isExpanded ? (
          <FolderOpen className="w-5 h-5" style={{ color: area.color }} />
        ) : (
          <Folder className="w-5 h-5" style={{ color: area.color }} />
        )}
        <span className="text-lg mr-1">{area.icon}</span>
        <span className="font-medium text-sm flex-1">{area.name_es}</span>
        <span className={`text-xs ${filteredCounts ? 'text-blue-500 font-medium' : 'text-gray-400'}`}>
          {filteredCounts ? (filteredCounts.area_counts[area.id] || 0) : area.video_count}
        </span>

        {/* Actions */}
        <div className="hidden group-hover:flex items-center gap-1 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddTopic(area.id)
            }}
            className="p-1 hover:bg-gray-200 rounded"
            title="Añadir topic"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEditArea(area)
            }}
            className="p-1 hover:bg-gray-200 rounded"
            title="Editar área"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeleteArea(area)
            }}
            className="p-1 hover:bg-red-100 text-red-600 rounded"
            title="Eliminar área"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Topics */}
      {isExpanded && (
        <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
          {areaTopics.map((topic) => {
            const isTopicSelected = selectedItem?.type === 'topic' && selectedItem.data.id === topic.id
            const topicDropId = `topic-${topic.id}`
            const isTopicDragOver = isDragOver === topicDropId

            return (
              <div
                key={topic.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors group ${
                  isTopicSelected
                    ? 'bg-green-100 text-green-800'
                    : isTopicDragOver
                    ? 'bg-green-50 ring-2 ring-green-400'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => onSelect({ type: 'topic', data: topic })}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragOver?.(topicDropId)
                }}
                onDragLeave={() => setIsDragOver?.(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragOver?.(null)
                  onDropVideos?.(area.id, topic.id)
                }}
              >
                <Layers className="w-4 h-4 text-gray-400" />
                <span className="text-sm flex-1">{topic.name_es}</span>
                <span className="text-xs text-gray-400">{topic.video_count}</span>

                {/* Topic actions */}
                <div className="hidden group-hover:flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditTopic(topic)
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Editar topic"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteTopic(topic)
                    }}
                    className="p-1 hover:bg-red-100 text-red-600 rounded"
                    title="Eliminar topic"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
          {areaTopics.length === 0 && (
            <div className="px-3 py-1.5 text-xs text-gray-400 italic">Sin topics definidos</div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// BULK ACTION TOOLBAR
// ============================================================================

interface BulkToolbarProps {
  selectedCount: number
  onArchive: () => void
  onValidate: () => void
  onAssignArea: (areaId: number) => void
  onClearSelection: () => void
  onAnalyze: (mode: 'light' | 'extended') => void
  areas: Area[]
  isLoading: boolean
  isAnalyzing: boolean
}

function BulkToolbar({
  selectedCount,
  onArchive,
  onValidate,
  onAssignArea,
  onClearSelection,
  onAnalyze,
  areas,
  isLoading,
  isAnalyzing,
}: BulkToolbarProps) {
  const [showAreaDropdown, setShowAreaDropdown] = useState(false)
  const [showAnalyzeDropdown, setShowAnalyzeDropdown] = useState(false)

  if (selectedCount === 0) return null

  return (
    <div className="sticky top-0 z-10 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-4 shadow-lg">
      <span className="font-medium">{selectedCount} videos seleccionados</span>

      <div className="flex items-center gap-2 ml-auto">
        {/* Analyze button */}
        <div className="relative">
          <button
            onClick={() => setShowAnalyzeDropdown(!showAnalyzeDropdown)}
            disabled={isLoading || isAnalyzing}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 rounded text-sm disabled:opacity-50"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Analizar
            <ChevronDown className="w-3 h-3" />
          </button>

          {showAnalyzeDropdown && (
            <div className="absolute top-full mt-1 left-0 bg-white text-gray-900 rounded-lg shadow-xl border border-gray-200 py-1 min-w-[220px]">
              <button
                onClick={() => {
                  onAnalyze('light')
                  setShowAnalyzeDropdown(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-100"
              >
                <div className="font-medium">Análisis rápido</div>
                <div className="text-xs text-gray-500">Solo títulos (5-10s)</div>
              </button>
              <button
                onClick={() => {
                  onAnalyze('extended')
                  setShowAnalyzeDropdown(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-100"
              >
                <div className="font-medium">Análisis extendido</div>
                <div className="text-xs text-gray-500">Títulos + resúmenes (30-60s)</div>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onValidate}
          disabled={isLoading}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded text-sm disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          Validar
        </button>

        <button
          onClick={onArchive}
          disabled={isLoading}
          className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded text-sm disabled:opacity-50"
        >
          <Archive className="w-4 h-4" />
          Archivar
        </button>

        <div className="relative">
          <button
            onClick={() => setShowAreaDropdown(!showAreaDropdown)}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 rounded text-sm disabled:opacity-50"
          >
            <Folder className="w-4 h-4" />
            Asignar Área
            <ChevronDown className="w-3 h-3" />
          </button>

          {showAreaDropdown && (
            <div className="absolute top-full mt-1 right-0 bg-white text-gray-900 rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px] max-h-[300px] overflow-y-auto">
              {areas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => {
                    onAssignArea(area.id)
                    setShowAreaDropdown(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2"
                >
                  <span>{area.icon}</span>
                  <span>{area.name_es}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onClearSelection}
          className="p-1.5 hover:bg-blue-500 rounded"
          title="Limpiar selección"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// VIDEO LIST ITEM (draggable, selectable)
// ============================================================================

interface VideoListItemProps {
  video: TaxonomyVideoPreviewWithTags
  isSelected: boolean
  onToggleSelect: () => void
  onArchive: () => void
  onValidate: () => void
  onDragStart: () => void
  onOpenDetail: () => void
  sortBy: VideoSortField
}

function VideoListItem({
  video,
  isSelected,
  onToggleSelect,
  onArchive,
  onValidate,
  onDragStart,
  onOpenDetail,
  sortBy,
}: VideoListItemProps) {
  // Determine which date to show based on sort field
  const displayDate = sortBy === 'upload_date' ? video.upload_date : video.created_at
  const dateLabel = sortBy === 'upload_date' ? 'Pub' : 'Add'
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      className={`flex items-center gap-3 p-2 rounded-lg transition-colors group cursor-grab active:cursor-grabbing ${
        isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'
      }`}
    >
      {/* Drag handle */}
      <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Thumbnail */}
      <button onClick={onOpenDetail} className="flex-shrink-0">
        {video.thumbnail ? (
          <img src={video.thumbnail} alt="" className="w-16 h-10 object-cover rounded bg-gray-100" />
        ) : (
          <div className="w-16 h-10 bg-gray-200 rounded flex items-center justify-center">
            <Video className="w-4 h-4 text-gray-400" />
          </div>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenDetail}
            className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-1 text-left"
            title={video.title}
          >
            {video.title}
          </button>
          {/* Status indicators */}
          {video.is_validated && <span title="Validado"><CheckCircle className="w-3.5 h-3.5 text-green-500" /></span>}
          {video.is_archived && <span title="Archivado"><Archive className="w-3.5 h-3.5 text-orange-500" /></span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <User className="w-3 h-3" />
          <span className="truncate max-w-[100px]">{video.author}</span>

          {/* Date (based on sort) */}
          {displayDate && (
            <>
              <span className="text-gray-300">|</span>
              <Calendar className="w-3 h-3" />
              <span title={dateLabel === 'Pub' ? 'Fecha publicación' : 'Fecha añadido'}>
                {dateLabel}: {formatDateShort(displayDate)}
              </span>
            </>
          )}

          {/* Duration */}
          {video.duration && (
            <>
              <span className="text-gray-300">|</span>
              <Clock className="w-3 h-3" />
              <span>{formatDuration(video.duration)}</span>
            </>
          )}

          {/* Views */}
          {video.view_count > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <Eye className="w-3 h-3" />
              <span>{formatNumber(video.view_count)}</span>
            </>
          )}

          {/* Likes */}
          {video.like_count > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <ThumbsUp className="w-3 h-3" />
              <span>{formatNumber(video.like_count)}</span>
            </>
          )}

          {/* Source/Type */}
          <span className="text-gray-300">|</span>
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
            video.source === 'tiktok'
              ? 'bg-pink-100 text-pink-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {video.source === 'tiktok' ? 'TikTok' : 'YT'}
          </span>

          {/* Tags */}
          {video.tags && video.tags.length > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <div className="flex gap-1 overflow-hidden">
                {video.tags.slice(0, 2).map((tag) => (
                  <span key={tag.id} className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 truncate max-w-[70px]">
                    #{tag.name}
                  </span>
                ))}
                {video.tags.length > 2 && (
                  <span className="text-gray-400">+{video.tags.length - 2}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!video.is_validated && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onValidate()
            }}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
            title="Validar"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
        {!video.is_archived && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onArchive()
            }}
            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
            title="Archivar"
          >
            <Archive className="w-4 h-4" />
          </button>
        )}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          title="Abrir video"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}

// ============================================================================
// CRUD MODALS
// ============================================================================

interface AreaModalProps {
  isOpen: boolean
  onClose: () => void
  area?: Area | null
  onSave: (data: { name: string; name_es?: string; icon?: string; color?: string }) => void
  isLoading: boolean
}

function AreaModal({ isOpen, onClose, area, onSave, isLoading }: AreaModalProps) {
  const [nameEn, setNameEn] = useState(area?.name_en || '')
  const [nameEs, setNameEs] = useState(area?.name_es || '')
  const [icon, setIcon] = useState(area?.icon || '')
  const [color, setColor] = useState(area?.color || '#3B82F6')

  useEffect(() => {
    if (area) {
      setNameEn(area.name_en || '')
      setNameEs(area.name_es || '')
      setIcon(area.icon || '')
      setColor(area.color || '#3B82F6')
    } else {
      setNameEn('')
      setNameEs('')
      setIcon('')
      setColor('#3B82F6')
    }
  }, [area])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">{area ? 'Editar Área' : 'Nueva Área'}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre (EN)</label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Health & Fitness"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre (ES)</label>
            <input
              type="text"
              value={nameEs}
              onChange={(e) => setNameEs(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Salud y Fitness"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="🏋️"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 border rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={() => onSave({ name: nameEn, name_es: nameEs, icon, color })}
            disabled={!nameEn || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface TopicModalProps {
  isOpen: boolean
  onClose: () => void
  topic?: TopicWithArea | null
  areaId?: number
  areas: Area[]
  onSave: (data: { area_id: number; name: string; name_es?: string; description?: string }) => void
  isLoading: boolean
}

function TopicModal({ isOpen, onClose, topic, areaId, areas, onSave, isLoading }: TopicModalProps) {
  const [selectedAreaId, setSelectedAreaId] = useState(topic?.area_id || areaId || areas[0]?.id || 0)
  const [nameEn, setNameEn] = useState(topic?.name_en || '')
  const [nameEs, setNameEs] = useState(topic?.name_es || '')
  const [description, setDescription] = useState(topic?.description || '')

  useEffect(() => {
    if (topic) {
      setSelectedAreaId(topic.area_id)
      setNameEn(topic.name_en || '')
      setNameEs(topic.name_es || '')
      setDescription(topic.description || '')
    } else {
      setSelectedAreaId(areaId || areas[0]?.id || 0)
      setNameEn('')
      setNameEs('')
      setDescription('')
    }
  }, [topic, areaId, areas])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">{topic ? 'Editar Topic' : 'Nuevo Topic'}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
            <select
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.icon} {area.name_es}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre (EN)</label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Nutrition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre (ES)</label>
            <input
              type="text"
              value={nameEs}
              onChange={(e) => setNameEs(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Nutrición"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Descripción opcional..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={() => onSave({ area_id: selectedAreaId, name: nameEn, name_es: nameEs, description })}
            disabled={!nameEn || !selectedAreaId || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  isLoading: boolean
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, title, message, isLoading }: DeleteConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-red-600 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Taxonomy() {
  const { data: areas, isLoading: loadingAreas } = useAreas()
  const { data: topics, isLoading: loadingTopics } = useTopics()
  const { isLoading: loadingTags } = useTags()
  const { data: tagGroups } = useTagGroups()

  // State
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set())
  const [expandedTagGroups, setExpandedTagGroups] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [tagSearchTerm, setTagSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<number>>(new Set())
  const [isDragOver, setIsDragOver] = useState<string | null>(null)
  const [draggedVideoIds, setDraggedVideoIds] = useState<number[]>([])

  // Sorting state
  const [sortBy, setSortBy] = useState<VideoSortField>('created_at')
  const [sortOrder, setSortOrder] = useState<VideoSortOrder>('desc')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>({ mode: 'include', sources: [] })
  const [sourceFilterOpen, setSourceFilterOpen] = useState(false)
  const [tagGroupSort, setTagGroupSort] = useState<TagGroupSortField>('video_count')

  // Sidebar visibility state
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)

  // Video detail modal state
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null)

  // Tag search
  const { data: searchedTags, isLoading: loadingTagSearch } = useSearchTags(tagSearchTerm)

  // Video detail for modal
  const { data: selectedVideoData } = useVideo(selectedVideoId || 0)

  // Modal state
  const [areaModal, setAreaModal] = useState<{ isOpen: boolean; area?: Area | null }>({ isOpen: false })
  const [topicModal, setTopicModal] = useState<{ isOpen: boolean; topic?: TopicWithArea | null; areaId?: number }>({
    isOpen: false,
  })
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    type: 'area' | 'topic'
    item?: Area | TopicWithArea | null
  }>({ isOpen: false, type: 'area' })

  // Infinite query based on selection
  const videoFilters = useMemo(() => {
    const baseFilters = {
      status: statusFilter,
      sortBy,
      sortOrder,
      sourceFilter,
      search: searchTerm || undefined
    }
    if (selectedItem?.type === 'area') {
      return { ...baseFilters, areaId: selectedItem.data.id }
    }
    return baseFilters
  }, [selectedItem, statusFilter, sortBy, sortOrder, sourceFilter, searchTerm])

  const {
    data: videosData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingVideos,
    refetch: refetchVideos,
  } = useTaxonomyVideosInfinite(
    selectedItem?.type === 'area' || !selectedItem ? videoFilters : { status: 'all' }
  )

  const {
    data: topicVideosData,
    fetchNextPage: fetchNextTopicPage,
    hasNextPage: hasNextTopicPage,
    isFetchingNextPage: isFetchingNextTopicPage,
  } = useTaxonomyVideosByTopic(
    selectedItem?.type === 'topic' ? selectedItem.data.id : null,
    statusFilter,
    sortBy,
    sortOrder,
    sourceFilter
  )

  const {
    data: tagGroupVideosData,
    fetchNextPage: fetchNextTagGroupPage,
    hasNextPage: hasNextTagGroupPage,
    isFetchingNextPage: isFetchingNextTagGroupPage,
  } = useTaxonomyVideosByTagGroup(
    selectedItem?.type === 'tagGroup' ? selectedItem.data.id : null,
    statusFilter,
    sortBy,
    sortOrder,
    sourceFilter
  )

  const {
    data: tagVideosData,
    fetchNextPage: fetchNextTagPage,
    hasNextPage: hasNextTagPage,
    isFetchingNextPage: isFetchingNextTagPage,
  } = useTaxonomyVideosByTag(
    selectedItem?.type === 'tag' ? selectedItem.data.id : null,
    statusFilter,
    sortBy,
    sortOrder,
    sourceFilter
  )

  const {
    data: multiTagVideosData,
    fetchNextPage: fetchNextMultiTagPage,
    hasNextPage: hasNextMultiTagPage,
    isFetchingNextPage: isFetchingNextMultiTagPage,
  } = useTaxonomyVideosByMultipleTags(
    selectedItem?.type === 'multipleTags' ? selectedItem.data.ids : [],
    statusFilter,
    sortBy,
    sortOrder,
    sourceFilter
  )

  // Flatten video pages
  const videos = useMemo(() => {
    if (selectedItem?.type === 'topic' && topicVideosData) {
      return topicVideosData.pages.flatMap((p) => p.videos)
    }
    if (selectedItem?.type === 'tagGroup' && tagGroupVideosData) {
      return tagGroupVideosData.pages.flatMap((p) => p.videos)
    }
    if (selectedItem?.type === 'tag' && tagVideosData) {
      return tagVideosData.pages.flatMap((p) => p.videos)
    }
    if (selectedItem?.type === 'multipleTags' && multiTagVideosData) {
      return multiTagVideosData.pages.flatMap((p) => p.videos)
    }
    if (videosData) {
      return videosData.pages.flatMap((p) => p.videos)
    }
    return []
  }, [videosData, topicVideosData, tagGroupVideosData, tagVideosData, multiTagVideosData, selectedItem])

  const totalCount = useMemo(() => {
    if (selectedItem?.type === 'topic' && topicVideosData?.pages[0]) {
      return topicVideosData.pages[0].totalCount
    }
    if (selectedItem?.type === 'tagGroup' && tagGroupVideosData?.pages[0]) {
      return tagGroupVideosData.pages[0].totalCount
    }
    if (selectedItem?.type === 'tag' && tagVideosData?.pages[0]) {
      return tagVideosData.pages[0].totalCount
    }
    if (selectedItem?.type === 'multipleTags' && multiTagVideosData?.pages[0]) {
      return multiTagVideosData.pages[0].totalCount
    }
    if (videosData?.pages[0]) {
      return videosData.pages[0].totalCount
    }
    return 0
  }, [videosData, topicVideosData, tagGroupVideosData, tagVideosData, multiTagVideosData, selectedItem])

  // Filtered counts for dynamic sidebar updates
  const countsFilters = useMemo(() => {
    const filters: {
      status?: 'all' | 'pending' | 'validated' | 'archived'
      sources?: string[]
      exclude_sources?: string[]
      search?: string
      area_id?: number
    } = {
      status: statusFilter,
    }
    if (sourceFilter.sources.length > 0) {
      if (sourceFilter.mode === 'include') {
        filters.sources = sourceFilter.sources
      } else {
        filters.exclude_sources = sourceFilter.sources
      }
    }
    if (searchTerm) {
      filters.search = searchTerm
    }
    // Include area filter when an area is selected
    if (selectedItem?.type === 'area') {
      filters.area_id = selectedItem.data.id
    }
    return filters
  }, [statusFilter, sourceFilter, searchTerm, selectedItem])

  const hasActiveFilters = sourceFilter.sources.length > 0 || !!searchTerm || statusFilter !== 'all' || selectedItem?.type === 'area'
  const { data: filteredCounts } = useFilteredCounts(countsFilters, hasActiveFilters)

  // Sorted tag groups (use filtered counts when available)
  const sortedTagGroups = useMemo(() => {
    if (!tagGroups) return []
    return [...tagGroups].sort((a, b) => {
      if (tagGroupSort === 'name') {
        return a.name.localeCompare(b.name)
      }
      // Sort by count (use filtered counts when filters active)
      const countA = hasActiveFilters && filteredCounts
        ? (filteredCounts.tag_group_counts[a.id] || 0)
        : a.video_count
      const countB = hasActiveFilters && filteredCounts
        ? (filteredCounts.tag_group_counts[b.id] || 0)
        : b.video_count
      return countB - countA
    })
  }, [tagGroups, tagGroupSort, hasActiveFilters, filteredCounts])

  // Analysis modal state
  const [analysisModal, setAnalysisModal] = useState<{
    isOpen: boolean
    result: { analysis: string; mode: string; video_count: number; videos_with_summary: number | null; processing_time_seconds: number } | null
    loading: boolean
  }>({ isOpen: false, result: null, loading: false })

  const analyzeSelection = useAnalyzeSelection()

  // Mutations
  const bulkArchive = useBulkArchive()
  const bulkValidate = useBulkValidate()
  const bulkAssignArea = useBulkAssignArea()
  const bulkAssignTopic = useBulkAssignTopic()
  const createArea = useCreateArea()
  const updateArea = useUpdateArea()
  const deleteArea = useDeleteArea()
  const createTopic = useCreateTopic()
  const updateTopic = useUpdateTopic()
  const deleteTopic = useDeleteTopic()
  const archiveVideo = useArchiveVideo()
  const validateVideo = useValidateVideo()

  // Handlers
  const toggleArea = (areaId: number) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaId)) {
        next.delete(areaId)
      } else {
        next.add(areaId)
      }
      return next
    })
  }

  const toggleTagGroup = (groupId: number) => {
    setExpandedTagGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const expandAll = () => {
    if (areas) {
      setExpandedAreas(new Set(areas.map((a) => a.id)))
    }
  }

  const collapseAll = () => {
    setExpandedAreas(new Set())
  }

  const toggleVideoSelect = (videoId: number) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) {
        next.delete(videoId)
      } else {
        next.add(videoId)
      }
      return next
    })
  }

  const selectAllVideos = () => {
    setSelectedVideoIds(new Set(videos.map((v) => v.id)))
  }

  const clearSelection = () => {
    setSelectedVideoIds(new Set())
  }

  // Bulk actions
  const handleBulkArchive = async () => {
    const ids = Array.from(selectedVideoIds)
    await bulkArchive.mutateAsync(ids)
    clearSelection()
    refetchVideos()
  }

  const handleBulkValidate = async () => {
    const ids = Array.from(selectedVideoIds)
    await bulkValidate.mutateAsync(ids)
    clearSelection()
    refetchVideos()
  }

  const handleBulkAssignArea = async (areaId: number) => {
    const ids = Array.from(selectedVideoIds)
    await bulkAssignArea.mutateAsync({ videoIds: ids, areaId })
    clearSelection()
    refetchVideos()
  }

  const handleAnalyzeSelection = async (mode: 'light' | 'extended') => {
    const ids = Array.from(selectedVideoIds)
    if (ids.length === 0) return

    setAnalysisModal({ isOpen: true, result: null, loading: true })

    try {
      const result = await analyzeSelection.mutateAsync({ videoIds: ids, mode })
      setAnalysisModal({ isOpen: true, result, loading: false })
    } catch (error) {
      console.error('Analysis error:', error)
      setAnalysisModal({ isOpen: false, result: null, loading: false })
      alert(error instanceof Error ? error.message : 'Error al analizar selección')
    }
  }

  // Drag & drop
  const handleDragStart = (videoIds: number[]) => {
    setDraggedVideoIds(videoIds.length > 0 ? videoIds : Array.from(selectedVideoIds))
  }

  const handleDropVideos = async (areaId: number, topicId?: number) => {
    const ids = draggedVideoIds.length > 0 ? draggedVideoIds : Array.from(selectedVideoIds)
    if (ids.length === 0) return

    if (topicId) {
      await bulkAssignTopic.mutateAsync({ videoIds: ids, topicId })
    } else {
      await bulkAssignArea.mutateAsync({ videoIds: ids, areaId })
    }

    setDraggedVideoIds([])
    clearSelection()
    refetchVideos()
  }

  // CRUD handlers
  const handleSaveArea = async (data: { name: string; name_es?: string; icon?: string; color?: string }) => {
    if (areaModal.area) {
      await updateArea.mutateAsync({ id: areaModal.area.id, ...data })
    } else {
      await createArea.mutateAsync(data)
    }
    setAreaModal({ isOpen: false })
  }

  const handleSaveTopic = async (data: { area_id: number; name: string; name_es?: string; description?: string }) => {
    if (topicModal.topic) {
      await updateTopic.mutateAsync({ id: topicModal.topic.id, ...data })
    } else {
      await createTopic.mutateAsync(data)
    }
    setTopicModal({ isOpen: false })
  }

  const handleConfirmDelete = async () => {
    if (deleteModal.type === 'area' && deleteModal.item) {
      await deleteArea.mutateAsync({ id: (deleteModal.item as Area).id })
    } else if (deleteModal.type === 'topic' && deleteModal.item) {
      await deleteTopic.mutateAsync((deleteModal.item as TopicWithArea).id)
    }
    setDeleteModal({ isOpen: false, type: 'area' })
    setSelectedItem(null)
  }

  // Infinite scroll
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const handleScroll = () => {
      // Only trigger if the list is actually scrollable (content is taller than container)
      const isScrollable = list.scrollHeight > list.clientHeight
      if (!isScrollable) return

      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 200) {
        if (selectedItem?.type === 'topic' && hasNextTopicPage && !isFetchingNextTopicPage) {
          fetchNextTopicPage()
        } else if (selectedItem?.type === 'tagGroup' && hasNextTagGroupPage && !isFetchingNextTagGroupPage) {
          fetchNextTagGroupPage()
        } else if (selectedItem?.type === 'tag' && hasNextTagPage && !isFetchingNextTagPage) {
          fetchNextTagPage()
        } else if (selectedItem?.type === 'multipleTags' && hasNextMultiTagPage && !isFetchingNextMultiTagPage) {
          fetchNextMultiTagPage()
        } else if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      }
    }

    list.addEventListener('scroll', handleScroll)
    return () => list.removeEventListener('scroll', handleScroll)
  }, [
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    hasNextTopicPage,
    isFetchingNextTopicPage,
    fetchNextTopicPage,
    hasNextTagGroupPage,
    isFetchingNextTagGroupPage,
    fetchNextTagGroupPage,
    hasNextTagPage,
    isFetchingNextTagPage,
    fetchNextTagPage,
    hasNextMultiTagPage,
    isFetchingNextMultiTagPage,
    fetchNextMultiTagPage,
    selectedItem,
  ])

  const isLoading = loadingAreas || loadingTopics || loadingTags
  const isBulkLoading =
    bulkArchive.isPending || bulkValidate.isPending || bulkAssignArea.isPending || bulkAssignTopic.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Taxonomia</h1>
          <p className="text-gray-500">Gestionar y clasificar videos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAreaModal({ isOpen: true })}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nueva Área
          </button>
        </div>
      </div>

      {/* Bulk toolbar */}
      <BulkToolbar
        selectedCount={selectedVideoIds.size}
        onArchive={handleBulkArchive}
        onValidate={handleBulkValidate}
        onAssignArea={handleBulkAssignArea}
        onClearSelection={clearSelection}
        onAnalyze={handleAnalyzeSelection}
        areas={areas || []}
        isLoading={isBulkLoading}
        isAnalyzing={analysisModal.loading}
      />

      {/* Main content - 3 column layout with collapsible sidebars */}
      <div className="flex gap-4 relative">
        {/* Left Sidebar Toggle Button (when closed) */}
        {!leftSidebarOpen && (
          <button
            onClick={() => setLeftSidebarOpen(true)}
            className="fixed left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            title="Mostrar Áreas/Topics"
          >
            <PanelLeftOpen className="w-5 h-5 text-gray-600" />
          </button>
        )}

        {/* Left Sidebar - Areas/Topics */}
        <div
          className={`transition-all duration-300 ease-in-out flex-shrink-0 ${
            leftSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
          }`}
        >
          <div className="bg-white rounded-xl border border-gray-200 p-4 h-[calc(100vh-220px)] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Folder className="w-5 h-5 text-blue-600" />
                Áreas
              </h2>
              <div className="flex gap-1">
                <button onClick={expandAll} className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded">
                  +
                </button>
                <button onClick={collapseAll} className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded">
                  −
                </button>
                <button
                  onClick={() => setLeftSidebarOpen(false)}
                  className="p-1 text-gray-500 hover:bg-gray-100 rounded ml-2"
                  title="Ocultar sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1 overflow-y-auto flex-1">
              {areas
                ?.filter(
                  (a) =>
                    !searchTerm ||
                    a.name_es?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    topics?.some(
                      (t) => t.area_id === a.id && t.name_es?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                )
                .map((area) => (
                  <TreeNode
                    key={area.id}
                    area={area}
                    topics={topics || []}
                    selectedItem={selectedItem}
                    onSelect={setSelectedItem}
                    expandedAreas={expandedAreas}
                    toggleArea={toggleArea}
                    onEditArea={(a) => setAreaModal({ isOpen: true, area: a })}
                    onDeleteArea={(a) => setDeleteModal({ isOpen: true, type: 'area', item: a })}
                    onAddTopic={(areaId) => setTopicModal({ isOpen: true, areaId })}
                    onEditTopic={(t) => setTopicModal({ isOpen: true, topic: t })}
                    onDeleteTopic={(t) => setDeleteModal({ isOpen: true, type: 'topic', item: t })}
                    onDropVideos={handleDropVideos}
                    isDragOver={isDragOver}
                    setIsDragOver={setIsDragOver}
                    filteredCounts={hasActiveFilters ? filteredCounts : null}
                  />
                ))}
            </div>
          </div>
        </div>

        {/* Center - Video list */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200">
          {/* Selected item header */}
          {selectedItem && (
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
              {selectedItem.type === 'area' && (
                <>
                  <span className="text-lg">{selectedItem.data.icon}</span>
                  <span className="font-medium">{selectedItem.data.name_es}</span>
                  <span className="text-sm text-gray-500">({selectedItem.data.video_count} videos)</span>
                </>
              )}
              {selectedItem.type === 'topic' && (
                <>
                  <Layers className="w-5 h-5 text-green-600" />
                  <span className="font-medium">{selectedItem.data.name_es}</span>
                  <span className="text-sm text-gray-500">({selectedItem.data.video_count} videos)</span>
                </>
              )}
              {selectedItem.type === 'tagGroup' && (
                <>
                  <span className="text-lg">{selectedItem.data.icon}</span>
                  <span className="font-medium">{selectedItem.data.name}</span>
                  <span className="text-sm text-gray-500">({selectedItem.data.video_count} videos)</span>
                </>
              )}
              {selectedItem.type === 'tag' && (
                <>
                  <Hash className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">#{selectedItem.data.name}</span>
                  <span className="text-sm text-gray-500">({selectedItem.data.video_count} videos)</span>
                  {/* Show tag group info if available */}
                  {'tag_group' in selectedItem.data && selectedItem.data.tag_group ? (
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full flex items-center gap-1">
                      {selectedItem.data.tag_group.icon} {selectedItem.data.tag_group.name}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">
                      Sin grupo asignado
                    </span>
                  )}
                </>
              )}
              {selectedItem.type === 'multipleTags' && (
                <>
                  <Filter className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">Tags: "{selectedItem.data.searchTerm}"</span>
                  <span className="text-sm text-gray-500">({selectedItem.data.ids.length} tags)</span>
                </>
              )}
              <button
                onClick={() => setSelectedItem(null)}
                className="ml-auto p-1 hover:bg-gray-200 rounded"
                title="Limpiar selección"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}

          {/* Filter bar */}
          <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Estado:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendientes</option>
                <option value="validated">Validados</option>
                <option value="archived">Archivados</option>
              </select>
            </div>

            {/* Source filter */}
            <div className="relative">
              <button
                onClick={() => setSourceFilterOpen(!sourceFilterOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm transition-colors ${
                  sourceFilter.sources.length > 0
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Fuente</span>
                {sourceFilter.sources.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {sourceFilter.mode === 'exclude' ? '-' : ''}{sourceFilter.sources.length}
                  </span>
                )}
              </button>

              {sourceFilterOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-50">
                  <div className="p-2 border-b">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSourceFilter(prev => ({ ...prev, mode: 'include' }))}
                        className={`flex-1 px-2 py-1 text-xs rounded ${
                          sourceFilter.mode === 'include'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Incluir
                      </button>
                      <button
                        onClick={() => setSourceFilter(prev => ({ ...prev, mode: 'exclude' }))}
                        className={`flex-1 px-2 py-1 text-xs rounded ${
                          sourceFilter.mode === 'exclude'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                  <div className="p-2 max-h-48 overflow-y-auto">
                    {Object.entries(VIDEO_SOURCES).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={sourceFilter.sources.includes(key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSourceFilter(prev => ({
                                ...prev,
                                sources: [...prev.sources, key]
                              }))
                            } else {
                              setSourceFilter(prev => ({
                                ...prev,
                                sources: prev.sources.filter(s => s !== key)
                              }))
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t flex justify-between">
                    <button
                      onClick={() => setSourceFilter({ mode: 'include', sources: [] })}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Limpiar
                    </button>
                    <button
                      onClick={() => setSourceFilterOpen(false)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as VideoSortField)}
                className="px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="created_at">Fecha añadido</option>
                <option value="upload_date">Fecha publicación</option>
                <option value="like_count">Likes</option>
                <option value="view_count">Vistas</option>
                <option value="title">Título</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 border rounded-lg hover:bg-gray-50 transition-colors"
                title={sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
              >
                {sortOrder === 'asc' ? (
                  <SortAsc className="w-4 h-4 text-gray-600" />
                ) : (
                  <SortDesc className="w-4 h-4 text-gray-600" />
                )}
              </button>
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar videos..."
                className="w-full pl-10 pr-4 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-500">{totalCount} videos</span>
              {videos.length > 0 && (
                <button onClick={selectAllVideos} className="text-sm text-blue-600 hover:text-blue-700">
                  Seleccionar todos
                </button>
              )}
              <button onClick={() => refetchVideos()} className="p-1.5 hover:bg-gray-100 rounded" title="Refrescar">
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Video list with infinite scroll */}
          <div ref={listRef} className="overflow-y-auto max-h-[calc(100vh-300px)] p-4 space-y-1">
            {loadingVideos ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay videos que coincidan con los filtros</p>
              </div>
            ) : (
              <>
                {videos.map((video) => (
                  <VideoListItem
                    key={video.id}
                    video={video}
                    isSelected={selectedVideoIds.has(video.id)}
                    onToggleSelect={() => toggleVideoSelect(video.id)}
                    onArchive={() => archiveVideo.mutate(video.id)}
                    onValidate={() => validateVideo.mutate(video.id)}
                    onDragStart={() => handleDragStart([video.id])}
                    onOpenDetail={() => setSelectedVideoId(video.id)}
                    sortBy={sortBy}
                  />
                ))}

                {(isFetchingNextPage || isFetchingNextTopicPage || isFetchingNextTagGroupPage || isFetchingNextTagPage || isFetchingNextMultiTagPage) && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                )}

                {/* Load more button - only show if there are actually more videos to load */}
                {(() => {
                  const isNotFetching = !isFetchingNextPage && !isFetchingNextTopicPage && !isFetchingNextTagGroupPage && !isFetchingNextTagPage && !isFetchingNextMultiTagPage
                  const hasMore =
                    (selectedItem?.type === 'topic' && hasNextTopicPage) ||
                    (selectedItem?.type === 'tagGroup' && hasNextTagGroupPage) ||
                    (selectedItem?.type === 'tag' && hasNextTagPage) ||
                    (selectedItem?.type === 'multipleTags' && hasNextMultiTagPage) ||
                    ((!selectedItem || selectedItem?.type === 'area') && hasNextPage)

                  // Only show button if we have more pages AND we've loaded fewer than total
                  if (!isNotFetching || !hasMore || videos.length >= totalCount) return null

                  return (
                    <div className="flex justify-center py-4">
                      <button
                        onClick={() => {
                          if (selectedItem?.type === 'topic') fetchNextTopicPage()
                          else if (selectedItem?.type === 'tagGroup') fetchNextTagGroupPage()
                          else if (selectedItem?.type === 'tag') fetchNextTagPage()
                          else if (selectedItem?.type === 'multipleTags') fetchNextMultiTagPage()
                          else fetchNextPage()
                        }}
                        className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
                      >
                        Cargar más videos ({videos.length} de {totalCount})
                      </button>
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        </div>

        {/* Right Sidebar - Tag Groups & Tag Search */}
        <div
          className={`transition-all duration-300 ease-in-out flex-shrink-0 ${
            rightSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
          }`}
        >
          <div className="bg-white rounded-xl border border-gray-200 p-4 h-[calc(100vh-220px)] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Hash className="w-5 h-5 text-purple-600" />
                Tags
              </h2>
              <button
                onClick={() => setRightSidebarOpen(false)}
                className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                title="Ocultar sidebar"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>

            {/* Tag Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar tag... (min 2 chars)"
                  className="w-full pl-10 pr-8 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  value={tagSearchTerm}
                  onChange={(e) => setTagSearchTerm(e.target.value)}
                />
                {tagSearchTerm && (
                  <button
                    onClick={() => setTagSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Search results */}
              {tagSearchTerm.length >= 2 && (
                <div className="space-y-1 max-h-[200px] overflow-y-auto mt-2 border-b border-gray-100 pb-2">
                  {loadingTagSearch ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  ) : searchedTags && searchedTags.length > 0 ? (
                    <>
                      {searchedTags.map((tag) => {
                        const isSelected = selectedItem?.type === 'tag' && selectedItem.data.id === tag.id
                        return (
                          <div
                            key={tag.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => setSelectedItem({ type: 'tag', data: tag })}
                          >
                            <Hash className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-xs flex-1 truncate" title={tag.name}>
                              #{tag.name}
                            </span>
                            <span className="text-xs text-gray-400">{tag.video_count}</span>
                            {tag.tag_group && (
                              <span
                                className="text-xs px-1 py-0.5 bg-purple-100 text-purple-700 rounded truncate max-w-[60px]"
                                title={tag.tag_group.name}
                              >
                                {tag.tag_group.icon}
                              </span>
                            )}
                          </div>
                        )
                      })}
                      {/* Filter all matching tags button */}
                      {searchedTags.length > 1 && (
                        <button
                          onClick={() => {
                            const tagIds = searchedTags.map((t) => t.id)
                            setSelectedItem({
                              type: 'multipleTags',
                              data: { ids: tagIds, searchTerm: tagSearchTerm },
                            })
                          }}
                          className={`w-full mt-2 px-2 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 ${
                            selectedItem?.type === 'multipleTags'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                          Filtrar todos ({searchedTags.length} tags)
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-2 text-gray-400 text-xs">
                      No se encontraron tags
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tag Groups List */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">Tag Groups ({tagGroups?.length || 0})</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTagGroupSort('video_count')}
                  className={`px-2 py-0.5 text-xs rounded ${
                    tagGroupSort === 'video_count'
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  title="Ordenar por cantidad"
                >
                  #
                </button>
                <button
                  onClick={() => setTagGroupSort('name')}
                  className={`px-2 py-0.5 text-xs rounded ${
                    tagGroupSort === 'name'
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  title="Ordenar alfabéticamente"
                >
                  A-Z
                </button>
              </div>
            </div>
            <div className="space-y-1 overflow-y-auto flex-1">
              {sortedTagGroups.map((group) => {
                const isSelected = selectedItem?.type === 'tagGroup' && selectedItem.data.id === group.id
                const isExpanded = expandedTagGroups.has(group.id)

                return (
                  <div key={group.id}>
                    <div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-purple-100 text-purple-800' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedItem({ type: 'tagGroup', data: group })}
                    >
                      <button
                        className="p-0.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleTagGroup(group.id)
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                        )}
                      </button>
                      <span className="text-sm">{group.icon}</span>
                      <span className="text-xs flex-1 truncate">{group.name}</span>
                      <span className={`text-xs ${hasActiveFilters && filteredCounts ? 'text-blue-500 font-medium' : 'text-gray-400'}`}>
                        {hasActiveFilters && filteredCounts ? (filteredCounts.tag_group_counts[group.id] || 0) : group.video_count}
                      </span>
                    </div>

                    {isExpanded && <TagGroupTags groupId={group.id} onSelectTag={setSelectedItem} />}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Sidebar Toggle Button (when closed) */}
        {!rightSidebarOpen && (
          <button
            onClick={() => setRightSidebarOpen(true)}
            className="fixed right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            title="Mostrar Tag Groups"
          >
            <PanelRightOpen className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      {/* Modals */}
      <AreaModal
        isOpen={areaModal.isOpen}
        onClose={() => setAreaModal({ isOpen: false })}
        area={areaModal.area}
        onSave={handleSaveArea}
        isLoading={createArea.isPending || updateArea.isPending}
      />

      <TopicModal
        isOpen={topicModal.isOpen}
        onClose={() => setTopicModal({ isOpen: false })}
        topic={topicModal.topic}
        areaId={topicModal.areaId}
        areas={areas || []}
        onSave={handleSaveTopic}
        isLoading={createTopic.isPending || updateTopic.isPending}
      />

      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, type: 'area' })}
        onConfirm={handleConfirmDelete}
        title={deleteModal.type === 'area' ? 'Eliminar Área' : 'Eliminar Topic'}
        message={
          deleteModal.type === 'area'
            ? `¿Estás seguro de que quieres eliminar el área "${(deleteModal.item as Area)?.name_es}"? Los videos asociados perderán su clasificación.`
            : `¿Estás seguro de que quieres eliminar el topic "${(deleteModal.item as TopicWithArea)?.name_es}"?`
        }
        isLoading={deleteArea.isPending || deleteTopic.isPending}
      />

      {/* Video Detail Modal */}
      {selectedVideoId && selectedVideoData && (
        <VideoDetailModal
          video={selectedVideoData}
          area={areas?.find(a => a.id === selectedVideoData.area_id) || null}
          onClose={() => setSelectedVideoId(null)}
        />
      )}

      {/* Analysis Modal */}
      {analysisModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold">Análisis de Videos</h2>
                {analysisModal.result && (
                  <span className="text-sm text-gray-500">
                    ({analysisModal.result.video_count} videos, {analysisModal.result.processing_time_seconds}s)
                  </span>
                )}
              </div>
              <button
                onClick={() => setAnalysisModal({ isOpen: false, result: null, loading: false })}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {analysisModal.loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
                  <p className="text-gray-600">Analizando {selectedVideoIds.size} videos...</p>
                  <p className="text-sm text-gray-400 mt-2">Esto puede tardar 30-60 segundos</p>
                </div>
              ) : analysisModal.result ? (
                <div className="prose prose-sm max-w-none">
                  {analysisModal.result.mode === 'extended' && analysisModal.result.videos_with_summary !== null && (
                    <div className="mb-4 p-3 bg-purple-50 rounded-lg text-sm">
                      <span className="font-medium">{analysisModal.result.videos_with_summary}</span> videos con resumen,{' '}
                      <span className="font-medium">{analysisModal.result.video_count - analysisModal.result.videos_with_summary}</span> solo con título
                    </div>
                  )}
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-800 underline">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {analysisModal.result.analysis}
                  </ReactMarkdown>
                </div>
              ) : null}
            </div>

            <div className="border-t p-4 flex justify-end">
              <button
                onClick={() => setAnalysisModal({ isOpen: false, result: null, loading: false })}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper component for tag group tags
function TagGroupTags({
  groupId,
  onSelectTag,
}: {
  groupId: number
  onSelectTag: (item: SelectedItem) => void
}) {
  const { data: tags } = useTagsByGroup(groupId, 20)

  if (!tags || tags.length === 0) return null

  return (
    <div className="ml-6 mt-1 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => onSelectTag({ type: 'tag', data: tag as Tag })}
          className="px-1.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded truncate max-w-[100px]"
          title={tag.name}
        >
          #{tag.name}
        </button>
      ))}
    </div>
  )
}
