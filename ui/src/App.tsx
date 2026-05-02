import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import ExamplesPage from './pages/ExamplesPage'
import SettingsPage from './pages/SettingsPage'
import TestListPage from './pages/TestListPage'
import TestEditorPage from './pages/TestEditorPage'
import TestRunnerPage from './pages/TestRunnerPage'
import ResultsPage from './pages/ResultsPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectFeaturesPage from './pages/ProjectFeaturesPage'
import ProjectFeatureEditorPage from './pages/ProjectFeatureEditorPage'
import ProjectTestRunnerPage from './pages/ProjectTestRunnerPage'
import ProjectResultsPage from './pages/ProjectResultsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="examples" element={<ExamplesPage />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* Projects */}
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectID/features" element={<ProjectFeaturesPage />} />
        <Route path="projects/:projectID/features/:testID/edit" element={<ProjectFeatureEditorPage />} />
        <Route path="projects/:projectID/features/:testID/run" element={<ProjectTestRunnerPage />} />
        <Route path="projects/:projectID/features/:testID/history" element={<ProjectResultsPage />} />

        {/* Legacy flat tests */}
        <Route path="tests" element={<TestListPage />} />
        <Route path="tests/:testID" element={<TestEditorPage />} />
        <Route path="tests/:testID/run" element={<TestRunnerPage />} />
        <Route path="tests/:testID/results" element={<ResultsPage />} />
      </Route>
    </Routes>
  )
}

export default App
