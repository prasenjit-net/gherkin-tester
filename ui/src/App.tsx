import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import ExamplesPage from './pages/ExamplesPage'
import SettingsPage from './pages/SettingsPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectFeaturesPage from './pages/ProjectFeaturesPage'
import ProjectFeatureEditorPage from './pages/ProjectFeatureEditorPage'
import ProjectTestRunnerPage from './pages/ProjectTestRunnerPage'
import ProjectResultsPage from './pages/ProjectResultsPage'
import QueuePage from './pages/QueuePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="examples" element={<ExamplesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="queue" element={<QueuePage />} />

        {/* Projects */}
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectID/features" element={<ProjectFeaturesPage />} />
        <Route path="projects/:projectID/features/:testID/edit" element={<ProjectFeatureEditorPage />} />
        <Route path="projects/:projectID/features/:testID/run" element={<ProjectTestRunnerPage />} />
        <Route path="projects/:projectID/features/:testID/history" element={<ProjectResultsPage />} />
      </Route>
    </Routes>
  )
}

export default App
