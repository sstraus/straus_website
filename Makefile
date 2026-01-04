# straus.it deployment
REMOTE_HOST := stefano@100.86.23.27
REMOTE_PATH := /volume1/web/me

# Files/folders to deploy (exclude dev files)
DEPLOY_FILES := index.html favicon.svg robots.txt sitemap.xml css js content img vendor assets

.PHONY: deploy clean

deploy:
	@echo "🚀 Deploying to $(REMOTE_HOST):$(REMOTE_PATH)..."
	@# Remove everything except 'apps' folder on remote
	@ssh $(REMOTE_HOST) 'cd $(REMOTE_PATH) && find . -maxdepth 1 ! -name "." ! -name "apps" -exec rm -rf {} +'
	@# Tar and pipe to remote, extract in place (suppress macOS xattr warnings)
	@tar --no-xattrs -cf - $(DEPLOY_FILES) 2>/dev/null | ssh $(REMOTE_HOST) 'cd $(REMOTE_PATH) && tar -xf -'
	@echo "✅ Deployed successfully!"

clean:
	@echo "Cleaning local build artifacts..."
	@rm -rf .DS_Store
