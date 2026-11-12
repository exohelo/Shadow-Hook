# Adds the "ShadowHookWidgets" widget extension to the Capacitor-generated Xcode project (ios/App/App.xcodeproj)
# and embeds it in the app; also adds native/ShadowHookNative.swift to the app and wires AppDelegate.
# Run from ios-app/ after "npx cap sync ios".
# Env: TEAM_ID, BUNDLE_ID, PROFILES_JSON (bundle id => profile name, written by signing.mjs),
#      WATCH=1 to also add the Apple Watch app and its complications
require 'xcodeproj'
require 'fileutils'
require 'json'

NAME = 'ShadowHookWidgets'
BUNDLE_ID = ENV.fetch('BUNDLE_ID')
WIDGET_ID = BUNDLE_ID + '.widgets'
PROFILES = JSON.parse(File.read(ENV.fetch('PROFILES_JSON')))
proj_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(proj_path)
app = project.targets.find { |t| t.name == 'App' } or abort('App target not found')
abort("#{NAME} already in the project") if project.targets.any? { |t| t.name == NAME }

dir = File.join('ios/App', NAME)
FileUtils.mkdir_p(dir)
FileUtils.cp('widgets/ShadowHookWidgets.swift', File.join(dir, 'ShadowHookWidgets.swift'))
File.write(File.join(dir, 'Info.plist'), <<~PLIST)
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
    <key>CFBundleDevelopmentRegion</key><string>en</string>
    <key>CFBundleDisplayName</key><string>Shadow Hook</string>
    <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key><string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
    <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
    <key>NSExtension</key>
    <dict>
      <key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string>
    </dict>
  </dict>
  </plist>
PLIST

ext = project.new_target(:app_extension, NAME, :ios, '17.0', nil, :swift)
# the library adds a Foundation.framework reference pinned to an old SDK path; Swift links system frameworks itself
ext.frameworks_build_phase.files.to_a.each { |f| ext.frameworks_build_phase.remove_build_file(f) }
group = project.main_group.new_group(NAME, NAME)
src = group.new_file('ShadowHookWidgets.swift')
group.new_file('Info.plist')
ext.add_file_references([src])

ext.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['PRODUCT_BUNDLE_IDENTIFIER'] = WIDGET_ID
  s['INFOPLIST_FILE'] = "#{NAME}/Info.plist"
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['SWIFT_VERSION'] = '5.0'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['SKIP_INSTALL'] = 'YES'
  s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  s['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
  s['CODE_SIGN_STYLE'] = 'Manual'
  s['DEVELOPMENT_TEAM'] = ENV.fetch('TEAM_ID')
  s['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
  s['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = 'Apple Distribution'
  s['PROVISIONING_PROFILE_SPECIFIER'] = PROFILES.fetch(WIDGET_ID).fetch('name')
  s['MARKETING_VERSION'] = '1.0'
  s['CURRENT_PROJECT_VERSION'] = '1'
end

app.add_dependency(ext)
embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(ext.product_reference, true)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# --- native glue in the app itself: push hook-up and Live Activity plumbing
FileUtils.cp('native/ShadowHookNative.swift', 'ios/App/App/ShadowHookNative.swift')
app_group = project.main_group.children.find { |g| g.display_name == 'App' && g.respond_to?(:new_file) } or abort('App group not found')
app.add_file_references([app_group.new_file('ShadowHookNative.swift')])

delegate = 'ios/App/App/AppDelegate.swift'
code = File.read(delegate)
unless code.include?('ShadowHookNative.start()')
  code.sub!('// Override point for customization after application launch.',
            "// Override point for customization after application launch.\n        ShadowHookNative.start()") or abort('AppDelegate: launch point not found')
  hooks = [
    '    // Hand the Apple push address to Capacitor (the push plugin cannot register without these two).',
    '    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {',
    '        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)',
    '    }',
    '',
    '    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {',
    '        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)',
    '    }',
    '',
    ''
  ].join("\n")
  code.sub!('    func applicationWillResignActive') { hooks + '    func applicationWillResignActive' } or abort('AppDelegate: insert point not found')
  File.write(delegate, code)
end

plist = 'ios/App/App/Info.plist'
xml = File.read(plist)
unless xml.include?('NSSupportsLiveActivities')
  xml.sub!(%r{</dict>\s*</plist>\s*\z}, "\t<key>NSSupportsLiveActivities</key>\n\t<true/>\n</dict>\n</plist>\n") or abort('Info.plist: end not found')
  File.write(plist, xml)
end

# --- Apple Watch: a small watch app plus its watch-face complications (one Swift file, two targets)
if ENV['WATCH'] == '1'
  wapp_name = 'ShadowHookWatch'
  wext_name = 'ShadowHookWatchWidgets'
  wapp_id = BUNDLE_ID + '.watchkitapp'
  wext_id = wapp_id + '.widgets'
  wdir = File.join('ios/App', wapp_name)
  icons = File.join(wdir, 'Assets.xcassets', 'AppIcon.appiconset')
  FileUtils.mkdir_p(icons)
  FileUtils.cp('watch/ShadowHookWatch.swift', File.join(wdir, 'ShadowHookWatch.swift'))
  FileUtils.cp('resources/AppIcon-1024.png', File.join(icons, 'AppIcon-1024.png'))
  File.write(File.join(wdir, 'Assets.xcassets', 'Contents.json'), '{"info":{"author":"xcode","version":1}}')
  File.write(File.join(icons, 'Contents.json'),
             '{"images":[{"filename":"AppIcon-1024.png","idiom":"universal","platform":"watchos","size":"1024x1024"}],"info":{"author":"xcode","version":1}}')
  head = <<~PLIST
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
    <dict>
      <key>CFBundleDevelopmentRegion</key><string>en</string>
      <key>CFBundleDisplayName</key><string>Shadow Hook</string>
      <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
      <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
      <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
      <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
      <key>CFBundlePackageType</key><string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
      <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
      <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
      <key>ShkKeychainGroup</key><string>$(AppIdentifierPrefix)com.theshadowhook.shared</string>
  PLIST
  File.write(File.join(wdir, 'Info.plist'), head + <<~PLIST)
      <key>WKApplication</key><true/>
      <key>WKCompanionAppBundleIdentifier</key><string>#{BUNDLE_ID}</string>
    </dict>
    </plist>
  PLIST
  File.write(File.join(wdir, 'WidgetInfo.plist'), head + <<~PLIST)
      <key>NSExtension</key>
      <dict>
        <key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string>
      </dict>
    </dict>
    </plist>
  PLIST
  File.write(File.join(wdir, 'Watch.entitlements'), <<~PLIST)
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
    <dict>
      <key>keychain-access-groups</key>
      <array><string>$(AppIdentifierPrefix)com.theshadowhook.shared</string></array>
    </dict>
    </plist>
  PLIST

  wapp = project.new_target(:application, wapp_name, :watchos, '10.0', nil, :swift)
  wext = project.new_target(:app_extension, wext_name, :watchos, '10.0', nil, :swift)
  [wapp, wext].each { |t| t.frameworks_build_phase.files.to_a.each { |f| t.frameworks_build_phase.remove_build_file(f) } }
  wgroup = project.main_group.new_group(wapp_name, wapp_name)
  wsrc = wgroup.new_file('ShadowHookWatch.swift')
  wassets = wgroup.new_file('Assets.xcassets')
  %w[Info.plist WidgetInfo.plist Watch.entitlements].each { |f| wgroup.new_file(f) }
  wapp.add_file_references([wsrc])
  wapp.add_resources([wassets])
  wext.add_file_references([wsrc])

  { wapp => [wapp_id, 'Info.plist', true], wext => [wext_id, 'WidgetInfo.plist', false] }.each do |target, (ident, plist_name, is_app)|
    target.build_configurations.each do |c|
      s = c.build_settings
      s['PRODUCT_NAME'] = '$(TARGET_NAME)'
      s['PRODUCT_BUNDLE_IDENTIFIER'] = ident
      s['SDKROOT'] = 'watchos'
      s['WATCHOS_DEPLOYMENT_TARGET'] = '10.0'
      s['TARGETED_DEVICE_FAMILY'] = '4'
      s['INFOPLIST_FILE'] = "#{wapp_name}/#{plist_name}"
      s['GENERATE_INFOPLIST_FILE'] = 'NO'
      s['CODE_SIGN_ENTITLEMENTS'] = "#{wapp_name}/Watch.entitlements"
      s['SWIFT_VERSION'] = '5.0'
      s['SKIP_INSTALL'] = 'YES'
      s['CODE_SIGN_STYLE'] = 'Manual'
      s['DEVELOPMENT_TEAM'] = ENV.fetch('TEAM_ID')
      s['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
      s['PROVISIONING_PROFILE_SPECIFIER'] = PROFILES.fetch(ident).fetch('name')
      s['MARKETING_VERSION'] = '1.0'
      s['CURRENT_PROJECT_VERSION'] = '1'
      if is_app
        s['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
        s['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = '$(inherited) SHK_WATCH_APP'
        s['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks'
      else
        s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
        s['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
      end
    end
  end

  wapp.add_dependency(wext)
  wembed = wapp.new_copy_files_build_phase('Embed Foundation Extensions')
  wembed.symbol_dst_subfolder_spec = :plug_ins
  wembed.add_file_reference(wext.product_reference, true).settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

  app.add_dependency(wapp)
  watch_embed = app.new_copy_files_build_phase('Embed Watch Content')
  watch_embed.dst_subfolder_spec = '16'
  watch_embed.dst_path = '$(CONTENTS_FOLDER_PATH)/Watch'
  watch_embed.add_file_reference(wapp.product_reference, true).settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  puts "added #{wapp_name} (#{wapp_id}) with #{wext_name} (#{wext_id})"
end

project.save
puts "added #{NAME} (#{WIDGET_ID}), embedded it in App, and wired the native glue"
