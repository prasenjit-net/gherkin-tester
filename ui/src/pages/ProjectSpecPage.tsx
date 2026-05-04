import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, FileText, Globe, Sparkles, Tag, Trash2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import { projectApi } from '../services/api'
import type { SpecDetail, Test } from '../types'

export default function ProjectSpecPage() {
  const { projectID, specID } = useParams<{ projectID: string; specID: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [detail, setDetail] = useState<SpecDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generatedTests, setGeneratedTests] = useState<Test[]>([])

  useEffect(() => {
    if (!projectID || !specID) return

    const loadSpec = async () => {
      try {
        setLoading(true)
        setError(null)
        setDetail(await projectApi.getSpec(projectID, specID))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load spec')
      } finally {
        setLoading(false)
      }
    }

    void loadSpec()
  }, [projectID, specID])

  const handleDelete = async () => {
    if (!projectID || !specID || !confirm('Delete this spec file?')) return
    try {
      setDeleting(true)
      await projectApi.deleteSpec(projectID, specID)
      toast('Spec deleted')
      navigate(`/projects/${projectID}/features`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete spec', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleGenerate = async () => {
    if (!projectID || !specID) return
    try {
      setGenerating(true)
      setGenerationError(null)
      const result = await projectApi.generateSpecTests(projectID, specID, generationPrompt)
      setGeneratedTests(result.tests)
      toast(result.tests.length === 1 ? 'Generated 1 feature file' : `Generated ${result.tests.length} feature files`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate feature files'
      setGenerationError(message)
      toast(message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <p className="p-8 text-sm text-gray-500 dark:text-slate-400">Loading…</p>

  if (error || !detail) {
    return (
      <div className="space-y-4 p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error ?? 'Spec not found'}
        </div>
        <Link
          to={`/projects/${projectID}/features`}
          className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          ← Back to Project
        </Link>
      </div>
    )
  }

  const { spec } = detail

  return (
    <div className="space-y-8 p-8">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400">
        <Link to="/projects" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">Projects</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to={`/projects/${projectID}/features`} className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
          {projectID}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-800 dark:text-slate-200">{spec.name}</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{spec.name}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              OpenAPI {spec.summary.openapiVersion || '3.x'} · {spec.fileName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <Link
            to={`/projects/${projectID}/features`}
            className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            ← Back
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-slate-100">Spec Summary</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Version', value: spec.summary.version || '—' },
                { label: 'Format', value: spec.format.toUpperCase() },
                { label: 'Paths', value: spec.summary.pathsCount },
                { label: 'Operations', value: spec.summary.operationsCount },
              ].map(item => (
                <div key={item.label} className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-slate-100">{item.value}</p>
                </div>
              ))}
            </div>
            {spec.description && (
              <p className="mt-4 text-sm text-gray-600 dark:text-slate-300">{spec.description}</p>
            )}
            {spec.summary.description && (
              <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">{spec.summary.description}</p>
            )}
          </section>

          {spec.summary.servers && spec.summary.servers.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Servers</h2>
              </div>
              <div className="space-y-3">
                {spec.summary.servers.map(server => (
                  <div key={`${server.url}-${server.description}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="break-all text-sm font-medium text-gray-900 dark:text-slate-100">{server.url}</p>
                    {server.description && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{server.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {spec.summary.tags && spec.summary.tags.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2">
                <Tag className="h-4 w-4 text-gray-400" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Tags</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {spec.summary.tags.map(tag => (
                  <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Generate Gherkin Features</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Describe the coverage you want from this spec. Generated outputs are saved as normal project feature files.
            </p>
            <textarea
              value={generationPrompt}
              onChange={(e) => setGenerationPrompt(e.target.value)}
              rows={6}
              className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              placeholder="Example: Generate happy-path and validation scenarios for invoice listing, focus on query parameters, error responses, and any auth behavior defined in the spec."
            />
            {generationError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
                {generationError}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {generating ? 'Generating…' : 'Generate Feature Files'}
              </button>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                Uses the configured AI provider from Settings.
              </span>
            </div>

            {generatedTests.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Generated Files</h3>
                {generatedTests.map((test) => (
                  <div key={test.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{test.name}</p>
                        {test.description && (
                          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{test.description}</p>
                        )}
                        {test.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {test.tags.map((tag) => (
                              <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Link
                        to={`/projects/${projectID}/features/${test.id}/edit`}
                        className="rounded-lg border border-violet-200 px-3 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/20"
                      >
                        Open feature
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-slate-100">Endpoints</h2>
            {detail.endpoints.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">No operations found in this spec.</p>
            ) : (
              <div className="space-y-3">
                {detail.endpoints.map(endpoint => (
                  <div key={`${endpoint.method}-${endpoint.path}-${endpoint.operationId}`} className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-semibold text-gray-900 dark:text-slate-100">{endpoint.path}</code>
                      {endpoint.deprecated && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          Deprecated
                        </span>
                      )}
                    </div>
                    {(endpoint.summary || endpoint.operationId) && (
                      <p className="mt-2 text-sm font-medium text-gray-700 dark:text-slate-200">
                        {endpoint.summary || endpoint.operationId}
                      </p>
                    )}
                    {endpoint.description && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{endpoint.description}</p>
                    )}
                    {endpoint.tags && endpoint.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {endpoint.tags.map(tag => (
                          <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-slate-100">Raw Spec</h2>
            <pre className="max-h-[40rem] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-green-300 whitespace-pre-wrap break-words">
              {detail.content}
            </pre>
          </section>
        </div>
      </div>
    </div>
  )
}
