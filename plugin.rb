# file: discourse-lottery-v3/plugin.rb

# name: Discourse Lottery V3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

after_initialize do
  # This is the main entry point for our plugin's server-side logic.
  # All backend code, such as event listeners, model extensions, and service definitions,
  # will be loaded or required from within this block.
  #
  # For now, it remains empty as we have not yet implemented the backend logic
  # for creating a lottery. That will be our next step.
end
