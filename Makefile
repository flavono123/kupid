# the name of the binary when built
BINARY_NAME=kupid

# remove any binaries that are built
clean:
	rm -f ./bin/$(BINARY_NAME)*

build-debug: clean
	CGO_ENABLED=0 go build -gcflags=all="-N -l" -o bin/$(BINARY_NAME) cmd/kupid/main.go

# GUI build targets
GUI_DIR=cmd/gui
ASSETS_DIR=assets
ICON_SRC=$(ASSETS_DIR)/kattle-logo-light.png

.PHONY: gui-icons gui-build-darwin gui-build-windows gui-build gui-build-all

gui-icons:
	cp $(ICON_SRC) $(GUI_DIR)/build/appicon.png
	magick $(ICON_SRC) -define icon:auto-resize=256,128,64,48,32,16 $(GUI_DIR)/build/windows/icon.ico

gui-build-darwin: gui-icons
	cd $(GUI_DIR) && wails build -platform darwin/universal

gui-build-windows: gui-icons
	cd $(GUI_DIR) && wails build -platform windows/amd64

gui-build: gui-icons
	cd $(GUI_DIR) && wails build

gui-build-all: gui-icons
	cd $(GUI_DIR) && wails build -platform darwin/universal
	cd $(GUI_DIR) && wails build -platform windows/amd64

# macOS code signing and notarization
APP_NAME=kattle
BUILD_BIN=$(GUI_DIR)/build/bin

.PHONY: gui-codesign gui-dmg gui-notarize gui-staple gui-release-darwin

gui-codesign:
	codesign --deep --force --verify --verbose \
		--sign "$(APPLE_IDENTITY)" \
		--options runtime \
		--timestamp \
		$(BUILD_BIN)/$(APP_NAME).app

gui-dmg: gui-codesign
	rm -f $(BUILD_BIN)/$(APP_NAME).dmg
	rm -rf $(BUILD_BIN)/dmg-staging
	mkdir -p $(BUILD_BIN)/dmg-staging
	cp -R $(BUILD_BIN)/$(APP_NAME).app $(BUILD_BIN)/dmg-staging/
	ln -s /Applications $(BUILD_BIN)/dmg-staging/Applications
	hdiutil create -volname "$(APP_NAME)" \
		-srcfolder $(BUILD_BIN)/dmg-staging \
		-ov -format UDZO $(BUILD_BIN)/$(APP_NAME).dmg
	rm -rf $(BUILD_BIN)/dmg-staging
	codesign --force --sign "$(APPLE_IDENTITY)" \
		--timestamp $(BUILD_BIN)/$(APP_NAME).dmg

gui-notarize:
	xcrun notarytool submit $(BUILD_BIN)/$(APP_NAME).dmg \
		--keychain-profile "$(NOTARY_PROFILE)" \
		--wait

gui-staple:
	xcrun stapler staple $(BUILD_BIN)/$(APP_NAME).dmg

gui-release-darwin: gui-build-darwin gui-dmg gui-notarize gui-staple
	@echo "Release complete: $(BUILD_BIN)/$(APP_NAME).dmg"
