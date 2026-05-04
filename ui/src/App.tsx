import { Navigate, Route, Routes } from 'react-router-dom'
import { EventBusProvider } from './context/EventBusContext'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import EnvironmentEditorPage from './pages/EnvironmentEditorPage'
import EnvironmentsPage from './pages/EnvironmentsPage'
import ExamplesPage from './pages/ExamplesPage'
import SettingsPage from './pages/SettingsPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectFeaturesPage from './pages/ProjectFeaturesPage'
import ProjectFeatureEditorPage from './pages/ProjectFeatureEditorPage'
import ProjectResultsPage from './pages/ProjectResultsPage'
import ProjectSpecPage from './pages/ProjectSpecPage'
import QueuePage from './pages/QueuePage'

function App() {
  return (
    <EventBusProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="environments" element={<EnvironmentsPage />} />
          <Route path="environments/new" element={<EnvironmentEditorPage />} />
          <Route path="environments/:environmentID/edit" element={<EnvironmentEditorPage />} />
          <Route path="examples" element={<ExamplesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="queue" element={<QueuePage />} />

          {/* Projects */}
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectID/features" element={<ProjectFeaturesPage />} />
          <Route path="projects/:projectID/specs/:specID" element={<ProjectSpecPage />} />
          <Route path="projects/:projectID/features/:testID/edit" element={<ProjectFeatureEditorPage />} />
          <Route path="projects/:projectID/features/:testID/history" element={<ProjectResultsPage />} />
        </Route>
      </Routes>
    </EventBusProvider>
  )
}

export default App
