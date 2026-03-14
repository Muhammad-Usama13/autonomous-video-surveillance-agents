import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard  from './pages/Dashboard'
import Upload     from './pages/Upload'
import Sessions   from './pages/Sessions'
import Incidents  from './pages/Incidents'
import VideoPlayer from './pages/VideoPlayer'

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/"                       element={<Dashboard />}  />
          <Route path="/upload"                 element={<Upload />}     />
          <Route path="/sessions"               element={<Sessions />}   />
          <Route path="/sessions/:sessionId"    element={<VideoPlayer />}/>
          <Route path="/incidents"              element={<Incidents />}  />
        </Routes>
      </main>
    </div>
  )
}