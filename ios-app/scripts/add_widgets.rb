# Adds the "ShadowHookWidgets" widget extension to the Capacitor-generated Xcode project (ios/App/App.xcodeproj)
# and embeds it in the app; also adds native/ShadowHookNative.swift to the app and wires AppDelegate.
# Run from ios-app/ after "npx cap sync ios".
# Env: TEAM_ID, WIDGET_BUNDLE_ID, WIDGET_PROFILE (provisioning profile name)
require 'xcodeproj'
require 'fileutils'

NAME = 'ShadowHookWidgets'
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
  s['PRODUCT_BUNDLE_IDENTIFIER'] = ENV.fetch('WIDGET_BUNDLE_ID')
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
  s['PROVISIONING_PROFILE_SPECIFIER'] = ENV.fetch('WIDGET_PROFILE')
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

project.save
puts "added #{NAME} (#{ENV['WIDGET_BUNDLE_ID']}), embedded it in App, and wired the native glue"
