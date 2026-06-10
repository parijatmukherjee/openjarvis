# OpenJarvis — Development Makefile
# Single entrypoint for all dev, test, and build commands
# Usage: make dev | make test | make build | make lint | make format

.PHONY: dev test build lint format format-check coverage install clean docker-test help

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

help: ## Show this help message
	@echo "$(BLUE)OpenJarvis — Development Commands$(RESET)"
	@echo ""
	@echo "$(GREEN)Development:$(RESET)"
	@echo "  $(YELLOW)make dev$(RESET)        Start the full application (Electron + backend)"
	@echo "  $(YELLOW)make install$(RESET)    Install all dependencies"
	@echo "  $(YELLOW)make build$(RESET)     Build all packages"
	@echo ""
	@echo "$(GREEN)Testing:$(RESET)"
	@echo "  $(YELLOW)make test$(RESET)      Run all unit tests"
	@echo "  $(YELLOW)make test-watch$(RESET) Run tests in watch mode"
	@echo "  $(YELLOW)make test-functional$(RESET) Run functional/e2e tests"
	@echo "  $(YELLOW)make coverage$(RESET)  Run tests with coverage report"
	@echo ""
	@echo "$(GREEN)Quality:$(RESET)"
	@echo "  $(YELLOW)make lint$(RESET)      Run ESLint across all packages"
	@echo "  $(YELLOW)make format$(RESET)    Format all files with Prettier"
	@echo "  $(YELLOW)make format-check$(RESET) Check formatting without modifying"
	@echo ""
	@echo "$(GREEN)Docker:$(RESET)"
	@echo "  $(YELLOW)make docker-test$(RESET) Run full CI gate inside Docker"
	@echo "  $(YELLOW)make docker-build$(RESET) Build Docker test image"
	@echo ""
	@echo "$(GREEN)Electron Desktop:$(RESET)"
	@echo "  $(YELLOW)make electron-dev$(RESET)   Start Electron app in dev mode"
	@echo "  $(YELLOW)make electron-build$(RESET) Build Electron app for current platform"
	@echo "  $(YELLOW)make electron-pack$(RESET)  Package Electron app for distribution"
	@echo ""
	@echo "$(GREEN)Cleanup:$(RESET)"
	@echo "  $(YELLOW)make clean$(RESET)     Remove build artifacts and node_modules"

# Development
install: ## Install dependencies
	npm install

dev: install build ## Start the full application (Electron + backend)
	@echo "$(GREEN)Starting OpenJarvis Desktop...$(RESET)"
	cd packages/desktop && npm run electron:dev

build: ## Build all packages
	@echo "$(GREEN)Building all packages...$(RESET)"
	npm run build

# Testing
test: build ## Run all unit tests
	@echo "$(GREEN)Running unit tests...$(RESET)"
	npm test

test-watch: ## Run tests in watch mode
	@echo "$(GREEN)Running tests in watch mode...$(RESET)"
	npx vitest

test-functional: build ## Run functional/e2e tests
	@echo "$(GREEN)Running functional tests...$(RESET)"
	npm run test:functional

coverage: build ## Run tests with coverage report
	@echo "$(GREEN)Running tests with coverage...$(RESET)"
	npm run coverage

# Quality
lint: ## Run ESLint
	@echo "$(GREEN)Running linter...$(RESET)"
	npm run lint

format: ## Format all files with Prettier
	@echo "$(GREEN)Formatting files...$(RESET)"
	npx prettier --write "**/*.{ts,json,md,yml}"

format-check: ## Check formatting without modifying
	@echo "$(GREEN)Checking formatting...$(RESET)"
	npm run format:check

# Docker
docker-test: docker-build ## Run full CI gate inside Docker
	@echo "$(GREEN)Running Docker test gate...$(RESET)"
	docker run --rm openjarvis-test

docker-build: ## Build Docker test image
	@echo "$(GREEN)Building Docker image...$(RESET)"
	docker build -f Dockerfile.test -t openjarvis-test .

# Electron Desktop
electron-dev: build ## Start Electron app in dev mode
	@echo "$(GREEN)Starting Electron in dev mode...$(RESET)"
	cd packages/desktop && npx electron . --dev

electron-build: build ## Build Electron app for current platform
	@echo "$(GREEN)Building Electron app...$(RESET)"
	cd packages/desktop && npm run electron:build

electron-pack: build ## Package Electron app for distribution
	@echo "$(GREEN)Packaging Electron app...$(RESET)"
	cd packages/desktop && npm run electron:pack

# Cleanup
clean: ## Remove build artifacts and node_modules
	@echo "$(YELLOW)Cleaning build artifacts...$(RESET)"
	rm -rf node_modules packages/*/node_modules packages/*/dist
	rm -f package-lock.json
	@echo "$(GREEN)Clean complete. Run 'make install' to reinstall.$(RESET)"

# Full CI Gate (runs everything)
gate: lint format-check test coverage test-functional ## Run full CI gate locally
	@echo "$(GREEN)✅ All gates passed!$(RESET)"
