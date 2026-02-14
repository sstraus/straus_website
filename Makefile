REMOTE = stefano@100.86.23.27
REMOTE_DIR = /volume1/web/me

DEPLOY_FILES = index.html favicon.svg robots.txt sitemap.xml feed.xml 404.html CNAME .nojekyll
DEPLOY_DIRS = css js content img vendor assets blog

.PHONY: generate deploy serve test

# Generate all derived files (feed, blog pages, sitemap)
generate:
	node scripts/generate-feed.js
	node scripts/generate-blog-pages.js

# Deploy to staging (generates first)
deploy: generate
	@echo "Deploying to $(REMOTE):$(REMOTE_DIR)..."
	ssh $(REMOTE) 'cd $(REMOTE_DIR) && find . -maxdepth 1 ! -name apps ! -name . -exec rm -rf {} +'
	tar cf - $(DEPLOY_FILES) $(DEPLOY_DIRS) | ssh $(REMOTE) 'cd $(REMOTE_DIR) && tar xf -'
	@echo "Done."

# Local dev server
serve:
	python3 -m http.server 7080

# Run Playwright tests
test: generate
	npx playwright test
