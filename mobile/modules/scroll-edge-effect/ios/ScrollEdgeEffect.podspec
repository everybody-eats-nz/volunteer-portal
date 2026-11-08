Pod::Spec.new do |s|
  s.name           = 'ScrollEdgeEffect'
  s.version        = '1.0.0'
  s.summary        = 'Attaches the iOS 26 scroll edge effect to the status bar'
  s.description    = 'Attaches the iOS 26 scroll edge effect to the status bar'
  s.author         = ''
  s.homepage       = 'https://volunteers.everybodyeats.nz'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
