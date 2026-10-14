import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Sidebar from './components/Sidebar'
import Dashboard  from './pages/Dashboard'
import Upload     from './pages/Upload'
import Sessions   from './pages/Sessions'
import Incidents  from './pages/Incidents'
import VideoPlayer from './pages/VideoPlayer'

export default function App() {
  return (
    <ThemeProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative">
          <Routes>
            <Route path="/"                       element={<Dashboard />}  />
            <Route path="/upload"                 element={<Upload />}     />
            <Route path="/sessions"               element={<Sessions />}   />
            <Route path="/sessions/:sessionId"    element={<VideoPlayer />}/>
            <Route path="/incidents"              element={<Incidents />}  />
          </Routes>
        </main>
      </div>
    </ThemeProvider>
  )
}