import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Videos } from '@/pages/Videos'
import { VideoDetail } from '@/pages/VideoDetail'
import { Import } from '@/pages/Import'
import { AIProcessing } from '@/pages/AIProcessing'
import { Authors } from '@/pages/Authors'
import { Taxonomy } from '@/pages/Taxonomy'
import { Assistant } from '@/pages/Assistant'
import { Channels } from '@/pages/Channels'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="videos" element={<Videos />} />
            <Route path="videos/:id" element={<VideoDetail />} />
            <Route path="authors" element={<Authors />} />
            <Route path="taxonomy" element={<Taxonomy />} />
            <Route path="import" element={<Import />} />
            <Route path="ai-processing" element={<AIProcessing />} />
            <Route path="assistant" element={<Assistant />} />
            <Route path="channels" element={<Channels />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
