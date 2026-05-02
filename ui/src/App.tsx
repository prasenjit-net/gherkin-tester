import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import ExamplesPage from './pages/ExamplesPage'
import SettingsPage from './pages/SettingsPage'
import TestListPage from './pages/TestListPage'
import TestEditorPage from './pages/TestEditorPage'
import TestRunnerPage from './pages/TestRunnerPage'
import ResultsPage from './pages/ResultsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="examples" element={<ExamplesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="tests" element={<TestListPage />} />
        <Route path="tests/:testID" element={<TestEditorPage />} />
        <Route path="tests/:testID/run" element={<TestRunnerPage />} />
        <Route path="tests/:testID/results" element={<ResultsPage />} />
      </Route>
    </Routes>
  )
}

export default App
