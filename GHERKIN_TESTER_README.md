# Gherkin Tester - Karate Test Execution Agent

A production-ready test execution agent for submitting, storing, and running Karate (Gherkin) tests against APIs with a full-stack web interface.

## Quick Start

### Prerequisites
- Go 1.23+
- Node.js 20+
- npm

### Build & Run

```bash
# Install dependencies
make install-deps

# Build the application
make build

# Run the server
./build/gherkin-tester serve
```

Visit `http://localhost:8080`

## Features

### 🧪 Test Management
- **Create**: Upload or write Karate feature files via UI
- **Store**: Persistent file-based storage with metadata
- **Edit**: Syntax-highlighted editor for test content
- **Execute**: Run tests on demand with real-time feedback
- **History**: View execution history and trends

### 📊 Results & Reporting
- Execution status (Passed/Failed/Error)
- Execution metrics (duration, scenarios, passed/failed)
- Test output and error messages
- Execution history with timestamps
- Result persistence

### 🎨 User Interface
- Modern React UI with Tailwind CSS
- Responsive design for desktop/tablet
- Light/Dark/System theme support
- Intuitive navigation

### 🔌 REST API

All endpoints require no authentication (demo mode).

#### Tests
```
POST   /api/tests                    Create test
GET    /api/tests                    List tests
GET    /api/tests/{testID}           Get test
DELETE /api/tests/{testID}           Delete test
```

#### Execution
```
POST   /api/tests/{testID}/run       Execute test
GET    /api/tests/{testID}/results   Get latest result
GET    /api/tests/{testID}/history   Get execution history
```

#### System
```
GET    /api/health                   Health check
GET    /api/meta                     App metadata
```

## API Examples

### Create a Test
```bash
curl -X POST http://localhost:8080/api/tests \
  -H "Content-Type: application/json" \
  -d '{
    "id": "smoke-login",
    "name": "Smoke: Login",
    "description": "Basic login test",
    "content": "Feature: Login\n  Scenario: Valid credentials\n    Given user at login page\n    When user enters valid credentials\n    Then user logged in",
    "tags": ["smoke", "critical"]
  }'
```

### Execute Test
```bash
curl -X POST http://localhost:8080/api/tests/smoke-login/run
```

### Get Results
```bash
curl http://localhost:8080/api/tests/smoke-login/history
```

## Data Storage

Tests and results are stored in the `/data` directory:

```
data/
├── tests/
│   ├── {testID}.feature        # Karate feature file
│   └── {testID}.json           # Test metadata
└── results/
    └── {testID}_{resultID}.json # Execution result
```

## Configuration

### config.yaml
```yaml
tests:
  dataDir: ./data              # Storage directory
  karateJar: ""                # Path to Karate JAR (optional)
  maxExecutors: 4              # Concurrent execution limit
```

### Environment Variables
```bash
APP_TESTS_DATA_DIR=./data
APP_TESTS_KARATE_JAR=/path/to/karate.jar
APP_TESTS_MAX_EXECUTORS=4
```

## Development

### Run Backend Only
```bash
make dev
```

### Run Frontend Dev Server
```bash
make dev-ui
```

### Run Both Together
```bash
make dev-all
```

### Run Tests
```bash
make test
```

### Lint Code
```bash
make lint              # Go linter
make lint-ui           # ESLint
```

## Architecture

### Backend (Go)
- **Router**: Chi v5 HTTP router
- **Storage**: File-based with JSON metadata
- **Executor**: Pluggable execution engine (mock implementation included)
- **Config**: Viper with .env support

### Frontend (React)
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Data Fetching**: React Query
- **Routing**: React Router v6
- **Build**: Vite

## Packages

### Go
- `github.com/go-chi/chi/v5` - HTTP router
- `github.com/spf13/viper` - Configuration
- `github.com/spf13/cobra` - CLI

### Node
- `react` - UI framework
- `typescript` - Type safety
- `tailwindcss` - Styling
- `@tanstack/react-query` - Data fetching
- `lucide-react` - Icons
- `vite` - Build tool

## Future Enhancements

1. **Karate Integration**: Real Karate JAR execution
2. **Docker**: Container image for deployment
3. **Database**: SQL backend for scalability
4. **Authentication**: User management and RBAC
5. **Scheduling**: Recurring test execution
6. **Webhooks**: CI/CD integration (GitHub, GitLab)
7. **Reporting**: Advanced analytics and dashboards
8. **Test Suites**: Group and batch execution
9. **Parallel Execution**: True concurrent runs
10. **Notifications**: Email, Slack, Teams alerts

## Troubleshooting

### Server won't start
- Check port 8080 is available: `lsof -i :8080`
- Verify config.yaml exists and is valid
- Check data directory permissions

### Tests not running
- Ensure test ID is unique
- Verify feature file content is valid Gherkin
- Check `/data/tests` directory for stored files

### UI not loading
- Run `make build-ui` to rebuild frontend
- Clear browser cache
- Check browser console for errors

## License

[Your License Here]

## Support

For issues and feature requests, visit the repository.
