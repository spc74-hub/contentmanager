import { useMemo } from 'react'
import { useVideos, useCategories, useAuthors } from '@/hooks'
import { Video, Users, FolderOpen, Clock } from 'lucide-react'
import type { Video as VideoType, Category } from '@/types'

export function Dashboard() {
  const { data: videosData, isLoading: loadingVideos } = useVideos()
  const { data: categories, isLoading: loadingCategories } = useCategories()
  const { data: authors, isLoading: loadingAuthors } = useAuthors()

  const isLoading = loadingVideos || loadingCategories || loadingAuthors

  // Flatten paginated data
  const videos = useMemo(() => {
    return videosData?.pages.flatMap(page => page.data) ?? []
  }, [videosData])

  const totalCount = videosData?.pages[0]?.count ?? 0

  const totalDuration = videos?.reduce((acc: number, v: VideoType) => acc + v.duration, 0) || 0

  const videosByCategory = categories?.map((cat: Category) => ({
    ...cat,
    count: cat.video_count || 0  // Use count from categories table
  })) || []

  const authorStats = authors?.map((author: string) => ({
    name: author,
    count: videos?.filter((v: VideoType) => v.author === author).length || 0
  })).sort((a: { name: string; count: number }, b: { name: string; count: number }) => b.count - a.count) || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Resumen de tu biblioteca de contenidos</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Video className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Videos</p>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <FolderOpen className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Categorías</p>
              <p className="text-2xl font-bold text-gray-900">{categories?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Autores</p>
              <p className="text-2xl font-bold text-gray-900">{authors?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Duración Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.floor(totalDuration / 60)}h {totalDuration % 60}m
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Categories and Authors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Videos por Categoría</h2>
          </div>
          <div className="p-6 space-y-3">
            {videosByCategory.map((cat: Category & { count: number }) => (
              <div key={cat.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                </div>
                <span
                  className="px-3 py-1 text-xs font-medium rounded-full"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  {cat.count} videos
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Authors */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Top Autores</h2>
          </div>
          <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
            {authorStats.slice(0, 10).map((author: { name: string; count: number }, idx: number) => (
              <div key={author.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{author.name}</span>
                </div>
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                  {author.count} videos
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
